# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security

- Updated `@modelcontextprotocol/sdk` from `^1.29.0` to `^1.32.2`, with updates to its locked transitive dependencies (including `hono`, `@hono/node-server`, `body-parser`, `proxy-addr`, `ip-address`, `qs` and `zod`)

### Added

- Local MCP protocol tests (`npm test`) that start the compiled server over stdio against a WordPress fixture server and check the handshake, tool listing and naming, a tool call, request authentication and the missing-configuration error
- `CONTRIBUTING.md`

### Changed

- Rewrote the README with the standard MCP server sections: why use it, features, prerequisites, source installation, Claude Desktop and Claude Code configuration, usage examples, development, troubleshooting and links
- Documented dynamic tool naming (`wp_` plus the ability name, with `/` and `-` replaced by `_`), its known limitations, and the example tools as site-dependent
- Extended the license copyright to 2025-2026

### Known issues

- The locked transitive dependency `@hono/node-server` 2.1.7 declares `node >=20`. The package still declares `>=18.0.0`, and an install on Node 18 with `engine-strict` enabled may be rejected. Node 18 build and startup checks passed; protocol tests ran on Node 26, with no live WordPress checks.

## [1.0.1] - 2025-12-03

### Changed

- Renamed package from mcp-wordpress to mcp-wp-abilities for clarity
- Updated repository URLs after rename

## [1.0.0] - 2025-12-03

### Added

- Initial release
- Dynamic ability discovery from WordPress 6.9+ Abilities API
- Automatic tool generation from discovered abilities
- JSON Schema validation for inputs
- Smart HTTP method selection (GET for readonly, POST for mutations)
- Tool annotations (readOnlyHint, destructiveHint, idempotentHint)
- Support for all WordPress core abilities
- Extensible - any plugin-registered abilities automatically available
