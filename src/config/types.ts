export interface ServerConfig {
  transport: 'stdio' | 'http';
  port: number;
  token: string;
  rate_limit_rpm: number;
  max_response_size: number;
  environment: string;
}

export type Permission =
  | 'read_only'
  | 'code_read'
  | 'config_read'
  | 'schema_read'
  | 'content_read'
  | 'drush_exec';

export interface RoleDefinition {
  permissions: Permission[];
}

export interface RBACConfig {
  roles: Record<string, RoleDefinition>;
  tokens: Record<string, string>;
}

export interface SiteDefinition {
  name: string;
  path: string;
  config_sync_dir?: string;
  environment?: string;
  type?: string;
  status?: string;
}

export interface SitesConfig {
  auto_discover: boolean;
  manual?: SiteDefinition[];
}

export interface SecurityConfig {
  allowed_paths: string[];
  denied_paths: string[];
  secret_patterns: string[];
  pii_patterns: string[];
  pii_allowlist: string[];
}

export interface DrushConfig {
  safe_mode: boolean;
  allowed_commands: string[];
}

export interface AuditConfig {
  enabled: boolean;
  log_path: string;
  log_level: string;
}

export interface AppConfig {
  server: ServerConfig;
  rbac: RBACConfig;
  sites: SitesConfig;
  security: SecurityConfig;
  drush: DrushConfig;
  audit: AuditConfig;
}
