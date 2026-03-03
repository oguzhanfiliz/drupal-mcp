import { describe, it, expect } from 'vitest';
import { PathGuard } from '../src/security/path-guard.js';

const config = {
  allowed_paths: [
    'web/modules/custom/**',
    'web/themes/custom/**',
    'web/sites/**/settings*.php',
    'config/sync/**',
    'composer.json',
  ],
  denied_paths: [
    '**/.env',
    '**/.git/**',
    '**/vendor/**',
    '**/node_modules/**',
    '**/*.sql',
  ],
  secret_patterns: [],
  pii_patterns: [],
  pii_allowlist: [],
};

const guard = new PathGuard(config);
const drupalRoot = '/home/user/projects/my-drupal';

describe('PathGuard', () => {
  it('should allow custom module files', () => {
    expect(guard.isAllowed('web/modules/custom/mymod/src/Controller/MyController.php', drupalRoot)).toBe(true);
  });

  it('should allow custom theme files', () => {
    expect(guard.isAllowed('web/themes/custom/mytheme/templates/page.html.twig', drupalRoot)).toBe(true);
  });

  it('should allow settings.php', () => {
    expect(guard.isAllowed('web/sites/default/settings.php', drupalRoot)).toBe(true);
  });

  it('should allow config sync files', () => {
    expect(guard.isAllowed('config/sync/system.site.yml', drupalRoot)).toBe(true);
  });

  it('should allow composer.json', () => {
    expect(guard.isAllowed('composer.json', drupalRoot)).toBe(true);
  });

  it('should deny .env files', () => {
    expect(guard.isAllowed('.env', drupalRoot)).toBe(false);
    expect(guard.isAllowed('web/.env', drupalRoot)).toBe(false);
  });

  it('should deny .git directory', () => {
    expect(guard.isAllowed('.git/config', drupalRoot)).toBe(false);
  });

  it('should deny vendor directory', () => {
    expect(guard.isAllowed('vendor/autoload.php', drupalRoot)).toBe(false);
  });

  it('should deny SQL files', () => {
    expect(guard.isAllowed('backup.sql', drupalRoot)).toBe(false);
  });

  it('should deny paths not in allowlist', () => {
    expect(guard.isAllowed('web/core/lib/Drupal.php', drupalRoot)).toBe(false);
  });

  it('should prevent path traversal', () => {
    expect(guard.isAllowed('../../../etc/passwd', drupalRoot)).toBe(false);
  });

  it('should provide reason for denial', () => {
    const result = guard.validatePath('../../../etc/passwd', drupalRoot);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Path traversal');
  });
});
