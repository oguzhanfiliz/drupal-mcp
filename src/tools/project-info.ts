import { z } from 'zod';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const ProjectInfoSchema = z.object({
  site: z.string().describe('DDEV site name'),
});

export type ProjectInfoParams = z.infer<typeof ProjectInfoSchema>;

export async function projectInfo(
  params: ProjectInfoParams,
  siteManager: SiteManager,
  redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const ddev = siteManager.getDdev();

  // Get core status via drush
  const coreStatus = await ddev.drush(site.path, 'core:status', ['--format=json']);
  let coreInfo: Record<string, unknown> = {};
  try {
    coreInfo = JSON.parse(coreStatus.stdout);
  } catch {
    coreInfo = { raw: coreStatus.stdout };
  }

  // Get enabled modules
  const pmList = await ddev.drush(site.path, 'pm:list', ['--status=enabled', '--format=json']);
  let modules: Record<string, unknown> = {};
  try {
    modules = JSON.parse(pmList.stdout);
  } catch {
    modules = { raw: pmList.stdout };
  }

  const enabledModules = Object.keys(modules);

  const result = {
    site_name: redactor.redact(String(coreInfo['site'] || site.name)),
    drupal_version: coreInfo['drupal-version'] || 'unknown',
    php_version: coreInfo['php-version'] || 'unknown',
    database: coreInfo['db-driver'] || 'unknown',
    environment: site.environment || 'unknown',
    ddev_status: site.status || 'unknown',
    enabled_modules_count: enabledModules.length,
    enabled_modules: enabledModules.slice(0, 50),
    config_sync_dir: coreInfo['config-sync'] || site.config_sync_dir || 'unknown',
  };

  return JSON.stringify(result, null, 2);
}
