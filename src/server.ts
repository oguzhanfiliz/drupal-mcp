import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { loadConfig } from './config/loader.js';
import type { AppConfig } from './config/types.js';
import { Redactor } from './security/redaction.js';
import { PathGuard } from './security/path-guard.js';
import { RBAC } from './security/rbac.js';
import { AuditLogger } from './security/audit.js';
import { RateLimiter } from './security/rate-limiter.js';
import { SiteManager } from './sites/manager.js';

import { projectInfo, ProjectInfoSchema } from './tools/project-info.js';
import { searchCode, SearchCodeSchema } from './tools/search-code.js';
import { readFile, ReadFileSchema } from './tools/read-file.js';
import { listComponents, ListComponentsSchema } from './tools/list-components.js';
import { configGet, ConfigGetSchema } from './tools/config-get.js';
import { dbSchema, DbSchemaSchema } from './tools/db-schema.js';
import { drush, DrushSchema } from './tools/drush.js';
import { entitySchema, EntitySchemaSchema } from './tools/entity-schema.js';
import { viewExport, ViewExportSchema } from './tools/view-export.js';

export interface ServerContext {
  config: AppConfig;
  redactor: Redactor;
  pathGuard: PathGuard;
  rbac: RBAC;
  audit: AuditLogger;
  rateLimiter: RateLimiter;
  siteManager: SiteManager;
}

function truncateResponse(text: string, maxSize: number): string {
  if (text.length <= maxSize) return text;
  return text.slice(0, maxSize) + '\n\n... [TRUNCATED - response exceeded max size]';
}

