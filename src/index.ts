#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment
const WORDPRESS_URL = process.env.WORDPRESS_URL;
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_APP_PASSWORD) {
  console.error(
    "Missing required environment variables: WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD"
  );
  process.exit(1);
}

// Normalize URL (remove trailing slash)
const baseUrl = WORDPRESS_URL.replace(/\/$/, "");
const abilitiesApiBase = `${baseUrl}/wp-json/wp-abilities/v1`;

// Create Basic Auth header
const authHeader = `Basic ${Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString("base64")}`;

// Types for WordPress Abilities API
interface AbilityAnnotations {
  readonly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
}

interface AbilityMeta {
  annotations?: AbilityAnnotations;
  show_in_rest?: boolean;
}

interface WordPressAbility {
  name: string;
  label: string;
  description: string;
  category: string;
  input_schema: object | unknown[];
  output_schema: object;
  meta?: AbilityMeta;
  _links?: {
    "wp:action-run"?: Array<{ href: string }>;
  };
}

// Cache for discovered abilities
let abilitiesCache: WordPressAbility[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });
}

async function discoverAbilities(): Promise<WordPressAbility[]> {
  const now = Date.now();
  if (abilitiesCache && now - lastFetchTime < CACHE_TTL_MS) {
    return abilitiesCache;
  }

  const response = await fetchWithAuth(`${abilitiesApiBase}/abilities?per_page=100`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to discover abilities: ${response.status} ${error}`);
  }

  const abilities = (await response.json()) as WordPressAbility[];
  abilitiesCache = abilities;
  lastFetchTime = now;

  return abilities;
}

async function getAbilityDetails(abilityName: string): Promise<WordPressAbility> {
  const response = await fetchWithAuth(`${abilitiesApiBase}/abilities/${abilityName}`);

  if (!response.ok) {
    throw new Error(`Failed to get ability details: ${response.status}`);
  }

  return response.json() as Promise<WordPressAbility>;
}

// Check if ability accepts input (has a valid input schema)
function abilityAcceptsInput(ability: WordPressAbility): boolean {
  const schema = ability.input_schema;
  // Empty array means no input
  if (Array.isArray(schema) && schema.length === 0) {
    return false;
  }
  // Object schema with properties means input is accepted
  if (typeof schema === "object" && !Array.isArray(schema)) {
    const objSchema = schema as Record<string, unknown>;
    return objSchema.type === "object" && objSchema.properties !== undefined;
  }
  return false;
}

// Check if input is meaningful (not empty)
function hasInput(input: unknown): boolean {
  if (input === undefined || input === null) return false;
  if (typeof input === "object" && Object.keys(input as object).length === 0) return false;
  return true;
}

async function executeAbility(
  ability: WordPressAbility,
  input?: unknown
): Promise<unknown> {
  const runUrl = ability._links?.["wp:action-run"]?.[0]?.href ??
    `${abilitiesApiBase}/abilities/${ability.name}/run`;

  const isReadonly = ability.meta?.annotations?.readonly === true;
  const acceptsInput = abilityAcceptsInput(ability);

  if (isReadonly) {
    // Read-only abilities use GET with input as query param (if accepted)
    let url = runUrl;
    if (acceptsInput && hasInput(input)) {
      const params = new URLSearchParams();
      params.set("input", JSON.stringify(input));
      url = `${runUrl}?${params.toString()}`;
    }

    const response = await fetchWithAuth(url, { method: "GET" });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ability execution failed: ${response.status} ${error}`);
    }

    return response.json();
  } else {
    // Non-readonly abilities use POST
    const body = acceptsInput && hasInput(input) ? JSON.stringify({ input }) : "{}";
    const response = await fetchWithAuth(runUrl, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ability execution failed: ${response.status} ${error}`);
    }

    return response.json();
  }
}

// Convert WordPress ability name to MCP tool name
// e.g., "core/get-site-info" -> "wp_core_get_site_info"
function abilityToToolName(abilityName: string): string {
  return "wp_" + abilityName.replace(/\//g, "_").replace(/-/g, "_");
}

// Convert MCP tool name back to ability name
function toolNameToAbility(toolName: string): string {
  // Remove "wp_" prefix and convert underscores
  const withoutPrefix = toolName.replace(/^wp_/, "");
  // Find where the category ends (first underscore after initial segment)
  const parts = withoutPrefix.split("_");
  const category = parts[0];
  const rest = parts.slice(1).join("-");
  return `${category}/${rest}`;
}

// MCP-compatible input schema type
interface McpInputSchema {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
}

// Convert WordPress JSON Schema to MCP-compatible schema
function convertInputSchema(inputSchema: object | unknown[]): McpInputSchema {
  // Empty array means no input
  if (Array.isArray(inputSchema) && inputSchema.length === 0) {
    return {
      type: "object",
      properties: {},
    };
  }

  // Already an object schema - ensure it has type: "object"
  if (typeof inputSchema === "object" && !Array.isArray(inputSchema)) {
    const schema = inputSchema as Record<string, unknown>;
    return {
      type: "object",
      ...schema,
    };
  }

  return {
    type: "object",
    properties: {},
  };
}

// Create the MCP server
const server = new Server(
  {
    name: "mcp-wordpress",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const abilities = await discoverAbilities();

  const tools: Tool[] = abilities.map((ability) => {
    const annotations = ability.meta?.annotations ?? {};

    return {
      name: abilityToToolName(ability.name),
      description: `${ability.label}: ${ability.description}`,
      inputSchema: convertInputSchema(ability.input_schema),
      annotations: {
        readOnlyHint: annotations.readonly ?? false,
        destructiveHint: annotations.destructive ?? false,
        idempotentHint: annotations.idempotent ?? false,
      },
    };
  });

  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const abilityName = toolNameToAbility(toolName);

  // Get full ability details for execution
  const ability = await getAbilityDetails(abilityName);

  // Get input arguments
  const input = request.params.arguments;

  try {
    const result = await executeAbility(ability, input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${ability.label}: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`WordPress MCP server connected to ${baseUrl}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
