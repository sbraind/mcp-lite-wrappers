#!/usr/bin/env node

/**
 * Swarm Orchestrator CLI
 * Generic CLI for multi-agent orchestration with Linear integration
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import type { SwarmConfig } from './types.js';
import { kb } from './knowledge-base.js';
import { predictIssue } from './suggest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Constants
// ============================================================================

const SWARM_DIR = path.join(process.cwd(), '.claude/swarm');
const CONFIG_FILE = path.join(SWARM_DIR, '.swarm-config.json');
const STATE_FILE = path.join(SWARM_DIR, 'state.json');
const SKILLS_TARGET_DIR = path.join(process.cwd(), '.claude/skills');

// Default configuration
const DEFAULT_CONFIG: SwarmConfig = {
  version: '1.0.0',
  maxWorkers: 5,
  heartbeatIntervalMs: 30000,
  heartbeatTimeoutMs: 300000,
  worktreeBaseDir: '.claude/swarm/workers',
  branchPrefix: 'swarm/',
  commitPrefix: 'swarm',
  learning: {
    enabled: true,
    minPatternsForPrediction: 3,
    similarPatternsToRetrieve: 5,
    decayDays: 90,
  },
  coldStart: {
    bootstrapFromGit: true,
    maxCommitsToAnalyze: 200,
  },
  overlap: {
    riskThreshold: 0.3,
    blockOnHighRisk: false,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig(): SwarmConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error('Swarm not initialized. Run: swarm init');
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config: SwarmConfig): void {
  ensureDir(SWARM_DIR);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function requireEnv(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    console.error(`Error: ${varName} environment variable is required`);
    console.error(`Set it with: export ${varName}="your-value"`);
    process.exit(1);
  }
  return value;
}

function getLinearApiKey(): string {
  return requireEnv('LINEAR_API_KEY');
}

function getLinearTeamId(): string {
  return requireEnv('LINEAR_TEAM_ID');
}

function copySkillsToProject(): void {
  // Find the package's skills directory
  // When installed as npm package, skills/ will be in the package root
  const packageRoot = path.join(__dirname, '..');
  const skillsSourceDir = path.join(packageRoot, 'skills');

  if (!fs.existsSync(skillsSourceDir)) {
    console.warn(`Warning: Skills directory not found at ${skillsSourceDir}`);
    console.warn('Skipping skills installation.');
    return;
  }

  ensureDir(SKILLS_TARGET_DIR);

  // Copy all skill files
  const skillFiles = fs.readdirSync(skillsSourceDir);
  let copiedCount = 0;

  for (const file of skillFiles) {
    const sourcePath = path.join(skillsSourceDir, file);
    const targetPath = path.join(SKILLS_TARGET_DIR, file);

    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      console.log(`  ✓ Installed skill: ${file}`);
    }
  }

  if (copiedCount === 0) {
    console.warn('No skill files found to install.');
  } else {
    console.log(`\nInstalled ${copiedCount} skill(s) to .claude/skills/`);
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// CLI Commands
// ============================================================================

async function initCommand(): Promise<void> {
  console.log('Initializing Swarm Orchestrator...\n');

  // Check if already initialized
  if (fs.existsSync(CONFIG_FILE)) {
    console.log('Swarm already initialized.');
    console.log(`Config: ${CONFIG_FILE}`);
    console.log('\nTo reconfigure, delete the config file and run init again.');
    return;
  }

  // Ensure we're in a git repository
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch {
    console.error('Error: Not in a git repository. Initialize git first.');
    process.exit(1);
  }

  // Create directories
  ensureDir(SWARM_DIR);
  ensureDir(path.join(process.cwd(), DEFAULT_CONFIG.worktreeBaseDir));
  ensureDir(path.join(SWARM_DIR, 'kb'));

  // Save default config
  saveConfig(DEFAULT_CONFIG);
  console.log('✓ Created swarm configuration');

  // Copy skills to project
  console.log('\nInstalling swarm skills...');
  copySkillsToProject();

  // Initialize knowledge base
  console.log('\nInitializing knowledge base...');
  kb.ensureDirectories();
  console.log('✓ Knowledge base initialized');

  console.log('\n' + '='.repeat(60));
  console.log('Swarm Orchestrator initialized successfully!');
  console.log('='.repeat(60));
  console.log('\nConfiguration:');
  console.log(`  Location: ${CONFIG_FILE}`);
  console.log(`  Max workers: ${DEFAULT_CONFIG.maxWorkers}`);
  console.log(`  Worktree base: ${DEFAULT_CONFIG.worktreeBaseDir}`);
  console.log('\nRequired environment variables:');
  console.log('  LINEAR_API_KEY - Your Linear API key');
  console.log('  LINEAR_TEAM_ID - Your Linear team ID');
  console.log('\nNext steps:');
  console.log('  1. Set environment variables (see above)');
  console.log('  2. Run: swarm bootstrap (optional - learn from git history)');
  console.log('  3. Run: swarm start <issue-id-1> <issue-id-2> ...');
  console.log('\nFor help: swarm --help');
}

async function bootstrapCommand(): Promise<void> {
  console.log('Bootstrapping knowledge base from git history...\n');

  const config = loadConfig();

  if (!config.coldStart.bootstrapFromGit) {
    console.log('Cold start bootstrapping is disabled in config.');
    console.log('Enable it by setting coldStart.bootstrapFromGit = true');
    return;
  }

  console.log(`Analyzing last ${config.coldStart.maxCommitsToAnalyze} commits...`);

  try {
    kb.coldStartFromGitHistory({
      maxCommits: config.coldStart.maxCommitsToAnalyze,
      minFilesChanged: 1,
      excludePatterns: [
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
        '*.lock',
        'dist/',
        'build/',
        '.next/',
      ],
    });

    const stats = kb.getStats();
    console.log('\n' + '='.repeat(60));
    console.log('Bootstrap complete!');
    console.log('='.repeat(60));
    console.log(`\nKnowledge Base Stats:`);
    console.log(`  Total patterns: ${stats.totalPatterns}`);
    console.log(`  File associations: ${stats.totalFileAssociations}`);
    console.log(`  Conflict pairs: ${stats.totalConflictPairs}`);
    console.log(`\nThe swarm can now make predictions based on historical patterns.`);
  } catch (error) {
    console.error('Error during bootstrap:', error);
    process.exit(1);
  }
}

async function startCommand(issueIds: string[]): Promise<void> {
  if (issueIds.length === 0) {
    console.error('Error: No issue IDs provided');
    console.log('Usage: swarm start <issue-id-1> <issue-id-2> ...');
    console.log('Example: swarm start BT-42 BT-43 BT-44');
    process.exit(1);
  }

  console.log('Starting swarm execution...\n');
  console.log(`Issues: ${issueIds.join(', ')}`);

  // Verify environment
  getLinearApiKey();
  getLinearTeamId();

  const config = loadConfig();

  if (issueIds.length > config.maxWorkers) {
    console.warn(`Warning: ${issueIds.length} issues exceeds maxWorkers (${config.maxWorkers})`);
    console.warn('Some issues will be queued.');
  }

  console.log('\nThis will:');
  console.log('  1. Fetch issues from Linear');
  console.log('  2. Predict file overlaps');
  console.log('  3. Create git worktrees');
  console.log('  4. Execute issues in parallel');
  console.log('  5. Monitor progress');
  console.log('\nNote: The actual swarm execution is handled by the orchestrator module.');
  console.log('Import and use SwarmOrchestrator from this package programmatically,');
  console.log('or integrate with your CI/CD pipeline.');
}

async function monitorCommand(): Promise<void> {
  if (!fs.existsSync(STATE_FILE)) {
    console.log('No active swarm session found.');
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  console.log('='.repeat(60));
  console.log('Swarm Status');
  console.log('='.repeat(60));
  console.log(`\nSession ID: ${state.id}`);
  console.log(`Phase: ${state.phase}`);
  console.log(`Started: ${new Date(state.startedAt).toLocaleString()}`);
  console.log(`Updated: ${new Date(state.updatedAt).toLocaleString()}`);
  console.log(`Base branch: ${state.baseBranch}`);

  if (state.workers.length > 0) {
    console.log(`\nWorkers (${state.workers.length}):`);
    for (const worker of state.workers) {
      const duration = worker.startedAt && worker.completedAt
        ? formatDuration(new Date(worker.completedAt).getTime() - new Date(worker.startedAt).getTime())
        : worker.startedAt
        ? formatDuration(Date.now() - new Date(worker.startedAt).getTime()) + ' (running)'
        : '-';

      console.log(`\n  [${worker.workerId}] ${worker.issueId}`);
      console.log(`      Status: ${worker.status}`);
      console.log(`      Branch: ${worker.branch}`);
      console.log(`      Duration: ${duration}`);

      if (worker.progress) {
        console.log(`      Progress: ${worker.progress.completedSteps}/${worker.progress.totalSteps} - ${worker.progress.currentStep}`);
      }

      if (worker.error) {
        console.log(`      Error: ${worker.error}`);
      }
    }
  }

  if (state.overlapAnalysis) {
    console.log(`\nOverlap Analysis:`);
    console.log(`  Recommendation: ${state.overlapAnalysis.recommendation}`);
    if (state.overlapAnalysis.warnings.length > 0) {
      console.log(`  Warnings:`);
      for (const warning of state.overlapAnalysis.warnings) {
        console.log(`    - ${warning}`);
      }
    }
  }
}

async function mergeCommand(): Promise<void> {
  console.log('Merging completed worker branches...\n');

  if (!fs.existsSync(STATE_FILE)) {
    console.log('No active swarm session found.');
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  const completedWorkers = state.workers.filter((w: any) => w.status === 'completed');

  if (completedWorkers.length === 0) {
    console.log('No completed workers to merge.');
    return;
  }

  console.log(`Found ${completedWorkers.length} completed worker(s):`);
  for (const worker of completedWorkers) {
    console.log(`  - ${worker.issueId} (${worker.branch})`);
  }

  console.log('\nMerge order:', state.mergeOrder.join(' -> ') || 'sequential');
  console.log('\nNote: Actual merge logic should be implemented in your orchestrator.');
  console.log('This CLI provides monitoring and stats. Use the SwarmOrchestrator');
  console.log('class for programmatic control.');
}

async function statsCommand(): Promise<void> {
  console.log('Knowledge Base Statistics\n');
  console.log('='.repeat(60));

  const stats = kb.getStats();

  console.log('\nGeneral:');
  console.log(`  Total patterns: ${stats.totalPatterns}`);
  console.log(`  Total swarm runs: ${stats.totalSwarmRuns}`);
  console.log(`  File associations: ${stats.totalFileAssociations}`);
  console.log(`  Conflict pairs: ${stats.totalConflictPairs}`);

  if (stats.accuracy.length > 0) {
    const latest = stats.accuracy[stats.accuracy.length - 1];
    console.log('\nLatest Accuracy Metrics:');
    console.log(`  File precision: ${(latest.filePrecision * 100).toFixed(1)}%`);
    console.log(`  File recall: ${(latest.fileRecall * 100).toFixed(1)}%`);
    console.log(`  Time accuracy: ${(latest.timeAccuracy * 100).toFixed(1)}%`);
    console.log(`  Conflict prediction: ${(latest.conflictPredictionAccuracy * 100).toFixed(1)}%`);
  }

  if (stats.coldStartAccuracy && stats.learnedAccuracy) {
    console.log('\nCold Start vs Learned:');
    console.log(`  Cold start precision: ${(stats.coldStartAccuracy.filePrecision * 100).toFixed(1)}%`);
    console.log(`  Learned precision: ${(stats.learnedAccuracy.filePrecision * 100).toFixed(1)}%`);
    console.log(`  Improvement: ${(stats.improvementRate * 100).toFixed(1)}%`);
  }

  console.log(`\nLast updated: ${stats.lastUpdated || 'Never'}`);
  console.log('\nKnowledge base location: .claude/swarm/kb/');
}

async function predictCommand(issueId: string): Promise<void> {
  if (!issueId) {
    console.error('Error: Issue ID required');
    console.log('Usage: swarm predict <issue-id>');
    console.log('Example: swarm predict BT-42');
    process.exit(1);
  }

  console.log(`Predicting scope for issue: ${issueId}\n`);

  // Verify environment
  const apiKey = getLinearApiKey();
  const teamId = getLinearTeamId();

  console.log('Fetching issue from Linear...');

  // Mock issue data structure - in real usage, fetch from Linear API
  // This is just to demonstrate the prediction capability
  const mockIssue = {
    id: issueId,
    identifier: issueId,
    title: `Issue ${issueId}`,
    description: 'Sample issue for prediction',
    priority: 2,
    labels: [],
  };

  console.log(`Title: ${mockIssue.title}\n`);
  console.log('Running prediction...\n');

  const prediction = predictIssue(mockIssue);

  console.log('='.repeat(60));
  console.log('Prediction Results');
  console.log('='.repeat(60));
  console.log(`\nConfidence: ${prediction.confidence}`);
  console.log(`Complexity: ${prediction.complexity}`);
  console.log(`Estimated time: ${prediction.timeMinutes} minutes`);
  console.log(`Conflict risk: ${(prediction.conflictRisk * 100).toFixed(1)}%`);

  if (prediction.predictedFiles.length > 0) {
    console.log(`\nPredicted files (${prediction.predictedFiles.length}):`);
    for (const file of prediction.predictedFiles.slice(0, 10)) {
      console.log(`  - ${file}`);
    }
    if (prediction.predictedFiles.length > 10) {
      console.log(`  ... and ${prediction.predictedFiles.length - 10} more`);
    }
  } else {
    console.log('\nNo specific files predicted (cold start mode)');
  }

  if (prediction.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of prediction.warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }

  console.log('\nNote: This prediction is based on historical patterns.');
  console.log('Run "swarm bootstrap" to improve prediction accuracy.');
}

async function cleanCommand(): Promise<void> {
  console.log('Cleaning up swarm workspace...\n');

  let cleaned = 0;

  // Clean state file
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('✓ Removed state file');
    cleaned++;
  }

  // Clean worktrees (if any exist)
  const config = loadConfig();
  const worktreeBase = path.join(process.cwd(), config.worktreeBaseDir);

  if (fs.existsSync(worktreeBase)) {
    const worktrees = fs.readdirSync(worktreeBase);
    if (worktrees.length > 0) {
      console.log(`Found ${worktrees.length} worktree(s) to clean...`);
      for (const wt of worktrees) {
        const wtPath = path.join(worktreeBase, wt);
        try {
          execSync(`git worktree remove ${wtPath} --force`, { stdio: 'ignore' });
          console.log(`✓ Removed worktree: ${wt}`);
          cleaned++;
        } catch (error) {
          console.warn(`⚠ Could not remove worktree: ${wt}`);
        }
      }
    }
  }

  if (cleaned === 0) {
    console.log('Nothing to clean.');
  } else {
    console.log(`\nCleaned ${cleaned} item(s).`);
  }

  console.log('\nNote: This does not remove the knowledge base or configuration.');
  console.log('To reset completely, delete .claude/swarm/ directory.');
}

async function suggestCommand(): Promise<void> {
  console.log('Suggesting next issues for parallel execution...\n');

  // Verify environment
  getLinearApiKey();
  const teamId = getLinearTeamId();

  console.log(`Team ID: ${teamId}`);
  console.log('\nAnalyzing backlog for optimal parallel execution...');
  console.log('\nNote: This requires integration with Linear API.');
  console.log('Implement the full suggestion logic by:');
  console.log('  1. Fetching backlog issues from Linear');
  console.log('  2. Running predictions on each issue');
  console.log('  3. Analyzing file overlap matrix');
  console.log('  4. Finding optimal non-overlapping set');
  console.log('\nUse the suggest.ts module programmatically for this.');
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('swarm')
  .description('Multi-agent orchestration for parallel issue execution with Claude Code')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize swarm orchestrator in current project')
  .action(initCommand);

program
  .command('bootstrap')
  .description('Bootstrap knowledge base from git history')
  .action(bootstrapCommand);

program
  .command('start <issue-ids...>')
  .description('Start swarm execution for given issue IDs')
  .action(startCommand);

program
  .command('monitor')
  .description('Monitor active swarm session')
  .alias('status')
  .action(monitorCommand);

program
  .command('merge')
  .description('Merge completed worker branches')
  .action(mergeCommand);

program
  .command('stats')
  .description('Show knowledge base statistics and learning metrics')
  .action(statsCommand);

program
  .command('predict <issue-id>')
  .description('Predict file scope and complexity for an issue')
  .action(predictCommand);

program
  .command('clean')
  .description('Clean up swarm workspace and remove state')
  .action(cleanCommand);

program
  .command('suggest')
  .description('Suggest optimal next issues for parallel execution')
  .action(suggestCommand);

// Parse and execute
program.parse(process.argv);
