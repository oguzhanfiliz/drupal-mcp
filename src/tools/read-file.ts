import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';
import type { PathGuard } from '../security/path-guard.js';

export const ReadFileSchema = z.object({
  site: z.string().describe('DDEV site name'),
  path: z.string().describe('File path relative to Drupal root'),
  start_line: z.number().optional().describe('Start line (1-indexed)'),
  end_line: z.number().optional().describe('End line (1-indexed)'),
});

export type ReadFileParams = z.infer<typeof ReadFileSchema>;

const MAX_LINES = 200;

export async function readFile(
  params: ReadFileParams,
  siteManager: SiteManager,
  redactor: Redactor,
  pathGuard: PathGuard,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  // Validate path
  const check = pathGuard.validatePath(params.path, site.path);
  if (!check.valid) {
    throw new Error(`Access denied: ${check.reason}`);
  }

  const fullPath = path.resolve(site.path, params.path);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${params.path}`);
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${params.path}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  let lines = content.split('\n');

  const totalLines = lines.length;
  const startLine = params.start_line ? Math.max(1, params.start_line) : 1;
  const endLine = params.end_line
    ? Math.min(totalLines, params.end_line)
    : Math.min(totalLines, startLine + MAX_LINES - 1);

  if (endLine - startLine + 1 > MAX_LINES) {
    throw new Error(`Requested range exceeds max ${MAX_LINES} lines. Use start_line/end_line to paginate.`);
  }

  lines = lines.slice(startLine - 1, endLine);

  const numberedLines = lines.map(
    (line, i) => `${startLine + i}: ${line}`,
  );

  const redacted = redactor.redact(numberedLines.join('\n'));

  return JSON.stringify({
    file: params.path,
    total_lines: totalLines,
    showing: { start: startLine, end: endLine },
    content: redacted,
  }, null, 2);
}
