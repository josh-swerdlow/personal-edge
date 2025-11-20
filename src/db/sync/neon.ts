// Neon PostgreSQL sync utilities
// This will handle syncing Dexie data to Neon PostgreSQL

export interface SyncConfig {
  neonUrl: string;
  apiKey?: string;
}

export class NeonSync {
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
  }

  getConfig(): SyncConfig {
    return this.config;
  }

  // Sync methods will be implemented here
  async syncProgressTracker() {
    // TODO: Implement sync logic
  }

  async syncTrainingCoach() {
    // TODO: Implement sync logic
  }
}
