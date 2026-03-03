import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const ListComponentsSchema = z.object({
  site: z.string().describe('DDEV site name'),
  type: z.enum(['modules', 'themes', 'all']).optional().default('all').describe('Component type to list'),
});

export type ListComponentsParams = z.infer<typeof ListComponentsSchema>;

interface ComponentInfo {
  name: string;
  machine_name: string;
  type: string;
  description?: string;
  package?: string;
  version?: string;
  core_version_requirement?: string;
  dependencies?: string[];
  routes_count?: number;
}

function parseInfoYaml(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = content.split('\n');

  let currentKey = '';
  let inArray = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && inArray && currentKey) {
      const arr = result[currentKey];
      if (Array.isArray(arr)) {
        arr.push(trimmed.slice(2).trim());
      }
      continue;
    }

    const match = trimmed.match(/^([^:]+):\s*(.*)/);
    if (match) {
      currentKey = match[1]!.trim();
      const value = match[2]!.trim();

      if (value === '') {
        result[currentKey] = [];
        inArray = true;
      } else {
        result[currentKey] = value.replace(/^['"]|['"]$/g, '');
        inArray = false;
      }
    }
  }

  return result;
}

function scanComponents(basePath: string, type: string): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  if (!fs.existsSync(basePath)) return components;

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const componentDir = path.join(basePath, entry.name);
    const infoFiles = fs.readdirSync(componentDir).filter((f) => f.endsWith('.info.yml'));

    for (const infoFile of infoFiles) {
      try {
        const content = fs.readFileSync(path.join(componentDir, infoFile), 'utf-8');
        const info = parseInfoYaml(content);

        // Count routes
        let routesCount = 0;
        const routingFile = infoFile.replace('.info.yml', '.routing.yml');
        const routingPath = path.join(componentDir, routingFile);
        if (fs.existsSync(routingPath)) {
          const routingContent = fs.readFileSync(routingPath, 'utf-8');
          routesCount = (routingContent.match(/^\S+:/gm) || []).length;
        }

        components.push({
          name: String(info['name'] || entry.name),
          machine_name: infoFile.replace('.info.yml', ''),
          type,
          description: info['description'] ? String(info['description']) : undefined,
          package: info['package'] ? String(info['package']) : undefined,
          version: info['version'] ? String(info['version']) : undefined,
          core_version_requirement: info['core_version_requirement']
            ? String(info['core_version_requirement'])
            : undefined,
          dependencies: Array.isArray(info['dependencies']) ? info['dependencies'] : undefined,
          routes_count: routesCount,
        });
      } catch {
        // Skip unparseable info files
      }
    }
  }

  return components;
}

export async function listComponents(
  params: ListComponentsParams,
  siteManager: SiteManager,
  _redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const results: ComponentInfo[] = [];

  if (params.type === 'modules' || params.type === 'all') {
    const modulesPath = path.join(site.path, 'web', 'modules', 'custom');
    results.push(...scanComponents(modulesPath, 'module'));
  }

  if (params.type === 'themes' || params.type === 'all') {
    const themesPath = path.join(site.path, 'web', 'themes', 'custom');
    results.push(...scanComponents(themesPath, 'theme'));
  }

  return JSON.stringify({
    site: params.site,
    total: results.length,
    components: results,
  }, null, 2);
}
