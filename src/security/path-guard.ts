import path from 'node:path';
import type { SecurityConfig } from '../config/types.js';

function matchGlob(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\?/g, '[^/]');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

export class PathGuard {
  private allowedPatterns: string[];
  private deniedPatterns: string[];

  constructor(config: SecurityConfig) {
    this.allowedPatterns = config.allowed_paths;
    this.deniedPatterns = config.denied_paths;
  }

  isAllowed(filePath: string, drupalRoot: string): boolean {
    const resolved = path.resolve(drupalRoot, filePath);

    // Must be within drupal root (path traversal protection)
    if (!resolved.startsWith(path.resolve(drupalRoot))) {
      return false;
    }

    // Get relative path for pattern matching
    const relative = path.relative(drupalRoot, resolved);

    // Check denied first
    for (const pattern of this.deniedPatterns) {
      if (matchGlob(pattern, relative)) {
        return false;
      }
    }

    // Check allowed
    for (const pattern of this.allowedPatterns) {
      if (matchGlob(pattern, relative)) {
        return true;
      }
    }

    return false;
  }

  validatePath(filePath: string, drupalRoot: string): { valid: boolean; reason?: string } {
    const resolved = path.resolve(drupalRoot, filePath);

    if (!resolved.startsWith(path.resolve(drupalRoot))) {
      return { valid: false, reason: 'Path traversal detected' };
    }

    const relative = path.relative(drupalRoot, resolved);

    for (const pattern of this.deniedPatterns) {
      if (matchGlob(pattern, relative)) {
        return { valid: false, reason: `Path matches denied pattern: ${pattern}` };
      }
    }

    for (const pattern of this.allowedPatterns) {
      if (matchGlob(pattern, relative)) {
        return { valid: true };
      }
    }

    return { valid: false, reason: 'Path not in allowed list' };
  }
}
