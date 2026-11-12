import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(projectRoot, "dist", "index.js");
const dummyUsername = "fixture-user";
const dummyPassword = "fixture-password";
const expectedAuthorization = `Basic ${Buffer.from(`${dummyUsername}:${dummyPassword}`).toString("base64")}`;

async function startWordPressFixture() {
  const requests = [];
  let fixtureUrl;

  const server = createServer((request, response) => {
    const url = new URL(request.url, fixtureUrl);
    requests.push({
      authorization: request.headers.authorization,
      method: request.method,
      pathname: url.pathname,
      searchParams: Object.fromEntries(url.searchParams),
    });

    response.setHeader("Content-Type", "application/json");

    if (url.pathname === "/wp-json/wp-abilities/v1/abilities") {
      response.end(JSON.stringify([
        {
          name: "core/get-site-info",
          label: "Get site info",
          description: "Returns fixture site information",
          category: "core",
          input_schema: {
            type: "object",
            properties: {
              context: { type: "string" },
            },
            required: ["context"],
          },
          output_schema: { type: "object" },
          meta: {
            annotations: {
              readonly: true,
              destructive: false,
              idempotent: true,
            },
          },
        },
      ]));
      return;
    }

    if (url.pathname === "/wp-json/wp-abilities/v1/abilities/core/get-site-info") {
      response.end(JSON.stringify({
        name: "core/get-site-info",
        label: "Get site info",
        description: "Returns fixture site information",
        category: "core",
        input_schema: {
          type: "object",
          properties: {
            context: { type: "string" },
          },
        },
        output_schema: { type: "object" },
        meta: { annotations: { readonly: true } },
        _links: {
          "wp:action-run": [{ href: `${fixtureUrl}/fixture/run-site-info` }],
        },
      }));
      return;
    }

    if (url.pathname === "/fixture/run-site-info" && request.method === "GET") {
      response.end(JSON.stringify({ name: "Fixture WordPress", context: "view" }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  fixtureUrl = `http://127.0.0.1:${address.port}`;

  return {
    requests,
    url: fixtureUrl,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

test("initializes and maps WordPress abilities through the MCP protocol", async (t) => {
  const fixture = await startWordPressFixture();
  t.after(() => fixture.close());

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    cwd: projectRoot,
    env: {
      WORDPRESS_URL: fixture.url,
      WORDPRESS_USERNAME: dummyUsername,
      WORDPRESS_APP_PASSWORD: dummyPassword,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "mcp-wp-abilities-test", version: "1.0.0" });
  t.after(() => client.close());

  await client.connect(transport);

  assert.deepEqual(client.getServerVersion(), {
    name: "mcp-wp-abilities",
    version: "1.0.1",
  });
  assert.deepEqual(client.getServerCapabilities(), { tools: {} });

  const listed = await client.listTools();
  assert.deepEqual(listed.tools, [
    {
      name: "wp_core_get_site_info",
      description: "Get site info: Returns fixture site information",
      inputSchema: {
        type: "object",
        properties: {
          context: { type: "string" },
        },
        required: ["context"],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
  ]);

  const called = await client.callTool({
    name: "wp_core_get_site_info",
    arguments: { context: "view" },
  });
  assert.deepEqual(called, {
    content: [
      {
        type: "text",
        text: JSON.stringify({ name: "Fixture WordPress", context: "view" }, null, 2),
      },
    ],
  });

  assert.deepEqual(
    fixture.requests.map(({ method, pathname, searchParams }) => ({ method, pathname, searchParams })),
    [
      {
        method: "GET",
        pathname: "/wp-json/wp-abilities/v1/abilities",
        searchParams: { per_page: "100" },
      },
      {
        method: "GET",
        pathname: "/wp-json/wp-abilities/v1/abilities/core/get-site-info",
        searchParams: {},
      },
      {
        method: "GET",
        pathname: "/fixture/run-site-info",
        searchParams: { input: JSON.stringify({ context: "view" }) },
      },
    ]
  );
  assert.ok(fixture.requests.every(({ authorization }) => authorization === expectedAuthorization));
});

test("fails clearly when required WordPress configuration is missing", async () => {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: {},
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const [exitCode, signal] = await once(child, "exit");

  assert.equal(signal, null);
  assert.equal(exitCode, 1);
  assert.match(
    stderr,
    /Missing required environment variables: WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD/
  );
});
