# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
