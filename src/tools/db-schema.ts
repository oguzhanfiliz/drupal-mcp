import { z } from 'zod';
import type { SiteManager } from '../sites/manager.js';
import type { Redactor } from '../security/redaction.js';

export const DbSchemaSchema = z.object({
  site: z.string().describe('DDEV site name'),
  table: z.string().optional().describe('Specific table name (optional, lists all tables if omitted)'),
});

export type DbSchemaParams = z.infer<typeof DbSchemaSchema>;

const PII_COLUMNS = new Set([
  'mail', 'email', 'e_mail',
  'name', 'username', 'user_name',
  'phone', 'telephone', 'mobile',
  'address', 'street', 'city', 'zip', 'postal_code',
  'ip', 'ip_address', 'hostname',
  'ssn', 'social_security',
  'pass', 'password',
  'first_name', 'last_name', 'full_name',
  'birth_date', 'birthday', 'dob',
]);

function isPiiColumn(columnName: string): boolean {
  const lower = columnName.toLowerCase();
  return PII_COLUMNS.has(lower) || 
    lower.includes('email') || 
    lower.includes('phone') || 
    lower.includes('password') ||
    lower.includes('_name') ||
    lower.includes('address');
}

export async function dbSchema(
  params: DbSchemaParams,
  siteManager: SiteManager,
  redactor: Redactor,
): Promise<string> {
  const site = siteManager.getSite(params.site);
  if (!site) {
    throw new Error(`Site '${params.site}' not found. Available: ${siteManager.getSiteNames().join(', ')}`);
  }

  const ddev = siteManager.getDdev();

  if (!params.table) {
    // List all tables
    const result = await ddev.drush(site.path, 'sql:query', ['SHOW TABLES']);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to list tables: ${result.stderr}`);
    }

    const tables = result.stdout.trim().split('\n').filter(Boolean);
    return JSON.stringify({
      site: params.site,
      total_tables: tables.length,
      tables: tables,
    }, null, 2);
  }

  // Get table schema
  const descResult = await ddev.drush(site.path, 'sql:query', [`DESCRIBE ${params.table}`]);
  if (descResult.exitCode !== 0) {
    throw new Error(`Failed to describe table '${params.table}': ${descResult.stderr}`);
  }

  const columns = descResult.stdout.trim().split('\n').filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const columnName = parts[0] || '';
    return {
      name: columnName,
      type: parts[1] || '',
      null: parts[2] || '',
      key: parts[3] || '',
      default: parts[4] || '',
      extra: parts[5] || '',
      pii_risk: isPiiColumn(columnName),
    };
  });

  // Get indexes
  const indexResult = await ddev.drush(site.path, 'sql:query', [`SHOW INDEX FROM ${params.table}`]);
  let indexes: Array<Record<string, string>> = [];
  if (indexResult.exitCode === 0 && indexResult.stdout.trim()) {
    const indexLines = indexResult.stdout.trim().split('\n').filter(Boolean);
    indexes = indexLines.map((line) => {
      const parts = line.split('\t');
      return {
        key_name: parts[2] || '',
        column_name: parts[4] || '',
        non_unique: parts[1] || '',
      };
    });
  }

  // Get foreign keys
  const fkQuery = `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${params.table}' AND REFERENCED_TABLE_NAME IS NOT NULL`;
  const fkResult = await ddev.drush(site.path, 'sql:query', [fkQuery]);
  let foreignKeys: Array<Record<string, string>> = [];
  if (fkResult.exitCode === 0 && fkResult.stdout.trim()) {
    const fkLines = fkResult.stdout.trim().split('\n').filter(Boolean);
    foreignKeys = fkLines.map((line) => {
      const parts = line.split('\t');
      return {
        constraint: parts[0] || '',
        column: parts[1] || '',
        referenced_table: parts[2] || '',
        referenced_column: parts[3] || '',
      };
    });
  }

  return JSON.stringify(
    {
      site: params.site,
      table: params.table,
      columns,
      indexes,
      foreign_keys: foreignKeys,
      pii_columns: columns.filter((c) => c.pii_risk).map((c) => c.name),
    },
    null,
    2,
  );
}
