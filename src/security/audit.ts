import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditConfig } from '../config/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export interface AuditEntry {
  timestamp: string;
  tool: string;
  site?: string;
  params: Record<string, unknown>;
  role?: string;
  status: 'success' | 'denied' | 'error';
  message?: string;
  duration_ms?: number;
}

export class AuditLogger {
  private config: AuditConfig;
  private stream: fs.WriteStream | null = null;

  constructor(config: AuditConfig) {
    this.config = config;

    if (config.enabled) {
      try {
        const resolvedPath = path.isAbsolute(config.log_path)
          ? config.log_path
          : path.resolve(PROJECT_ROOT, config.log_path);
        const logDir = path.dirname(resolvedPath);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        this.stream = fs.createWriteStream(resolvedPath, {
          flags: 'a',
        });
      } catch (err) {
        process.stderr.write(
          `[WARN] Audit log init failed: ${err instanceof Error ? err.message : String(err)}. Logging disabled.\n`,
        );
      }
    }
  }

  log(entry: AuditEntry): void {
    if (!this.config.enabled || !this.stream) return;

    const line = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });

    this.stream.write(line + '\n');

    if (this.config.log_level === 'debug') {
      process.stderr.write(`[AUDIT] ${line}\n`);
    }
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}
