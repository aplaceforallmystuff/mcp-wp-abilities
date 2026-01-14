# CLAUDE.md - mcp-wp-abilities

MCP server for WordPress 6.9+ Abilities API - dynamically exposes WordPress abilities as AI-accessible tools.

## Tech Stack
- **Language:** TypeScript
- **Runtime:** Node.js (ES modules)
- **Protocol:** Model Context Protocol (MCP)

## Architecture
```
src/
├── index.ts          # Server entry, dynamic tool registration
└── tools/
    └── abilities.ts  # WordPress Abilities API integration
```

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| WORDPRESS_URL | Yes | WordPress site URL |
| WORDPRESS_USERNAME | Yes | WordPress username |
| WORDPRESS_APP_PASSWORD | Yes | WordPress application password |

## Development
```bash
npm run build    # Compile TypeScript
npm run watch    # Watch mode
```

## Constraints
```yaml
rules:
  - id: wp-69-required
    description: Requires WordPress 6.9+ with Abilities API
  - id: dynamic-tools
    description: Tools are discovered at runtime from WordPress
  - id: app-password
    description: Use application passwords, not user passwords
```
