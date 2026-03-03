import { z } from 'zod';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const ViewExportSchema = z.object({
  site: z.string().describe('DDEV site name'),
  name: z.string().optional().describe('View machine name (omit to list all views)'),
});

export type ViewExportParams = z.infer<typeof ViewExportSchema>;

export async function viewExport(
  params: ViewExportParams,
  siteManager: SiteManager,
  redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const ddev = siteManager.getDdev();

  if (!params.name) {
    // List all views
    const result = await ddev.drush(site.path, 'php:eval', [
      `
      $views = \\Drupal::entityTypeManager()->getStorage('view')->loadMultiple();
      $result = [];
      foreach ($views as $view) {
        $result[] = [
          'id' => $view->id(),
          'label' => $view->label(),
          'status' => $view->status(),
          'tag' => $view->get('tag'),
          'base_table' => $view->get('base_table'),
        ];
      }
      echo json_encode($result, JSON_PRETTY_PRINT);
      `,
    ]);

    let views: unknown[] = [];
    try {
      views = JSON.parse(result.stdout);
    } catch {
      return JSON.stringify({ error: 'Failed to parse views list', raw: redactor.redact(result.stdout) });
    }

    return JSON.stringify({
      site: params.site,
      total_views: Array.isArray(views) ? views.length : 0,
      views,
    }, null, 2);
  }

  // Export specific view
  const result = await ddev.drush(site.path, 'config:get', [`views.view.${params.name}`, '--format=json']);

  if (result.exitCode !== 0) {
    throw new Error(`View '${params.name}' not found or drush failed: ${result.stderr}`);
  }

  return JSON.stringify({
    site: params.site,
    view_name: params.name,
    export: redactor.redact(result.stdout),
  }, null, 2);
}
