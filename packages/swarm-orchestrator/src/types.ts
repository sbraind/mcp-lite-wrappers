/**
 * Swarm Orchestrator Types
 * Multi-agent orchestration for parallel issue processing
 */

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface IssuePattern {
  id: string;
  timestamp: string;

  input: {
    issueId: string;
    title: string;
    description: string;
    labels: string[];
    keywords: string[];
    fileHints: string[];
    scopeSignals: {
      isNewFeature: boolean;
      isBugFix: boolean;
      isRefactor: boolean;
      affectedLayers: string[];
    };
  };

  predictions: {
    files: string[];
    timeMinutes: number;
    complexity: 'low' | 'medium' | 'high';
    conflictRisk: number;
    confidence: 'cold_start' | 'low' | 'medium' | 'high';
  };

  outcomes: {
    filesActual: string[];
    timeActualMinutes: number;
    conflicts: string[];
    success: boolean;
    rollbackReason?: string;
  };

  scores: {
    filePrecision: number;
    fileRecall: number;
    timeAccuracy: number;
    conflictPredictionHit: boolean;
  };
}

export interface FileAssociation {
  keyword: string;
  files: {
    path: string;
    frequency: number;
    lastSeen: string;
  }[];
}

export interface ConflictPair {
  fileA: string;
  fileB: string;
  conflictCount: number;
  coModificationCount: number;
  conflictRate: number;
}

export interface LearningMetrics {
  totalPatterns: number;
  totalSwarmRuns: number;
  accuracy: {
    date: string;
    filePrecision: number;
    fileRecall: number;
    timeAccuracy: number;
    conflictPredictionAccuracy: number;
  }[];
  coldStartAccuracy: {
    filePrecision: number;
    fileRecall: number;
  };
  learnedAccuracy: {
    filePrecision: number;
    fileRecall: number;
  };
  improvementRate: number;
  lastUpdated: string | null;
}

export interface InvertedIndex {
  keywords: Record<string, string[]>;
  files: Record<string, string[]>;
  lastUpdated: string;
}

// ============================================================================
// Swarm Orchestration Types
// ============================================================================

export type SwarmPhase =
  | 'initializing'
  | 'analyzing'
  | 'planning'
  | 'preparing'
  | 'executing'
  | 'merging'
  | 'completed'
  | 'failed';

export type WorkerStatus =
  | 'pending'
  | 'initializing'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface SwarmConfig {
  version: string;
  maxWorkers: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  worktreeBaseDir: string;
  branchPrefix: string;
  commitPrefix: string;
  learning: {
    enabled: boolean;
    minPatternsForPrediction: number;
    similarPatternsToRetrieve: number;
    decayDays: number;
  };
  coldStart: {
    bootstrapFromGit: boolean;
    maxCommitsToAnalyze: number;
  };
  overlap: {
    riskThreshold: number;
    blockOnHighRisk: boolean;
  };
  // Custom heuristics can be added per-project
  customHeuristics?: {
    keywordToGlob?: Record<string, string[]>;
    layerKeywords?: Record<string, string[]>;
  };
}

export interface SwarmState {
  id: string;
  phase: SwarmPhase;
  startedAt: string;
  updatedAt: string;
  baseBranch: string;
  issues: string[];
  workers: WorkerState[];
  overlapAnalysis: OverlapAnalysis | null;
  mergeOrder: string[];
  error?: string;
}

export interface WorkerResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  linearStatus?: 'In Review' | 'Done';
}

export interface WorkerState {
  id: string;
  workerId: number;
  issueId: string;
  patternId: string;
  status: WorkerStatus;
  branch: string;
  worktreePath: string;
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeat: string | null;
  progress: {
    currentStep: string;
    completedSteps: number;
    totalSteps: number;
  };
  result?: WorkerResult;
  error?: string;
}

