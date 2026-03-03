import { describe, it, expect } from 'vitest';
import { Redactor } from '../src/security/redaction.js';

const config = {
  secret_patterns: [
    '(password|passwd|pass|pwd)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
    '(api_key|apikey|secret_key|secret)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
    '(token|auth_token|access_token)\\s*[:=]\\s*[\'"]?[^\\s\'"]*',
    '(mysql://|postgres://)\\S+',
  ],
  pii_patterns: [
    '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b',
    '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
  ],
  pii_allowlist: ['noreply@example.com', '127.0.0.1'],
  allowed_paths: [],
  denied_paths: [],
};

describe('Redactor', () => {
  const redactor = new Redactor(config);

  it('should redact passwords', () => {
    const input = 'password = "super_secret_123"';
    const result = redactor.redactSecrets(input);
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('super_secret_123');
  });

  it('should redact API keys', () => {
    const input = 'api_key: sk-12345abcdef';
    const result = redactor.redactSecrets(input);
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('sk-12345abcdef');
  });

  it('should redact database URLs', () => {
    const input = 'mysql://user:pass@localhost/db';
    const result = redactor.redactSecrets(input);
    expect(result).toContain('***REDACTED***');
  });

  it('should redact email addresses', () => {
    const input = 'Contact: user@company.com for info';
    const result = redactor.redactPII(input);
    expect(result).toContain('***PII_REDACTED***');
    expect(result).not.toContain('user@company.com');
  });

  it('should NOT redact allowlisted values', () => {
    const input = 'Reply to noreply@example.com';
    const result = redactor.redactPII(input);
    expect(result).toContain('noreply@example.com');
  });

  it('should NOT redact allowlisted IPs', () => {
    const input = 'Connect to 127.0.0.1';
    const result = redactor.redactPII(input);
    expect(result).toContain('127.0.0.1');
  });

  it('should redact non-allowlisted IPs', () => {
    const input = 'Server at 192.168.1.100';
    const result = redactor.redactPII(input);
    expect(result).toContain('***PII_REDACTED***');
    expect(result).not.toContain('192.168.1.100');
  });

  it('should redact phone numbers', () => {
    const input = 'Call 555-123-4567 for support';
    const result = redactor.redactPII(input);
    expect(result).toContain('***PII_REDACTED***');
  });

  it('should apply both secret and PII redaction with redact()', () => {
    const input = 'password = mypass123 email: user@test.com';
    const result = redactor.redact(input);
    expect(result).not.toContain('mypass123');
    expect(result).not.toContain('user@test.com');
  });
});
