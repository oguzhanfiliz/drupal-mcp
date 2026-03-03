import type { RBACConfig, Permission } from '../config/types.js';

export class RBAC {
  private config: RBACConfig;

  constructor(config: RBACConfig) {
    this.config = config;
  }

  getRoleForToken(token: string): string | null {
    return this.config.tokens[token] || null;
  }

  getPermissions(role: string): Permission[] {
    const roleDef = this.config.roles[role];
    return roleDef ? roleDef.permissions : [];
  }

  hasPermission(role: string, permission: Permission): boolean {
    const permissions = this.getPermissions(role);
    return permissions.includes(permission);
  }

  checkAccess(token: string, permission: Permission): { allowed: boolean; role?: string; reason?: string } {
    const role = this.getRoleForToken(token);
    if (!role) {
      return { allowed: false, reason: 'Invalid or missing token' };
    }

    if (!this.hasPermission(role, permission)) {
      return { allowed: false, role, reason: `Role '${role}' lacks permission '${permission}'` };
    }

    return { allowed: true, role };
  }
}