export interface OverlapAnalysis {
  issues: {
    id: string;
    predictedFiles: string[];
    confidence: number;
  }[];
  overlapMatrix: Record<string, Record<string, {
    sharedFiles: string[];
    riskLevel: 'none' | 'low' | 'medium' | 'high';
  }>>;
  recommendation: 'proceed' | 'reorder' | 'sequential';
  warnings: string[];
}

// ============================================================================
// Linear Integration Types
// ============================================================================

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  estimate?: number;
  state?: {
    id: string;
    name: string;
  };
  status?: string;
  labels: { nodes: { name: string }[] } | string[];
  assignee?: {
    id: string;
    name: string;
  } | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

// ============================================================================
// Default Cold Start Heuristics (Generic)
// ============================================================================

export const DEFAULT_HEURISTICS = {
  keywordToGlob: {
    // UI/Components
    'button': ['**/components/**/*Button*', '**/ui/**/*Button*'],
    'modal': ['**/components/**/*Modal*', '**/components/**/*Dialog*'],
    'form': ['**/components/**/*Form*', '**/components/forms/**'],
    'table': ['**/components/**/*Table*', '**/components/**/*Grid*'],
    'card': ['**/components/**/*Card*'],
    'chart': ['**/components/**/*Chart*', '**/components/charts/**'],
    'dashboard': ['**/pages/Dashboard*', '**/components/dashboard/**'],

    // Features
    'auth': ['**/auth/**', '**/login/**', '**/hooks/useAuth*'],
    'user': ['**/user/**', '**/users/**', '**/profile/**'],
    'settings': ['**/settings/**', '**/preferences/**'],
    'notification': ['**/notification*/**', '**/hooks/useNotif*'],

    // Technical
    'api': ['**/api/**', '**/services/**', '**/lib/api*'],
    'hook': ['**/hooks/**'],
    'util': ['**/utils/**', '**/lib/**', '**/helpers/**'],
    'type': ['**/types/**', '**/*.d.ts'],
    'test': ['**/*.test.*', '**/*.spec.*', '**/tests/**'],
    'style': ['**/*.css', '**/*.scss', '**/styles/**'],
    'config': ['**/config/**', '**/*.config.*'],

    // Pages/Routes
    'page': ['**/pages/**', '**/app/**'],
    'route': ['**/routes/**', '**/router/**'],

    // Database
    'migration': ['**/migrations/**', '**/supabase/migrations/**'],
    'schema': ['**/schema/**', '**/database/**'],
  } as Record<string, string[]>,

  complexitySignals: {
    high: ['refactor', 'migrate', 'rewrite', 'architecture', 'breaking', 'overhaul', 'redesign'],
    medium: ['feature', 'add', 'implement', 'update', 'improve', 'enhance', 'extend'],
    low: ['fix', 'typo', 'docs', 'style', 'minor', 'tweak', 'adjust', 'rename'],
  } as Record<string, string[]>,

  timeEstimates: {
    low: 30,
    medium: 120,
    high: 480,
  } as Record<string, number>,

  layerKeywords: {
    ui: ['button', 'modal', 'form', 'table', 'card', 'chart', 'component', 'page', 'style', 'css'],
    hooks: ['hook', 'use', 'state', 'effect', 'context'],
    api: ['api', 'service', 'fetch', 'request', 'endpoint'],
    database: ['migration', 'schema', 'table', 'column', 'index', 'trigger'],
    test: ['test', 'spec', 'mock', 'fixture', 'e2e'],
  } as Record<string, string[]>,
};

// ============================================================================
// Utility Functions
// ============================================================================

export function createEmptyPattern(issueId: string, title: string): Partial<IssuePattern> {
  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    input: {
      issueId,
      title,
      description: '',
      labels: [],
      keywords: [],
      fileHints: [],
      scopeSignals: {
        isNewFeature: false,
        isBugFix: false,
        isRefactor: false,
        affectedLayers: [],
      },
    },
    predictions: {
      files: [],
      timeMinutes: 0,
      complexity: 'medium',
      conflictRisk: 0,
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
}
