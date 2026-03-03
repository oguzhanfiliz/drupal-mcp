import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DdevProject {
  name: string;
  status: string;
  type: string;
  location: string;
  url: string;
}

export interface DdevExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class DdevCli {
  private timeout: number;

  constructor(timeout = 30_000) {
    this.timeout = timeout;
  }

  async listProjects(): Promise<DdevProject[]> {
    try {
      const { stdout } = await execFileAsync('ddev', ['list', '--json-output'], {
        timeout: this.timeout,
      });

      const parsed = JSON.parse(stdout);
      const raw = parsed.raw || [];

      return raw.map((item: Record<string, string>) => ({
        name: item.name || '',
        status: item.status || '',
        type: item.type || '',
        location: item.approot || item.location || '',
        url: item.primary_url || item.httpurl || '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to list DDEV projects: ${message}`);
    }
  }

  async exec(projectDir: string, command: string, args: string[] = []): Promise<DdevExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync(
        'ddev',
        ['exec', ...command.split(' '), ...args],
        {
          cwd: projectDir,
          timeout: this.timeout,
        },
      );
      return { stdout, stderr, exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
      };
    }
  }

  async drush(projectDir: string, command: string, args: string[] = []): Promise<DdevExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync(
        'ddev',
        ['drush', command, ...args],
        {
          cwd: projectDir,
          timeout: this.timeout,
        },
      );
      return { stdout, stderr, exitCode: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || String(err),
        exitCode: error.code || 1,
      };
    }
  }

  async describe(projectDir: string): Promise<Record<string, unknown>> {
    try {
      const { stdout } = await execFileAsync('ddev', ['describe', '--json-output'], {
        cwd: projectDir,
        timeout: this.timeout,
      });
      return JSON.parse(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to describe DDEV project: ${message}`);
    }
  }
}
