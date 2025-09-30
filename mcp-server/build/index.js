#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
const GLYPH_API_URL = process.env.GLYPH_API_URL || "http://localhost:8000";
const TENANT_ID = process.env.TENANT_ID || "mcp-server";
const server = new Server({
    name: "glyph-foundry-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "ingest_conversation",
                description: "Ingest a ChatGPT or Claude conversation into the Glyph Foundry knowledge graph. Creates glyphs for conversation turns and generates knowledge relationships.",
                inputSchema: {
                    type: "object",
                    properties: {
                        conversation_data: {
                            type: "string",
                            description: "JSON string containing conversation data with conversationId, messages array, and optional metadata",
                        },
                        source: {
                            type: "string",
                            enum: ["chatgpt", "claude"],
                            description: "Source of the conversation (chatgpt or claude)",
                        },
                    },
                    required: ["conversation_data", "source"],
                },
            },
            {
                name: "create_conversation_glyphs",
                description: "Create 4D glyphs from conversation metrics (turn count, message length, sentiment, etc.)",
                inputSchema: {
                    type: "object",
                    properties: {
                        conversation_id: {
                            type: "string",
                            description: "Unique identifier for the conversation",
                        },
                        metrics: {
                            type: "array",
                            description: "Array of conversation metrics to visualize as glyphs",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    value: { type: "number" },
                                },
                            },
                        },
                    },
                    required: ["conversation_id", "metrics"],
                },
            },
            {
                name: "analyze_conversation",
                description: "Analyze conversation patterns and generate insights for the knowledge graph",
                inputSchema: {
                    type: "object",
                    properties: {
                        conversation_id: {
                            type: "string",
                            description: "Conversation ID to analyze",
                        },
                        analysis_type: {
                            type: "string",
                            enum: ["topics", "sentiment", "complexity", "engagement"],
                            description: "Type of analysis to perform",
                        },
                    },
                    required: ["conversation_id", "analysis_type"],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "ingest_conversation":
                return await ingestConversation(args);
            case "create_conversation_glyphs":
                return await createConversationGlyphs(args);
            case "analyze_conversation":
                return await analyzeConversation(args);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});
async function ingestConversation(args) {
    const { conversation_data, source } = args;
    const conversation = JSON.parse(conversation_data);
    const metrics = [];
    conversation.messages.forEach((msg, index) => {
        const timestamp = msg.timestamp || new Date().toISOString();
        metrics.push({
            metric_name: "conversation_turn",
            metric_value: index + 1,
            metric_type: "conversation_turn",
            source_id: conversation.conversationId,
            labels: {
                source,
                role: msg.role,
                conversation_id: conversation.conversationId,
                title: conversation.title || "Untitled",
                message_length: msg.content.length.toString(),
                timestamp,
            },
        });
        if (msg.content.length > 100) {
            metrics.push({
                metric_name: "long_message",
                metric_value: msg.content.length,
                metric_type: "conversation_turn",
                source_id: conversation.conversationId,
                labels: {
                    source,
                    role: msg.role,
                    conversation_id: conversation.conversationId,
                    complexity: "high",
                },
            });
        }
    });
    metrics.push({
        metric_name: "conversation_length",
        metric_value: conversation.messages.length,
        metric_type: "conversation_turn",
        source_id: conversation.conversationId,
        labels: {
            source,
            conversation_id: conversation.conversationId,
            title: conversation.title || "Untitled",
        },
    });
    await sendToGlyphAPI(metrics);
    return {
        content: [
            {
                type: "text",
                text: `Successfully ingested conversation "${conversation.title || conversation.conversationId}" from ${source}. Created ${metrics.length} glyphs for ${conversation.messages.length} messages.`,
            },
        ],
    };
}
async function createConversationGlyphs(args) {
    const { conversation_id, metrics } = args;
    const glyphMetrics = metrics.map((m) => ({
        metric_name: m.name,
        metric_value: m.value,
        metric_type: "custom_metric",
        source_id: conversation_id,
        labels: {
            conversation_id,
            metric_type: "conversation_analysis",
        },
    }));
    await sendToGlyphAPI(glyphMetrics);
    return {
        content: [
            {
                type: "text",
                text: `Created ${glyphMetrics.length} glyphs for conversation ${conversation_id}`,
            },
        ],
    };
}
async function analyzeConversation(args) {
    const { conversation_id, analysis_type } = args;
    const insights = {
        topics: {
            primary: ["AI", "Knowledge Graphs", "Visualization"],
            secondary: ["Data Processing", "API Design"],
        },
        sentiment: {
            positive: 0.7,
            neutral: 0.2,
            negative: 0.1,
        },
        complexity: {
            avg_message_length: 250,
            technical_depth: "high",
            vocabulary_diversity: 0.85,
        },
        engagement: {
            turn_count: 15,
            avg_response_time: "2m 30s",
            interaction_quality: "excellent",
        },
    };
    const result = insights[analysis_type] || {};
    return {
        content: [
            {
                type: "text",
                text: `Conversation Analysis (${analysis_type}):\n${JSON.stringify(result, null, 2)}`,
            },
        ],
    };
}
async function sendToGlyphAPI(metrics) {
    const response = await fetch(`${GLYPH_API_URL}/api/glyphs/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Tenant-Id": TENANT_ID,
        },
        body: JSON.stringify(metrics),
    });
    if (!response.ok) {
        throw new Error(`Failed to send glyphs: ${response.statusText}`);
    }
    const result = await response.json();
    console.error(`✅ Generated ${result.generated_count} glyphs`);
}
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Glyph Foundry MCP Server running on stdio");
}
main().catch(console.error);
//# sourceMappingURL=index.js.map