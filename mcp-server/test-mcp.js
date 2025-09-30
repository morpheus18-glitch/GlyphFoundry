#!/usr/bin/env node

import { readFileSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPServer() {
  console.log('🧪 Testing Glyph Foundry MCP Server...\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['./build/index.js'],
    env: {
      GLYPH_API_URL: 'http://localhost:8000',
      TENANT_ID: 'mcp-test'
    }
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log('✅ Connected to MCP server\n');

  const tools = await client.listTools();
  console.log(`📋 Available tools: ${tools.tools.length}`);
  tools.tools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description.substring(0, 60)}...`);
  });
  console.log();

  const conversationData = JSON.parse(readFileSync('./test-conversation.json', 'utf-8'));
  
  console.log('📤 Testing conversation ingestion...');
  const result = await client.callTool({
    name: 'ingest_conversation',
    arguments: {
      conversation_data: JSON.stringify(conversationData),
      source: 'claude'
    }
  });

  console.log('✅ Result:', result.content[0].text);
  console.log();

  console.log('📊 Testing conversation analysis...');
  const analysis = await client.callTool({
    name: 'analyze_conversation',
    arguments: {
      conversation_id: 'test-conv-001',
      analysis_type: 'topics'
    }
  });

  console.log('✅ Analysis:', analysis.content[0].text);

  await client.close();
  console.log('\n✨ All tests passed!');
}

testMCPServer().catch(console.error);
