import type { SiteDefinition, SitesConfig } from '../config/types.js';
import { DdevCli } from './ddev.js';

export class SiteManager {
  private config: SitesConfig;
  private ddev: DdevCli;
  private sites: Map<string, SiteDefinition> = new Map();
  private initialized = false;

  constructor(config: SitesConfig) {
    this.config = config;
    this.ddev = new DdevCli();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load manual sites
    if (this.config.manual) {
      for (const site of this.config.manual) {
        this.sites.set(site.name, site);
      }
    }

    // Auto-discover DDEV sites
    if (this.config.auto_discover) {
      try {
        const projects = await this.ddev.listProjects();
        for (const project of projects) {
          if (
            project.type.includes('drupal') &&
            !this.sites.has(project.name)
          ) {
            this.sites.set(project.name, {
              name: project.name,
              path: project.location,
              status: project.status,
              type: project.type,
            });
          }
        }
      } catch (err) {
        process.stderr.write(
          `[WARN] DDEV auto-discovery failed: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }

    this.initialized = true;
  }

  async refresh(): Promise<void> {
    this.initialized = false;
    this.sites.clear();
    await this.initialize();
  }

  getSite(name: string): SiteDefinition | undefined {
    return this.sites.get(name);
  }

  listSites(): SiteDefinition[] {
    return Array.from(this.sites.values());
  }

  getSiteNames(): string[] {
    return Array.from(this.sites.keys());
  }

  getDdev(): DdevCli {
    return this.ddev;
  }
}