export async function createServer(configPath?: string): Promise<{ server: McpServer; context: ServerContext }> {
  const config = loadConfig(configPath);

  const redactor = new Redactor(config.security);
  const pathGuard = new PathGuard(config.security);
  const rbac = new RBAC(config.rbac);
  const audit = new AuditLogger(config.audit);
  const rateLimiter = new RateLimiter(config.server.rate_limit_rpm);
  const siteManager = new SiteManager(config.sites);

  // Initialize site discovery
  await siteManager.initialize();

  const context: ServerContext = {
    config,
    redactor,
    pathGuard,
    rbac,
    audit,
    rateLimiter,
    siteManager,
  };

  const server = new McpServer({
    name: 'drupal-mcp-server',
    version: '1.0.0',
  });

  // Helper: wrap tool handler with audit, rate limit, response truncation
  function wrapTool<T>(
    toolName: string,
    handler: (params: T) => Promise<string>,
  ): (params: T) => Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    return async (params: T) => {
      const startTime = Date.now();

      // Rate limit check
      const rateCheck = rateLimiter.check(toolName);
      if (!rateCheck.allowed) {
        audit.log({
          timestamp: new Date().toISOString(),
          tool: toolName,
          params: params as Record<string, unknown>,
          status: 'denied',
          message: `Rate limited. Retry after ${rateCheck.retryAfterMs}ms`,
        });
        throw new Error(`Rate limited. Retry after ${rateCheck.retryAfterMs}ms`);
      }

      try {
        const result = await handler(params);
        const truncated = truncateResponse(result, config.server.max_response_size);

        audit.log({
          timestamp: new Date().toISOString(),
          tool: toolName,
          params: params as Record<string, unknown>,
          status: 'success',
          duration_ms: Date.now() - startTime,
        });

        return {
          content: [{ type: 'text' as const, text: truncated }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        audit.log({
          timestamp: new Date().toISOString(),
          tool: toolName,
          params: params as Record<string, unknown>,
          status: 'error',
          message,
          duration_ms: Date.now() - startTime,
        });
        throw err;
      }
    };
  }

  // Register tools

  server.tool(
    'drupal_list_sites',
    'List all discovered DDEV Drupal sites',
    {},
    wrapTool('drupal_list_sites', async () => {
      const sites = siteManager.listSites();
      return JSON.stringify({ total: sites.length, sites }, null, 2);
    }),
  );

  server.tool(
    'drupal_refresh_sites',
    'Re-discover DDEV Drupal sites',
    {},
    wrapTool('drupal_refresh_sites', async () => {
      await siteManager.refresh();
      const sites = siteManager.listSites();
      return JSON.stringify({ total: sites.length, sites }, null, 2);
    }),
  );

  server.tool(
    'drupal_project_info',
    'Get Drupal project info: core version, enabled modules/themes, environment',
    { site: z.string().describe('DDEV site name') },
    wrapTool('drupal_project_info', (params) =>
      projectInfo(ProjectInfoSchema.parse(params), siteManager, redactor),
    ),
  );

  server.tool(
    'drupal_search_code',
    'Search custom code using ripgrep',
    {
      site: z.string().describe('DDEV site name'),
      query: z.string().describe('Search query'),
      paths: z.array(z.string()).optional().describe('Restrict to paths'),
      regex: z.boolean().optional().describe('Treat as regex'),
      max_results: z.number().optional().describe('Max results (default 20)'),
    },
    wrapTool('drupal_search_code', (params) =>
      searchCode(SearchCodeSchema.parse(params), siteManager, redactor, pathGuard),
    ),
  );

  server.tool(
    'drupal_read_file',
    'Read a file from the Drupal project (with secret/PII masking)',
    {
      site: z.string().describe('DDEV site name'),
      path: z.string().describe('File path relative to Drupal root'),
      start_line: z.number().optional().describe('Start line'),
      end_line: z.number().optional().describe('End line'),
    },
    wrapTool('drupal_read_file', (params) =>
      readFile(ReadFileSchema.parse(params), siteManager, redactor, pathGuard),
    ),
  );

  server.tool(
    'drupal_list_custom_components',
    'List custom modules and themes with info.yml details',
    {
      site: z.string().describe('DDEV site name'),
      type: z.enum(['modules', 'themes', 'all']).optional().describe('Component type'),
    },
    wrapTool('drupal_list_custom_components', (params) =>
      listComponents(ListComponentsSchema.parse(params), siteManager, redactor),
    ),
  );

  server.tool(
    'drupal_config_get',
    'Get Drupal configuration from sync directory or database',
    {
      site: z.string().describe('DDEV site name'),
      keys_or_prefix: z.string().describe('Config key or prefix'),
      source: z.enum(['sync', 'db']).optional().describe('Config source'),
    },
    wrapTool('drupal_config_get', (params) =>
      configGet(ConfigGetSchema.parse(params), siteManager, redactor),
    ),
  );

  server.tool(
    'drupal_db_schema',
    'Inspect database schema: tables, columns, indexes, FK, PII tags',
    {
      site: z.string().describe('DDEV site name'),
      table: z.string().optional().describe('Table name (omit to list all)'),
    },
    wrapTool('drupal_db_schema', (params) =>
      dbSchema(DbSchemaSchema.parse(params), siteManager, redactor),
    ),
  );

  server.tool(
    'drupal_drush',
    'Execute a drush command (safe_mode enforces allowlist)',
    {
      site: z.string().describe('DDEV site name'),
      command: z.string().describe('Drush command'),
      args: z.array(z.string()).optional().describe('Arguments'),
      safe_mode: z.boolean().optional().describe('Enforce allowlist (default true)'),
    },
    wrapTool('drupal_drush', (params) =>
      drush(DrushSchema.parse(params), siteManager, redactor, config.drush),
    ),
  );

  server.tool(
    'drupal_entity_schema_summary',
    'Get content model summary: content types, fields, paragraphs, vocabularies',
    { site: z.string().describe('DDEV site name') },
    wrapTool('drupal_entity_schema_summary', (params) =>
      entitySchema(EntitySchemaSchema.parse(params), siteManager, redactor),
    ),
  );

  server.tool(
    'drupal_view_export',
    'List views or export a specific view configuration',
    {
      site: z.string().describe('DDEV site name'),
      name: z.string().optional().describe('View machine name'),
    },
    wrapTool('drupal_view_export', (params) =>
      viewExport(ViewExportSchema.parse(params), siteManager, redactor),
    ),
  );

  return { server, context };
}
