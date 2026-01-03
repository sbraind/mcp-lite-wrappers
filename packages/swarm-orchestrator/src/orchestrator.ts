/**
 * Swarm Orchestrator
 * Coordinates multiple Claude Code instances working on parallel issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  SwarmConfig,
  SwarmState,
  WorkerState,
  WorkerResult,
  OverlapAnalysis,
  LinearIssue,
  IssuePattern,
} from './types.js';
import { KnowledgeBase, kb } from './knowledge-base.js';

const SWARM_DIR = path.join(process.cwd(), '.claude/swarm');
const STATE_FILE = path.join(SWARM_DIR, 'state.json');
const CONFIG_FILE = path.join(SWARM_DIR, 'config.json');

// ============================================================================
// Configuration
// ============================================================================

export function loadConfig(): SwarmConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error('Swarm config not found. Run swarm init first.');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

export function saveConfig(config: SwarmConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ============================================================================
// State Management
// ============================================================================

function loadState(): SwarmState | null {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state: SwarmState): void {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function createSwarmState(issues: string[], baseBranch: string): SwarmState {
  return {
    id: `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phase: 'initializing',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseBranch,
    issues,
    workers: [],
    overlapAnalysis: null,
    mergeOrder: [],
  };
}

// ============================================================================
// Git Operations
// ============================================================================

function getCurrentBranch(): string {
  return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
}

function isGitClean(): boolean {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  return status === '';
}

function createWorktree(worktreePath: string, branch: string, baseBranch: string): void {
  // Create new branch from base
  execSync(`git worktree add -b ${branch} ${worktreePath} ${baseBranch}`, {
    encoding: 'utf-8',
  });
}

function removeWorktree(worktreePath: string): void {
  execSync(`git worktree remove ${worktreePath} --force`, { encoding: 'utf-8' });
}

function getModifiedFiles(branch: string, baseBranch: string): string[] {
  try {
    const diff = execSync(`git diff --name-only ${baseBranch}...${branch}`, {
      encoding: 'utf-8',
    });
    return diff.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function mergeBranch(branch: string): { success: boolean; conflicts: string[] } {
  try {
    execSync(`git merge ${branch} --no-ff -m "Merge ${branch}"`, {
      encoding: 'utf-8',
    });
    return { success: true, conflicts: [] };
  } catch (error) {
    // Get conflicted files
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    const conflicts = status
      .split('\n')
      .filter((line) => line.startsWith('UU') || line.startsWith('AA'))
      .map((line) => line.slice(3).trim());

    return { success: false, conflicts };
  }
}

// ============================================================================
// Conflict Detection & Export (for Claude Code resolution)
// ============================================================================

interface ConflictInfo {
  file: string;
  content: string;
  oursLabel: string;
  theirsLabel: string;
  conflictBlocks: {
    ours: string;
    theirs: string;
    startLine: number;
    endLine: number;
  }[];
}

interface PendingConflicts {
  swarmId: string;
  branch: string;
  issueId: string;
  issueDescription?: string;
  timestamp: string;
  conflicts: ConflictInfo[];
}

function analyzeConflictFile(filePath: string): ConflictInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const conflictBlocks: ConflictInfo['conflictBlocks'] = [];
    let inConflict = false;
    let currentBlock: { ours: string[]; theirs: string[]; startLine: number; endLine: number } | null = null;
    let inOurs = false;

    let oursLabel = 'HEAD';
    let theirsLabel = 'incoming';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        inOurs = true;
        oursLabel = line.replace('<<<<<<<', '').trim() || 'HEAD';
        currentBlock = { ours: [], theirs: [], startLine: i + 1, endLine: 0 };
      } else if (line.startsWith('=======') && inConflict) {
        inOurs = false;
      } else if (line.startsWith('>>>>>>>') && inConflict) {
        theirsLabel = line.replace('>>>>>>>', '').trim() || 'incoming';
        if (currentBlock) {
          currentBlock.endLine = i + 1;
          conflictBlocks.push({
            ours: currentBlock.ours.join('\n'),
            theirs: currentBlock.theirs.join('\n'),
            startLine: currentBlock.startLine,
            endLine: currentBlock.endLine,
          });
        }
        inConflict = false;
        currentBlock = null;
      } else if (inConflict && currentBlock) {
        if (inOurs) {
          currentBlock.ours.push(line);
        } else {
          currentBlock.theirs.push(line);
        }
      }
    }

    if (conflictBlocks.length === 0) {
      return null;
    }

    return {
      file: filePath,
      content,
      oursLabel,
      theirsLabel,
      conflictBlocks,
    };
  } catch (error) {
    console.error(`Error reading conflict file ${filePath}:`, error);
    return null;
  }
}

function saveConflictsForResolution(
  conflicts: string[],
  swarmId: string,
  branch: string,
  issueId: string,
  issueDescription?: string
): string {
  const conflictInfos: ConflictInfo[] = [];

  for (const conflictFile of conflicts) {
    const info = analyzeConflictFile(conflictFile);
    if (info) {
      conflictInfos.push(info);
    }
  }

  const pendingConflicts: PendingConflicts = {
    swarmId,
    branch,
    issueId,
    issueDescription,
    timestamp: new Date().toISOString(),
    conflicts: conflictInfos,
  };

  const conflictsFile = path.join(SWARM_DIR, 'pending-conflicts.json');
  fs.writeFileSync(conflictsFile, JSON.stringify(pendingConflicts, null, 2));

  return conflictsFile;
}

function clearPendingConflicts(): void {
  const conflictsFile = path.join(SWARM_DIR, 'pending-conflicts.json');
  if (fs.existsSync(conflictsFile)) {
    fs.unlinkSync(conflictsFile);
  }
}

// ============================================================================
// Linear Integration
// ============================================================================

const LINEAR_API_URL = 'https://api.linear.app/graphql';

async function linearQuery(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
  if (!LINEAR_API_KEY) {
    console.warn('LINEAR_API_KEY not set - Linear operations will be skipped');
    return null;
  }

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: LINEAR_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json() as { data?: unknown; errors?: unknown[] };
  if (result.errors) {
    console.error('Linear API error:', result.errors);
    return null;
  }
  return result.data;
}

export async function fetchLinearIssues(issueIds: string[]): Promise<LinearIssue[]> {
  // This would typically use the Linear MCP, but for the script we'll
  // create a placeholder that reads from a cache or makes API calls
  console.log(`Fetching ${issueIds.length} issues from Linear...`);

  // For now, return mock data structure
  // In real implementation, this would call Linear API
  return issueIds.map((id) => ({
    id: `linear-${id}`,
    identifier: id,
    title: `Issue ${id}`,
    description: null,
    priority: 2,
    state: { id: 'state-1', name: 'Todo' },
    labels: { nodes: [] },
    assignee: null,
  }));
}

async function updateLinearIssueStatus(issueIdentifier: string, statusName: string): Promise<boolean> {
  // First, get the issue ID and team's workflow states
  const issueQuery = `
    query GetIssue($identifier: String!) {
      issue(id: $identifier) {
        id
        identifier
        team {
          id
          states {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `;

  const issueData = await linearQuery(issueQuery, { identifier: issueIdentifier }) as { issue?: { id: string; team: { states: { nodes: { id: string; name: string }[] } } } } | null;
  if (!issueData?.issue) {
    console.warn(`Could not find Linear issue: ${issueIdentifier}`);
    return false;
  }

  const issue = issueData.issue;
  const states = issue.team.states.nodes;
  const targetState = states.find((s) => s.name === statusName);

  if (!targetState) {
    console.warn(`Could not find status "${statusName}" for issue ${issueIdentifier}`);
    return false;
  }

  // Update the issue status
  const updateMutation = `
    mutation UpdateIssue($issueId: String!, $stateId: String!) {
      issueUpdate(id: $issueId, input: { stateId: $stateId }) {
        success
        issue {
          id
          identifier
          state {
            name
          }
        }
      }
    }
  `;

  const updateData = await linearQuery(updateMutation, {
    issueId: issue.id,
    stateId: targetState.id,
  }) as { issueUpdate?: { success: boolean } } | null;

  if (updateData?.issueUpdate?.success) {
    console.log(`   ✅ ${issueIdentifier} → ${statusName}`);
    return true;
  }

  return false;
}

// ============================================================================
// Overlap Analysis
// ============================================================================

function analyzeOverlap(
  issues: LinearIssue[],
  predictions: Map<string, string[]>
): OverlapAnalysis {
  const analysis: OverlapAnalysis = {
    issues: [],
    overlapMatrix: {},
    recommendation: 'proceed',
    warnings: [],
  };

  // Build per-issue predictions
  for (const issue of issues) {
    const predictedFiles = predictions.get(issue.identifier) || [];
    analysis.issues.push({
      id: issue.identifier,
      predictedFiles,
      confidence: predictedFiles.length > 0 ? 0.7 : 0.3,
    });
  }

  // Build overlap matrix
  for (let i = 0; i < issues.length; i++) {
    const issueA = issues[i].identifier;
    analysis.overlapMatrix[issueA] = {};

    for (let j = 0; j < issues.length; j++) {
      if (i === j) continue;

      const issueB = issues[j].identifier;
      const filesA = predictions.get(issueA) || [];
      const filesB = predictions.get(issueB) || [];

      const sharedFiles = filesA.filter((f) => filesB.includes(f));

      let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
      if (sharedFiles.length > 5) riskLevel = 'high';
      else if (sharedFiles.length > 2) riskLevel = 'medium';
      else if (sharedFiles.length > 0) riskLevel = 'low';

      analysis.overlapMatrix[issueA][issueB] = { sharedFiles, riskLevel };

      if (riskLevel === 'high') {
        analysis.warnings.push(
          `High overlap risk between ${issueA} and ${issueB}: ${sharedFiles.length} shared files`
        );
      }
    }
  }

  // Determine recommendation
  const highRiskCount = analysis.warnings.length;
  if (highRiskCount > 2) {
    analysis.recommendation = 'sequential';
  } else if (highRiskCount > 0) {
    analysis.recommendation = 'reorder';
  }

  return analysis;
}

// ============================================================================
// Worker Management
// ============================================================================

function createWorkerState(
  workerId: number,
  issueId: string,
  patternId: string,
  branch: string,
  worktreePath: string
): WorkerState {
  return {
    id: `worker-${workerId}-${Date.now()}`,
    workerId,
    issueId,
    patternId,
    status: 'pending',
    branch,
    worktreePath,
    startedAt: null,
    completedAt: null,
    lastHeartbeat: null,
    progress: {
      currentStep: 'Waiting to start',
      completedSteps: 0,
      totalSteps: 0,
    },
  };
}

function checkWorkerHeartbeats(state: SwarmState, config: SwarmConfig): void {
  const now = Date.now();

  for (const worker of state.workers) {
    if (worker.status === 'executing' && worker.lastHeartbeat) {
      const lastBeat = new Date(worker.lastHeartbeat).getTime();
      if (now - lastBeat > config.heartbeatTimeoutMs) {
        console.warn(`Worker ${worker.workerId} (${worker.issueId}) timed out!`);
        worker.status = 'timeout';
        worker.error = 'Heartbeat timeout';
      }
    }
  }
}

// ============================================================================
// Swarm Orchestrator Class
// ============================================================================

export class SwarmOrchestrator {
  private config: SwarmConfig;
  private state: SwarmState | null = null;
  private kb: KnowledgeBase;

  constructor() {
    this.config = loadConfig();
    this.state = loadState();
    this.kb = kb;
  }

  // --------------------------------------------------------------------------
  // Main Entry Points
  // --------------------------------------------------------------------------

  async start(issueIds: string[]): Promise<void> {
    console.log('\n🐝 SWARM ORCHESTRATOR - Starting...\n');

    // Validate
    if (issueIds.length > this.config.maxWorkers) {
      throw new Error(
        `Too many issues (${issueIds.length}). Max: ${this.config.maxWorkers}`
      );
    }

    if (!isGitClean()) {
      throw new Error('Git working directory is not clean. Commit or stash changes first.');
    }

    const baseBranch = getCurrentBranch();
    console.log(`📍 Base branch: ${baseBranch}`);

    // Initialize state
    this.state = createSwarmState(issueIds, baseBranch);
    saveState(this.state);

    // Phase 1: Analysis
    await this.runAnalysisPhase();

    // Phase 2: Planning (creates patterns with predictions)
    await this.runPlanningPhase();

    // Phase 3: Preparation (creates worktrees)
    await this.runPreparationPhase();

    // Phase 4: Print worker commands (user runs manually)
    this.printWorkerCommands();
  }

  async monitor(): Promise<void> {
    if (!this.state) {
      console.log('No active swarm. Run "swarm start" first.');
      return;
    }

    console.log('\n🐝 SWARM MONITOR\n');
    console.log(`ID: ${this.state.id}`);
    console.log(`Phase: ${this.state.phase}`);
    console.log(`Started: ${this.state.startedAt}`);
    console.log('');

    console.log('Workers:');
    console.log('─'.repeat(80));

    for (const worker of this.state.workers) {
      const statusEmoji = {
        pending: '⏳',
        initializing: '🔄',
        planning: '📋',
        executing: '⚡',
        completed: '✅',
        failed: '❌',
        timeout: '⏰',
      }[worker.status];

      console.log(
        `${statusEmoji} Worker ${worker.workerId}: ${worker.issueId} - ${worker.status}`
      );
      console.log(`   Branch: ${worker.branch}`);
      console.log(`   Progress: ${worker.progress.currentStep}`);
      if (worker.lastHeartbeat) {
        const ago = Math.round(
          (Date.now() - new Date(worker.lastHeartbeat).getTime()) / 1000
        );
        console.log(`   Last heartbeat: ${ago}s ago`);
      }
      console.log('');
    }

    // Check for timeouts
    checkWorkerHeartbeats(this.state, this.config);
    saveState(this.state);
  }

  async merge(): Promise<void> {
    if (!this.state) {
      throw new Error('No active swarm state');
    }

    console.log('\n🐝 SWARM MERGE\n');

    // Verify all workers completed
    const incomplete = this.state.workers.filter(
      (w) => w.status !== 'completed' && w.status !== 'failed'
    );

    if (incomplete.length > 0) {
      console.log('⚠️  Some workers are not complete:');
      for (const w of incomplete) {
        console.log(`   - ${w.issueId}: ${w.status}`);
      }
      console.log('\nWait for workers to complete or mark them as failed.');
      return;
    }

    // Switch to base branch
    execSync(`git checkout ${this.state.baseBranch}`, { encoding: 'utf-8' });

    // Merge in order
    const completedWorkers = this.state.workers.filter(
      (w) => w.status === 'completed'
    );

    console.log(`Merging ${completedWorkers.length} branches...\n`);

    for (const worker of completedWorkers) {
      console.log(`Merging ${worker.branch}...`);
      const result = mergeBranch(worker.branch);

      if (result.success) {
        console.log(`✅ ${worker.branch} merged successfully`);

        // Capture outcomes for learning
        await this.captureOutcome(worker);
      } else {
        console.log(`⚠️  ${worker.branch} has conflicts:`);
        for (const conflict of result.conflicts) {
          console.log(`   - ${conflict}`);
        }

        // Save conflicts for Claude Code resolution
        const conflictsFile = saveConflictsForResolution(
          result.conflicts,
          this.state.id,
          worker.branch,
          worker.issueId,
          worker.result?.summary
        );

        // Record conflicts for learning
        for (const conflict of result.conflicts) {
          this.kb.recordConflict(conflict, worker.branch);
        }

        console.log('\n' + '═'.repeat(70));
        console.log('🤖 CONFLICT RESOLUTION REQUIRED');
        console.log('═'.repeat(70));
        console.log('');
        console.log('Conflicts have been saved. To resolve them:');
        console.log('');
        console.log('  1. In Claude Code, run:  /resolve-conflicts');
        console.log('');
        console.log('  2. Claude will analyze conflicts and propose resolutions');
        console.log('');
        console.log('  3. After resolving, run:');
        console.log('     swarm merge');
        console.log('');
        console.log(`📁 Conflicts file: ${conflictsFile}`);
        console.log('═'.repeat(70));
        return;
      }
    }

    // Clear any pending conflicts from previous attempts
    clearPendingConflicts();

    // Update Linear issues to "In Review"
    console.log('\n📋 Updating Linear issues...');
    for (const worker of completedWorkers) {
      const targetStatus = worker.result?.linearStatus || 'In Review';
      await updateLinearIssueStatus(worker.issueId, targetStatus);
    }

    // Cleanup worktrees
    console.log('\n🧹 Cleaning up worktrees...');
    for (const worker of this.state.workers) {
      try {
        removeWorktree(worker.worktreePath);
        console.log(`   Removed ${worker.worktreePath}`);
      } catch (e) {
        console.log(`   Warning: Could not remove ${worker.worktreePath}`);
      }
    }

    // Update metrics
    this.kb.updateMetrics();

    // Mark complete
    this.state.phase = 'completed';
    saveState(this.state);

    console.log('\n✅ Swarm merge complete!');
    console.log(`All ${completedWorkers.length} branches merged into ${this.state.baseBranch}`);
    console.log(`Linear issues updated to "In Review" - ready for human review`);
  }

  // --------------------------------------------------------------------------
  // Phase Implementations
  // --------------------------------------------------------------------------

  private async runAnalysisPhase(): Promise<void> {
    if (!this.state) return;

    console.log('\n📊 PHASE 1: ANALYSIS\n');
    this.state.phase = 'analyzing';
    saveState(this.state);

    // Get KB stats
    const stats = this.kb.getStats();
    console.log(`Knowledge Base: ${stats.totalPatterns} patterns`);
    console.log(
      `Accuracy: Precision=${(stats.avgPrecision * 100).toFixed(1)}%, Recall=${(stats.avgRecall * 100).toFixed(1)}%`
    );
    console.log('');

    // Fetch issues (mock for now)
    const issues = await fetchLinearIssues(this.state.issues);

    // Generate predictions for each issue
    const predictions = new Map<string, string[]>();

    for (const issue of issues) {
      console.log(`Analyzing ${issue.identifier}: ${issue.title}`);

      // Try KB-based prediction first
      const similar = this.kb.findSimilarPatterns(
        issue.title,
        issue.description || ''
      );

      let predictedFiles: string[];

      if (similar.length >= this.config.learning.minPatternsForPrediction) {
        // Use learned patterns
        const allFiles = similar.flatMap((p) => p.outcomes.filesActual);
        const fileCounts = new Map<string, number>();
        for (const file of allFiles) {
          fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
        }
        predictedFiles = [...fileCounts.entries()]
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([file]) => file);

        console.log(`   Found ${similar.length} similar patterns (learned)`);
      } else {
        // Fall back to cold start
        const coldStart = this.kb.coldStartPrediction(
          issue.title,
          issue.description || ''
        );
        predictedFiles = coldStart.files.slice(0, 10);
        console.log(`   Using cold start heuristics`);
      }

      predictions.set(issue.identifier, predictedFiles);
      console.log(`   Predicted files: ${predictedFiles.length}`);
    }

    // Analyze overlap
    console.log('\nAnalyzing overlap...');
    this.state.overlapAnalysis = analyzeOverlap(issues, predictions);

    if (this.state.overlapAnalysis.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of this.state.overlapAnalysis.warnings) {
        console.log(`   ${warning}`);
      }
    }

    console.log(`\nRecommendation: ${this.state.overlapAnalysis.recommendation}`);
    saveState(this.state);
  }

  private async runPlanningPhase(): Promise<void> {
    if (!this.state) return;

    console.log('\n📋 PHASE 2: PLANNING\n');
    this.state.phase = 'planning';
    saveState(this.state);

    const issues = await fetchLinearIssues(this.state.issues);

    for (const issue of issues) {
      console.log(`Creating pattern for ${issue.identifier}...`);

      // Extract keywords
      const keywords = this.kb.extractKeywords(
        issue.title + ' ' + (issue.description || '')
      );

      // Get predictions
      const coldStart = this.kb.coldStartPrediction(
        issue.title,
        issue.description || ''
      );

      // Create pattern
      const pattern: IssuePattern = {
        id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        input: {
          issueId: issue.identifier,
          title: issue.title,
          description: issue.description || '',
          labels: Array.isArray(issue.labels) ? issue.labels : issue.labels.nodes.map((l) => l.name),
          keywords,
          fileHints: [],
          scopeSignals: {
            isNewFeature: issue.title.toLowerCase().includes('add') ||
              issue.title.toLowerCase().includes('feat'),
            isBugFix: issue.title.toLowerCase().includes('fix') ||
              issue.title.toLowerCase().includes('bug'),
            isRefactor: issue.title.toLowerCase().includes('refactor'),
            affectedLayers: [],
          },
        },
        predictions: {
          files: coldStart.files,
          timeMinutes: coldStart.timeMinutes,
          complexity: coldStart.complexity,
          conflictRisk:
            this.state.overlapAnalysis?.issues.find(
              (i) => i.id === issue.identifier
            )?.confidence || 0.1,
          confidence: 'cold_start',
        },
        outcomes: {
          filesActual: [],
          timeActualMinutes: 0,
          conflicts: [],
          success: false,
        },
        scores: {
          filePrecision: 0,
          fileRecall: 0,
          timeAccuracy: 0,
          conflictPredictionHit: false,
        },
      };

      this.kb.addPattern(pattern);
      console.log(`   Created pattern: ${pattern.id}`);
    }

    saveState(this.state);
  }

  private async runPreparationPhase(): Promise<void> {
    if (!this.state) return;

    console.log('\n🔧 PHASE 3: PREPARATION\n');
    this.state.phase = 'preparing';
    saveState(this.state);

    const worktreeBase = path.resolve(
      process.cwd(),
      this.config.worktreeBaseDir
    );

    // Ensure worktree directory exists
    if (!fs.existsSync(worktreeBase)) {
      fs.mkdirSync(worktreeBase, { recursive: true });
    }

    // Get patterns for workers
    const patterns = this.kb.getAllPatterns();
    const recentPatterns = patterns.filter((p) =>
      this.state!.issues.includes(p.input.issueId)
    );

    for (let i = 0; i < this.state.issues.length; i++) {
      const issueId = this.state.issues[i];
      const workerId = i + 1;
      const branch = `${this.config.branchPrefix}${issueId.toLowerCase()}`;
      const worktreePath = path.join(worktreeBase, `worker-${workerId}`);

      console.log(`Creating worktree for ${issueId}...`);

      // Find pattern
      const pattern = recentPatterns.find((p) => p.input.issueId === issueId);
      if (!pattern) {
        console.log(`   Warning: No pattern found for ${issueId}`);
        continue;
      }

      // Remove existing worktree if it exists
      if (fs.existsSync(worktreePath)) {
        console.log(`   Removing existing worktree...`);
        removeWorktree(worktreePath);
      }

      // Create worktree
      createWorktree(worktreePath, branch, this.state.baseBranch);
      console.log(`   Created: ${worktreePath} on branch ${branch}`);

      // Create worker state
      const worker = createWorkerState(
        workerId,
        issueId,
        pattern.id,
        branch,
        worktreePath
      );

      // Write worker config to worktree
      const workerConfigPath = path.join(worktreePath, '.claude/swarm/worker.json');
      fs.mkdirSync(path.dirname(workerConfigPath), { recursive: true });
      fs.writeFileSync(
        workerConfigPath,
        JSON.stringify(
          {
            workerId,
            issueId,
            patternId: pattern.id,
            branch,
            swarmId: this.state.id,
            orchestratorDir: SWARM_DIR,
            // Guidance for worker execution
            guidance: {
              useSubagents: true,
              subagentTips: [
                'Use Task tool with specialized subagents for parallel subtasks',
                'Run independent file operations in parallel',
                'Use fullstack-developer for feature implementation',
                'Use code-reviewer after significant changes',
                'Use test-automator for generating tests',
              ],
              workflow: [
                '1. Read this config and understand the issue',
                '2. Plan the implementation (use /superpowers:write-plan if complex)',
                '3. Implement with subagents for parallel work when possible',
                '4. Run tests: npm run test:smoke && npm run typecheck',
                '5. Commit changes with issue reference [ISSUE_ID]',
                '6. Mark worker as complete',
              ],
            },
          },
          null,
          2
        )
      );

      this.state.workers.push(worker);
    }

    this.state.phase = 'executing';
    saveState(this.state);
  }

  private printWorkerCommands(): void {
    if (!this.state) return;

    console.log('\n' + '═'.repeat(80));
    console.log('🐝 SWARM READY - Choose execution mode:');
    console.log('═'.repeat(80) + '\n');

    // Option 1: Subagent-Driven
    console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 1️⃣  SUBAGENT-DRIVEN (This Session)                                           │');
    console.log('├──────────────────────────────────────────────────────────────────────────────┤');
    console.log('│ Dispatch parallel agents via Task tool. Fast, stays in current session.     │');
    console.log('│                                                                              │');
    console.log('│ Pros: No terminal switching, automatic coordination                         │');
    console.log('│ Cons: Shares context budget, less visibility                                │');
    console.log('└──────────────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Option 2: Parallel Sessions
    console.log('┌──────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 2️⃣  PARALLEL SESSIONS (Separate Terminals)                                   │');
    console.log('├──────────────────────────────────────────────────────────────────────────────┤');
    console.log('│ Open new Claude Code sessions in each worktree. Manual but more control.    │');
    console.log('│                                                                              │');
    console.log('│ Pros: Full context per worker, visible progress                             │');
    console.log('│ Cons: Manual terminal management                                            │');
    console.log('└──────────────────────────────────────────────────────────────────────────────┘');
    console.log('');

    console.log('─'.repeat(80));
    console.log('');

    // Print terminal commands with full prompt
    console.log('📺 FOR PARALLEL SESSIONS (Option 2):');
    console.log('   Open new terminals and run:\n');
    for (const worker of this.state.workers) {
      console.log(`   📌 WORKER ${worker.workerId} (${worker.issueId}):`);
      console.log(`      cd ${worker.worktreePath}`);
      console.log('');
      console.log('      # Start Claude Code with the worker context');
      console.log(`      claude "Work on ${worker.issueId}. Read .claude/swarm/worker.json and follow the guidance.workflow steps. Use /ultra-think and /superpowers:write-plan."`);
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('📊 Monitor progress:  swarm monitor');
    console.log('🔀 Merge when done:   swarm merge');
    console.log('═'.repeat(80));
    console.log('');
    console.log('❓ Which execution mode? [1/2]');
  }

  // --------------------------------------------------------------------------
  // Learning & Feedback
  // --------------------------------------------------------------------------

  private async captureOutcome(worker: WorkerState): Promise<void> {
    const pattern = this.kb.getPattern(worker.patternId);
    if (!pattern) return;

    // Get actual modified files
    const actualFiles = getModifiedFiles(worker.branch, this.state!.baseBranch);

    // Calculate time
    const startTime = worker.startedAt
      ? new Date(worker.startedAt).getTime()
      : 0;
    const endTime = worker.completedAt
      ? new Date(worker.completedAt).getTime()
      : Date.now();
    const actualMinutes = Math.round((endTime - startTime) / 60000);

    // Update pattern outcomes
    pattern.outcomes = {
      filesActual: actualFiles,
      timeActualMinutes: actualMinutes,
      conflicts: [],
      success: worker.status === 'completed',
      rollbackReason: worker.error,
    };

    // Calculate scores
    const predictedSet = new Set(pattern.predictions.files);
    const actualSet = new Set(actualFiles);
    const intersection = [...predictedSet].filter((f) => actualSet.has(f));

    pattern.scores = {
      filePrecision:
        predictedSet.size > 0 ? intersection.length / predictedSet.size : 0,
      fileRecall: actualSet.size > 0 ? intersection.length / actualSet.size : 0,
      timeAccuracy:
        pattern.predictions.timeMinutes > 0
          ? 1 -
            Math.abs(pattern.predictions.timeMinutes - actualMinutes) /
              Math.max(actualMinutes, pattern.predictions.timeMinutes)
          : 0,
      conflictPredictionHit: false, // Updated if conflicts occur
    };

    this.kb.updatePattern(pattern);

    // Update file associations for learning
    const keywords = pattern.input.keywords;
    for (const keyword of keywords) {
      for (const file of actualFiles) {
        this.kb.updateFileAssociation(keyword, file);
      }
    }

    // Record co-modifications for conflict prediction
    this.kb.recordCoModification(actualFiles);

    console.log(
      `   Learning captured: Precision=${(pattern.scores.filePrecision * 100).toFixed(0)}%, Recall=${(pattern.scores.fileRecall * 100).toFixed(0)}%`
    );
  }
}

// Export singleton
export const orchestrator = new SwarmOrchestrator();
