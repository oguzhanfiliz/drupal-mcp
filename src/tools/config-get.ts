import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const ConfigGetSchema = z.object({
  site: z.string().describe('DDEV site name'),
  keys_or_prefix: z.string().describe('Config key or prefix to search (e.g. "system.site" or "views.")'),
  source: z.enum(['sync', 'db']).optional().default('sync').describe('Config source: sync (filesystem) or db (via drush)'),
});

export type ConfigGetParams = z.infer<typeof ConfigGetSchema>;

function listConfigFiles(syncDir: string, prefix: string): string[] {
  if (!fs.existsSync(syncDir)) return [];

  const files = fs.readdirSync(syncDir).filter((f) => f.endsWith('.yml'));

  if (prefix) {
    return files.filter((f) => f.startsWith(prefix) || f.replace('.yml', '') === prefix);
  }

  return files;
}

async function resolveConfigSyncDir(sitePath: string, siteManager: SiteManager): Promise<string> {
  // Try common locations first
  const commonPaths = [
    path.join(sitePath, 'config', 'sync'),
    path.join(sitePath, 'config'),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p) && fs.readdirSync(p).some((f: string) => f.endsWith('.yml'))) {
      return p;
    }
  }

  // Auto-detect via drush core:status
  try {
    const ddev = siteManager.getDdev();
    const result = await ddev.drush(sitePath, 'core:status', ['--format=json']);
    if (result.exitCode === 0) {
      const status = JSON.parse(result.stdout);
      const configSync = status['config-sync'] as string | undefined;
      if (configSync) {
        // configSync is container-internal (e.g. "sites/default/files/config_XXX/sync")
        // Map to host by prepending sitePath/web/ (since docroot is typically "web")
        const hostPath = path.join(sitePath, 'web', configSync);
        if (fs.existsSync(hostPath)) {
          return hostPath;
        }
        // Also try without "web/" prefix in case docroot differs
        const altPath = path.join(sitePath, configSync);
        if (fs.existsSync(altPath)) {
          return altPath;
        }
      }
    }
  } catch {
    // Fall through to default
  }

  // Fallback: scan for config directories with yml files
  const webSitesDefault = path.join(sitePath, 'web', 'sites', 'default', 'files');
  if (fs.existsSync(webSitesDefault)) {
    const entries = fs.readdirSync(webSitesDefault, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('config_')) {
        const syncPath = path.join(webSitesDefault, entry.name, 'sync');
        if (fs.existsSync(syncPath)) {
          return syncPath;
        }
      }
    }
  }

  return path.join(sitePath, 'config', 'sync');
}

export async function configGet(
  params: ConfigGetParams,
  siteManager: SiteManager,
  redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  if (params.source === 'db') {
    // Use drush to get config from database
    const ddev = siteManager.getDdev();
    const result = await ddev.drush(site.path, 'config:get', [params.keys_or_prefix, '--format=json']);

    if (result.exitCode !== 0) {
      throw new Error(`Drush config:get failed: ${result.stderr}`);
    }

    return JSON.stringify({
      source: 'database',
      key: params.keys_or_prefix,
      value: redactor.redact(result.stdout),
    }, null, 2);
  }

  // Resolve config sync directory (auto-detect from drush or scan filesystem)
  const configSyncDir = site.config_sync_dir
    ? path.join(site.path, site.config_sync_dir)
    : await resolveConfigSyncDir(site.path, siteManager);

  const files = listConfigFiles(configSyncDir, params.keys_or_prefix);

  if (files.length === 0) {
    // Try exact match
    const exactFile = `${params.keys_or_prefix}.yml`;
    const exactPath = path.join(configSyncDir, exactFile);
    if (fs.existsSync(exactPath)) {
      const content = fs.readFileSync(exactPath, 'utf-8');
      return JSON.stringify({
        source: 'sync',
        key: params.keys_or_prefix,
        content: redactor.redact(content),
      }, null, 2);
    }

    return JSON.stringify({
      source: 'sync',
      key: params.keys_or_prefix,
      error: 'No matching config files found',
      config_sync_dir: configSyncDir,
    }, null, 2);
  }

  if (files.length === 1) {
    const content = fs.readFileSync(path.join(configSyncDir, files[0]!), 'utf-8');
    return JSON.stringify({
      source: 'sync',
      key: files[0]!.replace('.yml', ''),
      content: redactor.redact(content),
    }, null, 2);
  }

  // Multiple matches - return list
  const configs: Record<string, string> = {};
  const maxFiles = 10;

  for (const file of files.slice(0, maxFiles)) {
    const content = fs.readFileSync(path.join(configSyncDir, file), 'utf-8');
    configs[file.replace('.yml', '')] = redactor.redact(content);
  }

  return JSON.stringify({
    source: 'sync',
    prefix: params.keys_or_prefix,
    total_matches: files.length,
    showing: Math.min(files.length, maxFiles),
    configs,
  }, null, 2);
}
