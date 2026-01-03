/**
 * Swarm Orchestrator - Multi-Agent Orchestration for Parallel Issue Processing
 *
 * Main entry point for the swarm-orchestrator package.
 * Exports all public APIs for orchestrating parallel Claude Code agents.
 */

// ============================================================================
// Types and Constants
// ============================================================================

export {
  // Core orchestration types
  type SwarmPhase,
  type WorkerStatus,
  type SwarmConfig,
  type SwarmState,
  type WorkerState,
  type WorkerResult,
  type OverlapAnalysis,

  // Knowledge base types
  type IssuePattern,
  type FileAssociation,
  type ConflictPair,
  type LearningMetrics,
  type InvertedIndex,

  // Linear integration types
  type LinearIssue,

  // Default heuristics for cold start
  DEFAULT_HEURISTICS,

  // Utility functions
  createEmptyPattern,
} from './types.js';

// ============================================================================
// Knowledge Base
// ============================================================================

export {
  KnowledgeBase,
  kb, // Singleton instance
} from './knowledge-base.js';

// ============================================================================
// Orchestrator
// ============================================================================

export {
  SwarmOrchestrator,
  orchestrator, // Singleton instance
  loadConfig,
  saveConfig,
  fetchLinearIssues,
} from './orchestrator.js';

// ============================================================================
// Worker Protocol
// ============================================================================

export {
  SwarmWorker,
  worker, // Singleton instance
} from './worker.js';

// ============================================================================
// Batch Suggestion System
// ============================================================================

export {
  // Types
  type CompatibilityScore,
  type IssuePrediction,
  type SwarmBatch,
  type SuggestOptions,

  // Main functions
  suggestBatches,
  formatBatchOutput,

  // Utility functions
  getAssigneeScore,
  getAssigneeLabel,
  detectLayers,
  estimateComplexity,
  predictFiles,
  calculateCompatibility,
  generatePredictions,
  buildCompatibilityMatrix,
  getPriorityLabel,
} from './suggest.js';
