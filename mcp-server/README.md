# Glyph Foundry MCP Server

Model Context Protocol (MCP) server for ingesting ChatGPT and Claude conversations into the Glyph Foundry knowledge graph and 4D visualization system.

## Features

- **Conversation Ingestion**: Import ChatGPT and Claude conversations directly into knowledge graph
- **Automatic Glyph Generation**: Creates 4D glyphs from conversation metrics
- **Multi-Source Support**: Handles both ChatGPT and Claude conversation formats
- **Knowledge Graph Integration**: Automatically creates nodes and relationships
- **Conversation Analysis**: Extract topics, sentiment, complexity, and engagement metrics

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GLYPH_API_URL` | `http://localhost:8000` | Glyph Foundry API endpoint |
| `TENANT_ID` | `mcp-server` | Tenant identifier for multi-tenancy |

### Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "glyph-foundry": {
      "command": "node",
      "args": ["/path/to/glyph-foundry/mcp-server/build/index.js"],
      "env": {
        "GLYPH_API_URL": "http://localhost:8000",
        "TENANT_ID": "claude-conversations"
      }
    }
  }
}
```

Then restart Claude Desktop.

## Usage

### Tool 1: Ingest Conversation

Imports a full conversation into the knowledge graph:

```typescript
{
  "conversation_data": "{\"conversationId\":\"conv-123\",\"title\":\"AI Discussion\",\"messages\":[{\"role\":\"user\",\"content\":\"Tell me about knowledge graphs\",\"timestamp\":\"2025-09-30T10:00:00Z\"},{\"role\":\"assistant\",\"content\":\"Knowledge graphs are...\",\"timestamp\":\"2025-09-30T10:01:00Z\"}]}",
  "source": "claude"
}
```

**Creates:**
- Glyph for each conversation turn
- Glyphs for long messages (>100 chars)
- Overall conversation length glyph
- Automatic 4D spatial positioning

### Tool 2: Create Conversation Glyphs

Generate custom glyphs from conversation metrics:

```typescript
{
  "conversation_id": "conv-123",
  "metrics": [
    {"name": "user_questions", "value": 5},
    {"name": "assistant_responses", "value": 5},
    {"name": "avg_response_length", "value": 350}
  ]
}
```

### Tool 3: Analyze Conversation

Extract insights from conversations:

```typescript
{
  "conversation_id": "conv-123",
  "analysis_type": "topics"  // or "sentiment", "complexity", "engagement"
}
```

## Conversation Data Format

### ChatGPT Format
```json
{
  "conversationId": "chatgpt-abc-123",
  "title": "Discussion about AI",
  "messages": [
    {
      "role": "user",
      "content": "What is machine learning?",
      "timestamp": "2025-09-30T10:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "Machine learning is...",
      "timestamp": "2025-09-30T10:01:00Z"
    }
  ],
  "metadata": {
    "source": "chatgpt",
    "model": "gpt-4",
    "created_at": "2025-09-30T10:00:00Z"
  }
}
```

### Claude Format
```json
{
  "conversationId": "claude-xyz-789",
  "title": "Code Review Discussion",
  "messages": [
    {
      "role": "user",
      "content": "Can you review this code?",
      "timestamp": "2025-09-30T11:00:00Z"
    },
    {
      "role": "assistant",
      "content": "I'll review your code...",
      "timestamp": "2025-09-30T11:02:00Z"
    }
  ],
  "metadata": {
    "source": "claude",
    "model": "claude-3-5-sonnet",
    "created_at": "2025-09-30T11:00:00Z"
  }
}
```

## Glyph Visualization

Ingested conversations are visualized as 4D glyphs:

- **X, Y, Z**: Spatial position (deterministic based on conversation ID)
- **T (Time)**: Message timestamp
- **Type**: `conversation_turn` for message glyphs
- **Color/Size**: Based on message role, length, complexity

## Integration with Knowledge Graph

The MCP server automatically:

1. Creates conversation nodes in the knowledge graph
2. Links messages as edges between user/assistant
3. Extracts topics and creates topic nodes
4. Generates sentiment and engagement metrics
5. Positions everything in 4D space for visualization

## Development

```bash
# Watch mode
npm run watch

# Build
npm run build

# Run locally
npm run dev
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector build/index.js
```

## Architecture

```
Claude/ChatGPT Conversation
         ↓
    MCP Server
    (stdio transport)
         ↓
   Conversation Parser
   & Metrics Extractor
         ↓
    Glyph API Client
         ↓
  Glyph Foundry API
         ↓
  4D Visualization
  & Knowledge Graph
```

## Protocol Support

- **MCP Version**: 2025-06-18
- **Transport**: stdio (stdin/stdout)
- **Message Format**: JSON-RPC 2.0
- **Tools**: 3 (ingest_conversation, create_conversation_glyphs, analyze_conversation)
- **Resources**: None (conversation data provided via tool arguments)
- **Prompts**: None

## Security

- All API calls authenticated via `X-Tenant-Id` header
- Conversation data validated before processing
- No persistent storage of conversation content (flows to knowledge graph only)
- Configurable tenant isolation for multi-user deployments

## Troubleshooting

**Issue**: MCP server not appearing in Claude Desktop
- Ensure path to build/index.js is absolute
- Check Claude Desktop config JSON is valid
- Restart Claude Desktop after config changes

**Issue**: Glyphs not appearing in visualization
- Verify GLYPH_API_URL points to running backend
- Check backend logs for generation errors
- Ensure conversation_data JSON is properly formatted

**Issue**: "Module not found" errors
- Run `npm install` in mcp-server directory
- Ensure TypeScript compilation succeeded: `npm run build`
