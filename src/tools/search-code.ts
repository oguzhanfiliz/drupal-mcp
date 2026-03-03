import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';
import type { PathGuard } from '../security/path-guard.js';

const execFileAsync = promisify(execFile);

export const SearchCodeSchema = z.object({
  site: z.string().describe('DDEV site name'),
  query: z.string().describe('Search query (text or regex)'),
  paths: z.array(z.string()).optional().describe('Restrict search to these paths (relative to Drupal root)'),
  regex: z.boolean().optional().default(false).describe('Treat query as regex'),
  max_results: z.number().optional().default(20).describe('Maximum number of results'),
});

export type SearchCodeParams = z.infer<typeof SearchCodeSchema>;

async function hasCommand(cmd: string): Promise<boolean> {
  try {
    await execFileAsync('which', [cmd], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function searchWithRg(
  query: string,
  searchDirs: string[],
  sitePath: string,
  redactor: Redactor,
  maxResults: number,
  useRegex: boolean,
): Promise<Array<{ file: string; line: number; text: string }>> {
  const rgArgs: string[] = [
    '--json',
    '--max-count', String(maxResults),
    '--max-columns', '200',
  ];

  if (!useRegex) {
    rgArgs.push('--fixed-strings');
  }

  rgArgs.push(query, ...searchDirs);

  const { stdout } = await execFileAsync('rg', rgArgs, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });

  const lines = stdout.trim().split('\n').filter(Boolean);
  const results: Array<{ file: string; line: number; text: string }> = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'match') {
        const data = entry.data;
        const filePath = path.relative(sitePath, data.path.text);
        results.push({
          file: filePath,
          line: data.line_number,
          text: redactor.redact(data.lines.text.trimEnd()),
        });
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return results;
}

async function searchWithGrep(
  query: string,
  searchDirs: string[],
  sitePath: string,
  redactor: Redactor,
  maxResults: number,
  useRegex: boolean,
): Promise<Array<{ file: string; line: number; text: string }>> {
  const grepArgs: string[] = [
    '-r', '-n', '--include=*.php', '--include=*.module', '--include=*.theme',
    '--include=*.yml', '--include=*.yaml', '--include=*.twig', '--include=*.js',
    '--include=*.ts', '--include=*.css', '--include=*.txt', '--include=*.md',
    '-m', String(maxResults),
  ];

  if (!useRegex) {
    grepArgs.push('-F');
  }

  grepArgs.push(query, ...searchDirs);

  const { stdout } = await execFileAsync('grep', grepArgs, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });

  const lines = stdout.trim().split('\n').filter(Boolean);
  const results: Array<{ file: string; line: number; text: string }> = [];

  for (const line of lines) {
    // grep output format: /full/path/file.php:42:matched line text
    const match = line.match(/^(.+?):(\d+):(.*)$/);
    if (match) {
      results.push({
        file: path.relative(sitePath, match[1]!),
        line: parseInt(match[2]!, 10),
        text: redactor.redact(match[3]!.trimEnd()),
      });
    }
  }

  return results;
}

export async function searchCode(
  params: SearchCodeParams,
  siteManager: SiteManager,
  redactor: Redactor,
  pathGuard: PathGuard,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const searchPaths = params.paths || ['web/modules/custom', 'web/themes/custom'];

  // Validate all search paths
  for (const sp of searchPaths) {
    const check = pathGuard.validatePath(path.join(sp, 'dummy.php'), site.path);
    if (!check.valid) {
      throw new Error(`Path '${sp}' not allowed: ${check.reason}`);
    }
  }

  const searchDirs = searchPaths.map((sp) => path.join(site.path, sp));
  const useRg = await hasCommand('rg');

  try {
    const results = useRg
      ? await searchWithRg(params.query, searchDirs, site.path, redactor, params.max_results, params.regex)
      : await searchWithGrep(params.query, searchDirs, site.path, redactor, params.max_results, params.regex);

    return JSON.stringify({
      query: params.query,
      engine: useRg ? 'ripgrep' : 'grep',
      total_matches: results.length,
      results: results.slice(0, params.max_results),
    }, null, 2);
  } catch (err: unknown) {
    const error = err as { code?: number; stdout?: string; stderr?: string };
    // Both rg and grep return exit code 1 when no matches found
    if (error.code === 1) {
      return JSON.stringify({ query: params.query, total_matches: 0, results: [] }, null, 2);
    }
    throw new Error(`Search failed: ${error.stderr || String(err)}`);
  }
}
