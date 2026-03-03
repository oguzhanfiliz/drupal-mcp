import type { SecurityConfig } from '../config/types.js';

export class Redactor {
  private secretRegexes: RegExp[];
  private piiRegexes: RegExp[];
  private piiAllowlist: Set<string>;

  constructor(config: SecurityConfig) {
    this.secretRegexes = config.secret_patterns.map(
      (p) => new RegExp(p, 'gi'),
    );
    this.piiRegexes = config.pii_patterns.map((p) => new RegExp(p, 'gi'));
    this.piiAllowlist = new Set(
      config.pii_allowlist.map((s) => s.toLowerCase()),
    );
  }

  redactSecrets(text: string): string {
    let result = text;
    for (const regex of this.secretRegexes) {
      regex.lastIndex = 0;
      result = result.replace(regex, (match) => {
        const parts = match.split(/[:=]/);
        if (parts.length >= 2) {
          return `${parts[0]}=***REDACTED***`;
        }
        return '***REDACTED***';
      });
    }
    return result;
  }

  redactPII(text: string): string {
    let result = text;
    for (const regex of this.piiRegexes) {
      regex.lastIndex = 0;
      result = result.replace(regex, (match) => {
        if (this.piiAllowlist.has(match.toLowerCase())) {
          return match;
        }
        return '***PII_REDACTED***';
      });
    }
    return result;
  }

  redact(text: string): string {
    return this.redactPII(this.redactSecrets(text));
  }
}
