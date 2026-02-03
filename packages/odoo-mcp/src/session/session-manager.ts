import { OdooClient, OdooClientConfig } from '@odoo-toolbox/client';
import { Introspector } from '@odoo-toolbox/introspection';
import { ModuleManager } from '@odoo-toolbox/client';

export interface SessionState {
  isConnected: boolean;
  isAuthenticated: boolean;
  config: OdooClientConfig | null;
  client: OdooClient | null;
  introspector: Introspector | null;
  moduleManager: ModuleManager | null;
  uid: number | null;
  connectedAt: Date | null;
}

export class SessionManager {
  private state: SessionState = {
    isConnected: false,
    isAuthenticated: false,
    config: null,
    client: null,
    introspector: null,
    moduleManager: null,
    uid: null,
    connectedAt: null,
  };

  async authenticate(config: OdooClientConfig): Promise<{ uid: number }> {
    // Cleanup existing connection if any
    this.logout();

    const client = new OdooClient(config);
    const session = await client.authenticate();

    const introspector = new Introspector(client);
    const moduleManager = new ModuleManager(client);

    this.state = {
      isConnected: true,
      isAuthenticated: true,
      config,
      client,
      introspector,
      moduleManager,
      uid: session.uid,
      connectedAt: new Date(),
    };

    return { uid: session.uid };
  }

  logout(): void {
    if (this.state.client) {
      this.state.client.logout();
    }
    this.state = {
      isConnected: false,
      isAuthenticated: false,
      config: null,
      client: null,
      introspector: null,
      moduleManager: null,
      uid: null,
      connectedAt: null,
    };
  }

  getClient(): OdooClient {
    if (!this.state.client || !this.state.isAuthenticated) {
      throw new Error('Not authenticated. Call odoo_authenticate first.');
    }
    return this.state.client;
  }

  getIntrospector(): Introspector {
    if (!this.state.introspector || !this.state.isAuthenticated) {
      throw new Error('Not authenticated. Call odoo_authenticate first.');
    }
    return this.state.introspector;
  }

  getModuleManager(): ModuleManager {
    if (!this.state.moduleManager || !this.state.isAuthenticated) {
      throw new Error('Not authenticated. Call odoo_authenticate first.');
    }
    return this.state.moduleManager;
  }

  getStatus(): Readonly<SessionState> {
    return { ...this.state };
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }
}
