export interface SyncRun {
  id: number;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'error';
  inserted: number;
  updated: number;
  skipped: number;
  errorsJson?: string;
}
