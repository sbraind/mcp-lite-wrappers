# context7-lite-mcp

Lightweight MCP wrapper for Context7 API - consolidates 2 tools into 1.

## Overview

`context7-lite-mcp` provides up-to-date, version-specific documentation for libraries and frameworks through a single MCP tool. It reduces context usage by ~80% compared to the standard Context7 MCP implementation.

## Features

- **Single Tool Interface**: All Context7 operations through one `context7` tool
- **Action-Based Dispatch**: Use `action` parameter to select operation
- **Full Context7 Coverage**: Support for both library resolution and documentation retrieval
- **Optimized for Claude Code**: Minimal token overhead

## Installation

```bash
npm install context7-lite-mcp
```

## Usage

### Configuration

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "context7-lite-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Note**: The `CONTEXT7_API_KEY` is optional. Without it, you'll have lower rate limits. Get your API key at [context7.com/dashboard](https://context7.com/dashboard).

### Available Actions

#### 1. `resolve_library_id`

Search for libraries by name and get Context7-compatible library IDs.

**Parameters:**
- `libraryName` (required): Name of the library to search for

**Example:**
```json
{
  "action": "resolve_library_id",
  "payload": {
    "libraryName": "next.js"
  }
}
```

#### 2. `get_library_docs`

Fetch up-to-date documentation for a library.

**Parameters:**
- `context7CompatibleLibraryID` (required): Library ID from `resolve_library_id` (e.g., "/vercel/next.js")
- `topic` (optional): Focus docs on specific topic (e.g., "routing", "hooks")
- `tokens` (optional): Maximum tokens to return (default: 5000, min: 1000)

**Example:**
```json
{
  "action": "get_library_docs",
  "payload": {
    "context7CompatibleLibraryID": "/vercel/next.js",
    "topic": "routing",
    "tokens": 5000
  }
}
```

## Workflow

1. First, use `resolve_library_id` to find the library and get its Context7-compatible ID
2. Then, use `get_library_docs` with that ID to fetch the documentation

## Token Savings

- **Standard Context7 MCP**: ~2 tools × 500 tokens = 1,000 tokens
- **context7-lite**: 1 tool × 200 tokens = 200 tokens
- **Savings**: ~80% reduction in context usage

## Architecture

Follows the **superpowers-chrome** pattern:
- Single tool with `action` enum parameter
- Switch/dispatch based on action
- Direct API calls to Context7

## License

MIT

## Links

- [Context7 Documentation](https://context7.com/)
- [Context7 API Guide](https://context7.com/docs/api-guide)
- [MCP Lite Wrappers](https://github.com/sbraind/mcp-lite-wrappers)
