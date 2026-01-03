/**
 * Swarm Worker Protocol
 * Runs inside each worker's worktree to coordinate with orchestrator
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkerStatus, WorkerResult } from './types.js';

interface WorkerConfig {
  workerId: number;
  issueId: string;
  patternId: string;
  branch: string;
  swarmId: string;
  orchestratorDir: string;
}

interface WorkerStateUpdate {
  status: WorkerStatus;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  error?: string;
}

const WORKER_CONFIG_PATH = '.claude/swarm/worker.json';

// ============================================================================
// Worker State Management
// ============================================================================

function loadWorkerConfig(): WorkerConfig | null {
  const configPath = path.join(process.cwd(), WORKER_CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function updateOrchestratorState(
  config: WorkerConfig,
  update: WorkerStateUpdate
): void {
  const statePath = path.join(config.orchestratorDir, 'state.json');

  if (!fs.existsSync(statePath)) {
    console.error('Orchestrator state not found');
    return;
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  const worker = state.workers.find(
    (w: { workerId: number }) => w.workerId === config.workerId
  );

  if (!worker) {
    console.error(`Worker ${config.workerId} not found in state`);
    return;
  }

  worker.status = update.status;
  worker.lastHeartbeat = new Date().toISOString();
  worker.progress = {
    currentStep: update.currentStep,
    completedSteps: update.completedSteps,
    totalSteps: update.totalSteps,
  };

  if (update.status === 'executing' && !worker.startedAt) {
    worker.startedAt = new Date().toISOString();
  }

  if (update.status === 'completed' || update.status === 'failed') {
    worker.completedAt = new Date().toISOString();
  }

  if (update.error) {
    worker.error = update.error;
  }

  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ============================================================================
// Worker Protocol Class
// ============================================================================

export class SwarmWorker {
  private config: WorkerConfig | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.config = loadWorkerConfig();
  }

  isInSwarm(): boolean {
    return this.config !== null;
  }

  getConfig(): WorkerConfig | null {
    return this.config;
  }

  // Start the worker session
  start(): void {
    if (!this.config) {
      console.log('Not running in a swarm context');
      return;
    }

    console.log(`\n🐝 SWARM WORKER ${this.config.workerId}`);
    console.log(`   Issue: ${this.config.issueId}`);
    console.log(`   Branch: ${this.config.branch}`);
    console.log(`   Swarm: ${this.config.swarmId}`);
    console.log('');

    // Update status
    this.updateStatus({
      status: 'initializing',
      currentStep: 'Starting worker',
      completedSteps: 0,
      totalSteps: 0,
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  // Update worker status
  updateStatus(update: WorkerStateUpdate): void {
    if (!this.config) return;
    updateOrchestratorState(this.config, update);
  }

  // Report progress during execution
  reportProgress(step: string, completed: number, total: number): void {
    this.updateStatus({
      status: 'executing',
      currentStep: step,
      completedSteps: completed,
      totalSteps: total,
    });
  }

  // Mark as planning phase
  startPlanning(): void {
    this.updateStatus({
      status: 'planning',
      currentStep: 'Creating implementation plan',
      completedSteps: 0,
      totalSteps: 0,
    });
  }

  // Mark as executing
  startExecuting(totalSteps: number): void {
    this.updateStatus({
      status: 'executing',
      currentStep: 'Starting execution',
      completedSteps: 0,
      totalSteps,
    });
  }

  // Mark as completed with results
  complete(result?: WorkerResult): void {
    if (!this.config) return;

    // Update status
    this.updateStatus({
      status: 'completed',
      currentStep: 'Done',
      completedSteps: 1,
      totalSteps: 1,
    });

    // Store result in state.json
    if (result) {
      const statePath = path.join(this.config.orchestratorDir, 'state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const worker = state.workers.find(
          (w: { workerId: number }) => w.workerId === this.config!.workerId
        );
        if (worker) {
          worker.result = {
            success: result.success,
            summary: result.summary,
            filesChanged: result.filesChanged,
            linearStatus: result.linearStatus || 'In Review',
          };
          state.updatedAt = new Date().toISOString();
          fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        }
      }
    }

    this.stopHeartbeat();
    this.log(`Worker completed${result ? `: ${result.summary}` : ''}`);
  }

  // Mark as failed
  fail(error: string): void {
    this.updateStatus({
      status: 'failed',
      currentStep: 'Failed',
      completedSteps: 0,
      totalSteps: 0,
      error,
    });
    this.stopHeartbeat();
  }

  // Heartbeat management
  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.config) {
        const statePath = path.join(this.config.orchestratorDir, 'state.json');
        if (fs.existsSync(statePath)) {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
          const worker = state.workers.find(
            (w: { workerId: number }) => w.workerId === this.config!.workerId
          );
          if (worker && worker.status === 'executing') {
            worker.lastHeartbeat = new Date().toISOString();
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
          }
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get pattern from KB
  async getAssignedPattern(): Promise<unknown | null> {
    if (!this.config) return null;

    const patternsPath = path.join(
      this.config.orchestratorDir,
      'kb/patterns.jsonl'
    );

    if (!fs.existsSync(patternsPath)) return null;

    const content = fs.readFileSync(patternsPath, 'utf-8');
    const patterns = content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    return patterns.find((p: { id: string }) => p.id === this.config!.patternId) || null;
  }

  // Log to swarm logs
  log(message: string): void {
    if (!this.config) {
      console.log(message);
      return;
    }

    const logPath = path.join(
      this.config.orchestratorDir,
      `logs/worker-${this.config.workerId}.log`
    );

    // Ensure logs directory exists
    const logsDir = path.dirname(logPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(logPath, logLine);
    console.log(`[W${this.config.workerId}] ${message}`);
  }
}

// Export singleton
export const worker = new SwarmWorker();
