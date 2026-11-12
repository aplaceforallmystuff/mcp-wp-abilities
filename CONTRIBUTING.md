# Contributing to MCP WordPress Abilities Server

Thanks for helping. This server is small: `src/index.ts` holds the whole implementation, and the tests run against a local fixture, so you do not need a WordPress site to contribute.

## Getting Started

1. Fork the repository on GitHub and clone your fork:

   ```bash
   git clone https://github.com/YOUR-USERNAME/mcp-wp-abilities.git
   cd mcp-wp-abilities
   ```

2. Install dependencies. Node.js 20 or later is the safest choice for development, because a locked transitive dependency (`@hono/node-server` 2.1.7) declares `node >=20`. The package still declares `>=18.0.0`; see the Node 18 note in the [README](README.md#prerequisites).

   ```bash
   npm install
   ```

3. Create a branch from `main`:

   ```bash
   git checkout -b my-change
   ```

## Development

```bash
npm run build   # Compile TypeScript to dist/
npm run dev     # Recompile on change (tsc --watch)
npm test        # Build, then run the MCP protocol tests in test/
npm start       # Run the compiled server (needs the WordPress environment variables)
```

`npm test` starts the compiled server over stdio and points it at a fixture HTTP server that imitates the WordPress Abilities API. Use dummy credentials in tests and examples, never real site details.

To try the server against a real site, set `WORDPRESS_URL`, `WORDPRESS_USERNAME` and `WORDPRESS_APP_PASSWORD` in your shell, then connect it to an MCP client as the README describes. Use a throwaway user, and do not commit anything from that session.

## Adding New Tools

This server has no hand-written tools. Every tool comes from an ability that a WordPress site registers, so most "new tools" belong in WordPress or a plugin, not here. See "Extending with Custom Abilities" in the [README](README.md#extending-with-custom-abilities).

Change this repository when the way abilities become tools needs to change, for example name mapping, input handling, request methods or annotations. These live in `src/index.ts`:

- `abilityToToolName` and `toolNameToAbility` map between ability names and tool names. They must stay consistent with each other; the README lists the current limitation.
- `convertInputSchema` turns an ability's input schema into an MCP schema.
- `executeAbility` chooses GET or POST and builds the request.

Add or update a test in `test/` for any behavior change, and update the README's Available Tools section and `CHANGELOG.md` under `Unreleased`.

## Code Style

- TypeScript with ES modules, as in the existing code. Run `npm run build` and `npx tsc --noEmit`; both must pass.
- Match the surrounding style. Keep changes focused, and do not mix unrelated cleanups into a fix.
- Never hardcode a site URL, username or password. Configuration comes from the three environment variables.
- Report problems to the MCP client with a clear message, and do not return raw credentials or full response bodies from errors you add.

## Submitting Changes

1. Run `npm test` and `npm audit --audit-level=high` and fix what they report.
2. Update `README.md` and `CHANGELOG.md` when the change affects users.
3. Commit with a short message that says what changed and why.
4. Push your branch and open a pull request against `main`. Describe the change, how you checked it, and anything you could not check (for example, "not tried on a live WordPress site").

CI builds and type-checks the project on Node 18, 20 and 22. Versioning and publishing are handled by the maintainer, so please do not bump the version in your pull request.

To report a security issue, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
