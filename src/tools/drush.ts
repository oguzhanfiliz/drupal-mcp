import { z } from 'zod';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';
import type { DrushConfig } from '../config/types.js';

export const DrushSchema = z.object({
  site: z.string().describe('DDEV site name'),
  command: z.string().describe('Drush command (e.g. pm:list, cget, core:status)'),
  args: z.array(z.string()).optional().default([]).describe('Additional arguments'),
  safe_mode: z.boolean().optional().default(true).describe('Enforce command allowlist'),
});

export type DrushParams = z.infer<typeof DrushSchema>;

export async function drush(
  params: DrushParams,
  siteManager: SiteManager,
  redactor: Redactor,
  drushConfig: DrushConfig,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const safeMode = params.safe_mode ?? drushConfig.safe_mode;

  if (safeMode) {
    const baseCommand = params.command.split(' ')[0]!;
    if (!drushConfig.allowed_commands.includes(baseCommand)) {
      throw new Error(
        `Command '${baseCommand}' not in allowlist. Allowed: ${drushConfig.allowed_commands.join(', ')}`,
      );
    }
  }

  const ddev = siteManager.getDdev();
  const result = await ddev.drush(site.path, params.command, params.args);

  return JSON.stringify({
    site: params.site,
    command: params.command,
    args: params.args,
    exit_code: result.exitCode,
    stdout: redactor.redact(result.stdout),
    stderr: result.stderr ? redactor.redact(result.stderr) : undefined,
  }, null, 2);
}
