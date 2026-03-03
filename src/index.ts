#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const configPath = process.argv[2] || undefined;

  process.stderr.write('[drupal-mcp-server] Starting...\n');

  const { server, context } = await createServer(configPath);

  const sites = context.siteManager.listSites();
  process.stderr.write(`[drupal-mcp-server] Discovered ${sites.length} site(s): ${sites.map((s) => s.name).join(', ')}\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[drupal-mcp-server] Connected via stdio. Ready.\n');
}

main().catch((err) => {
  process.stderr.write(`[drupal-mcp-server] Fatal: ${err}\n`);
  process.exit(1);
});
