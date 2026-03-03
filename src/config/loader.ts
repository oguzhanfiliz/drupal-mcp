import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { AppConfig } from './types.js';

const DEFAULT_CONFIG: AppConfig = {
  server: {
    transport: 'stdio',
    port: 3000,
    token: '',
    rate_limit_rpm: 60,
    max_response_size: 50000,
    environment: 'development',
  },
  rbac: {
    roles: {
      admin: {
        permissions: ['read_only', 'code_read', 'config_read', 'schema_read', 'content_read', 'drush_exec'],
      },
    },
    tokens: {},
  },
  sites: {
    auto_discover: true,
  },
  security: {
    allowed_paths: [
      'web/modules/custom/**',
      'web/themes/custom/**',
      'web/sites/**/settings*.php',
      'web/sites/**/files/config_*/**',
      'config/sync/**',
      'config/**',
      'composer.json',
      'composer.lock',
    ],
    denied_paths: [
      '**/.env',
      '**/.git/**',
      '**/vendor/**',
      '**/node_modules/**',
      '**/*.sql',
      '**/*.sql.gz',
    ],
    secret_patterns: [
      '(password|passwd|pass|pwd)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
      '(api_key|apikey|api-key|secret_key|secret)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
      '(token|auth_token|access_token)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
      '(database_url|db_url|mysql://|postgres://|mongodb://)\\S+',
    ],
    pii_patterns: [
      '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b',
      '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
    ],
    pii_allowlist: ['noreply@example.com', '127.0.0.1', 'localhost'],
  },
  drush: {
    safe_mode: true,
    allowed_commands: [
      'pm:list',
      'cget',
      'config:status',
      'config:get',
      'core:status',
      'entity:updates',
      'views:list',
      'state:get',
    ],
  },
  audit: {
    enabled: true,
    log_path: './logs/audit.log',
    log_level: 'info',
  },
};

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] || '');
}

function deepResolveEnv(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepResolveEnv);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deepResolveEnv(value);
    }
    return result;
  }
  return obj;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig(configPath?: string): AppConfig {
  const paths = [
    configPath,
    path.join(process.cwd(), 'config', 'config.yaml'),
    path.join(process.cwd(), 'config', 'config.yml'),
    path.join(process.cwd(), 'config.yaml'),
    path.join(process.cwd(), 'config.yml'),
  ].filter(Boolean) as string[];

  let fileConfig: Record<string, unknown> = {};

  for (const p of paths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      fileConfig = (yaml.load(raw) as Record<string, unknown>) || {};
      break;
    }
  }

  const resolved = deepResolveEnv(fileConfig) as Record<string, unknown>;
  const merged = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    resolved,
  );

  return merged as unknown as AppConfig;
}
