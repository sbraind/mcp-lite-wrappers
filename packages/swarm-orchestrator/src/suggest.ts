/**
 * Swarm Suggest System
 * Intelligent batch suggestion for parallel issue execution
 */

import { LinearIssue, DEFAULT_HEURISTICS } from './types.js';
import { KnowledgeBase } from './knowledge-base.js';

// ============================================================================
// Types
// ============================================================================

export interface CompatibilityScore {
  total: number;
  breakdown: {
    fileScore: number;
    layerScore: number;
    complexityScore: number;
    priorityScore: number;
    historyScore: number;
  };
  risk: 'low' | 'medium' | 'high';
  sharedFiles: string[];
  sharedLayers: string[];
}

export interface IssuePrediction {
  issue: LinearIssue;
  predictedFiles: string[];
  predictedLayers: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
  confidence: number;
}

export interface SwarmBatch {
  id: string;
  issues: LinearIssue[];
  predictions: IssuePrediction[];
  score: number;
  estimatedTimeMinutes: number;
  parallelTimeMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string[];
  warnings: string[];
}

export interface SuggestOptions {
  maxBatchSize: number;
  numBatches: number;
  includeBacklog: boolean;
  minCompatibility: number;
  currentUserId?: string | null;
}

const DEFAULT_OPTIONS: SuggestOptions = {
  maxBatchSize: 5,
  numBatches: 3,
  includeBacklog: false,
  minCompatibility: 0.6,
  currentUserId: null,
};

// ============================================================================
// Assignee Scoring
// ============================================================================

export function getAssigneeScore(issue: LinearIssue, currentUserId?: string | null): number {
  const assigneeId = issue.assigneeId || issue.assignee?.id || null;

  if (!assigneeId) {
    // Unassigned - high priority (available for pickup)
    return 0.9;
  }

  if (currentUserId && assigneeId === currentUserId) {
    // Assigned to me - highest priority
    return 1.0;
  }

  // Assigned to someone else - low priority
  return 0.3;
}

export function getAssigneeLabel(issue: LinearIssue, currentUserId?: string | null): string {
  const assigneeId = issue.assigneeId || issue.assignee?.id || null;
  const assigneeName = issue.assigneeName || issue.assignee?.name || null;

  if (!assigneeId) {
    return '🔓 Unassigned';
  }

  if (currentUserId && assigneeId === currentUserId) {
    return '👤 Mine';
  }

  return `➡️ ${assigneeName || 'Other'}`;
}

// ============================================================================
// Layer Detection
// ============================================================================

export function detectLayers(issue: LinearIssue): string[] {
  const text = `${issue.title} ${issue.description || ''}`.toLowerCase();
  const detectedLayers: string[] = [];

  for (const [layer, keywords] of Object.entries(DEFAULT_HEURISTICS.layerKeywords)) {
    if (keywords.some(kw => text.includes(kw))) {
      detectedLayers.push(layer);
    }
  }

  // Default to 'general' if no layers detected
  return detectedLayers.length > 0 ? detectedLayers : ['general'];
}

// ============================================================================
// Complexity Estimation
// ============================================================================

export function estimateComplexity(issue: LinearIssue): { level: 'low' | 'medium' | 'high'; minutes: number } {
  const text = `${issue.title} ${issue.description || ''}`.toLowerCase();

  // Check priority as a signal
  if (issue.priority === 1) {
    // Urgent issues are often more complex or critical
    return { level: 'high', minutes: DEFAULT_HEURISTICS.timeEstimates.high };
  }

  // Check keywords
  for (const [level, signals] of Object.entries(DEFAULT_HEURISTICS.complexitySignals)) {
    if (signals.some(kw => text.includes(kw))) {
      return {
        level: level as 'low' | 'medium' | 'high',
        minutes: DEFAULT_HEURISTICS.timeEstimates[level as keyof typeof DEFAULT_HEURISTICS.timeEstimates]
      };
    }
  }

  // Default to medium
  return { level: 'medium', minutes: DEFAULT_HEURISTICS.timeEstimates.medium };
}

// ============================================================================
// File Prediction
// ============================================================================

export function predictFiles(issue: LinearIssue, knowledgeBase: KnowledgeBase): string[] {
  const text = `${issue.title} ${issue.description || ''}`;
  const keywords = knowledgeBase.extractKeywords(text);

  // Try KB-based prediction first
  const kbPredictions = knowledgeBase.predictFilesFromKeywords(keywords);

  if (kbPredictions.length > 0) {
    return kbPredictions.slice(0, 10);
  }

  // Fall back to cold start heuristics
  const coldStartFiles: string[] = [];
  for (const keyword of keywords) {
    const globs = DEFAULT_HEURISTICS.keywordToGlob[keyword.toLowerCase()];
    if (globs) {
      coldStartFiles.push(...globs);
    }
  }

  return [...new Set(coldStartFiles)].slice(0, 10);
}

// ============================================================================
// Compatibility Scoring
// ============================================================================

export function calculateCompatibility(
  issueA: LinearIssue,
  issueB: LinearIssue,
  predictionA: IssuePrediction,
  predictionB: IssuePrediction,
  knowledgeBase: KnowledgeBase
): CompatibilityScore {
  // 1. File Overlap Score (0-1, higher = less overlap = better)
  const filesA = new Set(predictionA.predictedFiles);
  const filesB = new Set(predictionB.predictedFiles);
  const sharedFiles = [...filesA].filter(f => filesB.has(f));
  const unionSize = new Set([...filesA, ...filesB]).size;
  const overlapRatio = unionSize > 0 ? sharedFiles.length / unionSize : 0;
  const fileScore = 1 - overlapRatio;

  // 2. Layer Independence Score (0-1)
  const layersA = new Set(predictionA.predictedLayers);
  const layersB = new Set(predictionB.predictedLayers);
  const sharedLayers = [...layersA].filter(l => layersB.has(l));
  const maxLayers = Math.max(layersA.size, layersB.size, 1);
  const layerScore = 1 - (sharedLayers.length / maxLayers);

  // 3. Complexity Balance Score (0-1)
  const complexityMap = { low: 1, medium: 5, high: 10 };
  const complexityA = complexityMap[predictionA.complexity];
  const complexityB = complexityMap[predictionB.complexity];
  const complexityDiff = Math.abs(complexityA - complexityB);
  const complexityScore = 1 - (complexityDiff / 10);

  // 4. Priority Alignment Score (0-1)
  const priorityDiff = Math.abs(issueA.priority - issueB.priority);
  const priorityScore = 1 - (priorityDiff / 4);

  // 5. Historical Conflict Score (0-1)
  let historyScore = 1;
  if (sharedFiles.length > 0) {
    // Check KB for historical conflicts
    let totalConflictRisk = 0;
    let pairCount = 0;

    for (const fileA of predictionA.predictedFiles) {
      for (const fileB of predictionB.predictedFiles) {
        const risk = knowledgeBase.getConflictRisk(fileA, fileB);
        if (risk > 0) {
          totalConflictRisk += risk;
          pairCount++;
        }
      }
    }

    if (pairCount > 0) {
      historyScore = 1 - (totalConflictRisk / pairCount);
    }
  }

  // Weighted combination
  const weights = {
    file: 0.40,
    layer: 0.25,
    complexity: 0.15,
    priority: 0.10,
    history: 0.10,
  };

  const totalScore =
    fileScore * weights.file +
    layerScore * weights.layer +
    complexityScore * weights.complexity +
    priorityScore * weights.priority +
    historyScore * weights.history;

  // Determine risk level
  let risk: 'low' | 'medium' | 'high';
  if (totalScore >= 0.7) risk = 'low';
  else if (totalScore >= 0.5) risk = 'medium';
  else risk = 'high';

  return {
    total: totalScore,
    breakdown: { fileScore, layerScore, complexityScore, priorityScore, historyScore },
    risk,
    sharedFiles,
    sharedLayers,
  };
}

// ============================================================================
// Batch Generation
// ============================================================================

export function generatePredictions(issues: LinearIssue[], knowledgeBase: KnowledgeBase): IssuePrediction[] {
  return issues.map(issue => {
    const predictedFiles = predictFiles(issue, knowledgeBase);
    const predictedLayers = detectLayers(issue);
    const { level: complexity, minutes: estimatedMinutes } = estimateComplexity(issue);

    // Confidence based on KB data
    const similarPatterns = knowledgeBase.findSimilarPatterns(issue.title, issue.description || '');
    const confidence = similarPatterns.length >= 5 ? 0.8 : similarPatterns.length >= 2 ? 0.5 : 0.3;

    return {
      issue,
      predictedFiles,
      predictedLayers,
      complexity,
      estimatedMinutes,
      confidence,
    };
  });
}

export function buildCompatibilityMatrix(
  predictions: IssuePrediction[],
  knowledgeBase: KnowledgeBase
): Map<string, Map<string, CompatibilityScore>> {
  const matrix = new Map<string, Map<string, CompatibilityScore>>();

  for (const predA of predictions) {
    matrix.set(predA.issue.identifier, new Map());

    for (const predB of predictions) {
      if (predA.issue.identifier !== predB.issue.identifier) {
        const score = calculateCompatibility(
          predA.issue,
          predB.issue,
          predA,
          predB,
          knowledgeBase
        );
        matrix.get(predA.issue.identifier)!.set(predB.issue.identifier, score);
      }
    }
  }

  return matrix;
}

function greedyBatchSelection(
  predictions: IssuePrediction[],
  matrix: Map<string, Map<string, CompatibilityScore>>,
  maxSize: number,
  minCompatibility: number,
  excludeIds: Set<string> = new Set(),
  currentUserId?: string | null
): IssuePrediction[] {
  const available = predictions.filter(p => !excludeIds.has(p.issue.identifier));
  if (available.length === 0) return [];

  // Sort by: assignee preference (mine/unassigned first), then priority (P1 first)
  const sorted = [...available].sort((a, b) => {
    const assigneeA = getAssigneeScore(a.issue, currentUserId);
    const assigneeB = getAssigneeScore(b.issue, currentUserId);

    // Primary sort: assignee preference (higher score = mine/unassigned)
    if (assigneeA !== assigneeB) {
      return assigneeB - assigneeA; // Descending (higher first)
    }

    // Secondary sort: priority (lower = higher priority)
    return a.issue.priority - b.issue.priority;
  });

  const batch: IssuePrediction[] = [sorted[0]];
  const remaining = sorted.slice(1);

  while (batch.length < maxSize && remaining.length > 0) {
    let bestCandidate: IssuePrediction | null = null;
    let bestAvgScore = -1;

    for (const candidate of remaining) {
      // Calculate average compatibility with all issues in batch
      let totalScore = 0;
      let validScores = 0;

      for (const batchItem of batch) {
        const score = matrix.get(batchItem.issue.identifier)?.get(candidate.issue.identifier);
        if (score) {
          totalScore += score.total;
          validScores++;
        }
      }

      const avgScore = validScores > 0 ? totalScore / validScores : 0;

      if (avgScore > bestAvgScore && avgScore >= minCompatibility) {
        bestAvgScore = avgScore;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      batch.push(bestCandidate);
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    } else {
      break; // No compatible candidates left
    }
  }

  return batch;
}

function calculateBatchScore(
  batch: IssuePrediction[],
  matrix: Map<string, Map<string, CompatibilityScore>>
): number {
  if (batch.length <= 1) return 1;

  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < batch.length; i++) {
    for (let j = i + 1; j < batch.length; j++) {
      const score = matrix.get(batch[i].issue.identifier)?.get(batch[j].issue.identifier);
      if (score) {
        totalScore += score.total;
        pairCount++;
      }
    }
  }

  return pairCount > 0 ? totalScore / pairCount : 0;
}

function generateReasoning(
  batch: IssuePrediction[],
  matrix: Map<string, Map<string, CompatibilityScore>>
): { reasoning: string[]; warnings: string[] } {
  const reasoning: string[] = [];
  const warnings: string[] = [];

  // Check file overlap
  const allFiles = new Set<string>();
  const sharedFiles = new Set<string>();

  for (const pred of batch) {
    for (const file of pred.predictedFiles) {
      if (allFiles.has(file)) {
        sharedFiles.add(file);
      }
      allFiles.add(file);
    }
  }

  if (sharedFiles.size === 0) {
    reasoning.push('Zero predicted file overlap');
  } else if (sharedFiles.size <= 2) {
    warnings.push(`Low overlap: ${sharedFiles.size} shared file(s): ${[...sharedFiles].slice(0, 2).join(', ')}`);
  } else {
    warnings.push(`High overlap risk: ${sharedFiles.size} shared files`);
  }

  // Check layer diversity
  const allLayers = new Set<string>();
  for (const pred of batch) {
    pred.predictedLayers.forEach(l => allLayers.add(l));
  }

  if (allLayers.size >= batch.length) {
    reasoning.push(`Different layers: ${[...allLayers].join(', ')}`);
  }

  // Check complexity balance
  const complexities = batch.map(p => p.complexity);
  const uniqueComplexities = new Set(complexities);
  if (uniqueComplexities.size === 1) {
    reasoning.push(`Similar complexity (all ${complexities[0]})`);
  }

  // Check priority mix
  const priorities = batch.map(p => p.issue.priority);
  const minPriority = Math.min(...priorities);
  const maxPriority = Math.max(...priorities);
  if (maxPriority - minPriority <= 1) {
    reasoning.push(`Aligned priorities (P${minPriority}-P${maxPriority})`);
  } else if (maxPriority - minPriority >= 3) {
    warnings.push(`Wide priority spread (P${minPriority} to P${maxPriority})`);
  }

  return { reasoning, warnings };
}

function createBatch(
  predictions: IssuePrediction[],
  matrix: Map<string, Map<string, CompatibilityScore>>,
  id: string
): SwarmBatch {
  const score = calculateBatchScore(predictions, matrix);
  const { reasoning, warnings } = generateReasoning(predictions, matrix);

  const totalMinutes = predictions.reduce((sum, p) => sum + p.estimatedMinutes, 0);
  const maxMinutes = Math.max(...predictions.map(p => p.estimatedMinutes));

  let riskLevel: 'low' | 'medium' | 'high';
  if (score >= 0.7 && warnings.length === 0) riskLevel = 'low';
  else if (score >= 0.5 || warnings.length <= 1) riskLevel = 'medium';
  else riskLevel = 'high';

  return {
    id,
    issues: predictions.map(p => p.issue),
    predictions,
    score,
    estimatedTimeMinutes: totalMinutes,
    parallelTimeMinutes: maxMinutes,
    riskLevel,
    reasoning,
    warnings,
  };
}

// ============================================================================
// Main Suggest Function
// ============================================================================

export function suggestBatches(
  issues: LinearIssue[],
  knowledgeBase: KnowledgeBase,
  options: Partial<SuggestOptions> = {}
): SwarmBatch[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (issues.length === 0) {
    return [];
  }

  if (issues.length === 1) {
    const predictions = generatePredictions(issues, knowledgeBase);
    return [createBatch(predictions, new Map(), 'batch-1')];
  }

  // Generate predictions for all issues
  const predictions = generatePredictions(issues, knowledgeBase);

  // Build compatibility matrix
  const matrix = buildCompatibilityMatrix(predictions, knowledgeBase);

  // Generate candidate batches
  const batches: SwarmBatch[] = [];
  const usedInBatches = new Set<string>();

  for (let i = 0; i < opts.numBatches; i++) {
    // Greedy selection, excluding already-used issues for variety
    const batchPredictions = greedyBatchSelection(
      predictions,
      matrix,
      opts.maxBatchSize,
      opts.minCompatibility,
      i === 0 ? new Set() : usedInBatches, // First batch uses all, subsequent exclude used
      opts.currentUserId
    );

    if (batchPredictions.length >= 2) {
      const batch = createBatch(batchPredictions, matrix, `batch-${i + 1}`);
      batches.push(batch);

      // Track used issues for next iteration
      batchPredictions.forEach(p => usedInBatches.add(p.issue.identifier));
    }
  }

  // Sort by score
  return batches.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Output Formatting
// ============================================================================

export function formatBatchOutput(batches: SwarmBatch[], currentUserId?: string | null): string {
  if (batches.length === 0) {
    return 'No compatible batches found. Issues may have too much overlap.';
  }

  const lines: string[] = [];

  lines.push('');
  lines.push('┌' + '─'.repeat(70) + '┐');
  lines.push('│  🐝 SWARM SUGGEST' + ' '.repeat(52) + '│');
  lines.push('│  Analyzed issues and generated optimal batches' + ' '.repeat(23) + '│');
  lines.push('└' + '─'.repeat(70) + '┘');
  lines.push('');

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const isRecommended = i === 0;
    const scorePercent = Math.round(batch.score * 100);

    const riskEmoji = batch.riskLevel === 'low' ? '🟢' : batch.riskLevel === 'medium' ? '🟡' : '🔴';
    const header = isRecommended
      ? `📊 BATCH ${i + 1} (Recommended) - Score: ${scorePercent}%`
      : `📊 BATCH ${i + 1} - Score: ${scorePercent}%`;

    lines.push('┌' + '─'.repeat(70) + '┐');
    lines.push('│ ' + header + ' '.repeat(Math.max(0, 69 - header.length)) + '│');
    lines.push('├' + '─'.repeat(70) + '┤');

    const issueIds = batch.issues.map(i => i.identifier).join(', ');
    lines.push('│ Issues: ' + issueIds + ' '.repeat(Math.max(0, 61 - issueIds.length)) + '│');

    const timeStr = `Est: ${batch.estimatedTimeMinutes}min total → ${batch.parallelTimeMinutes}min parallel`;
    lines.push('│ ' + timeStr + ' '.repeat(Math.max(0, 69 - timeStr.length)) + '│');

    const riskStr = `Risk: ${riskEmoji} ${batch.riskLevel.toUpperCase()}`;
    lines.push('│ ' + riskStr + ' '.repeat(Math.max(0, 69 - riskStr.length - 1)) + '│');

    lines.push('├' + '─'.repeat(70) + '┤');

    // Reasoning
    if (batch.reasoning.length > 0) {
      lines.push('│ Why this works:' + ' '.repeat(54) + '│');
      for (const reason of batch.reasoning) {
        const reasonLine = '   ✓ ' + reason;
        lines.push('│' + reasonLine + ' '.repeat(Math.max(0, 70 - reasonLine.length)) + '│');
      }
    }

    // Warnings
    if (batch.warnings.length > 0) {
      for (const warning of batch.warnings) {
        const warningLine = '   ⚠ ' + warning;
        lines.push('│' + warningLine + ' '.repeat(Math.max(0, 70 - warningLine.length)) + '│');
      }
    }

    lines.push('├' + '─'.repeat(70) + '┤');

    // Issue details
    for (const pred of batch.predictions) {
      const priorityLabel = `P${pred.issue.priority}`;
      const assigneeLabel = getAssigneeLabel(pred.issue, currentUserId);

      const issueTitle = pred.issue.title.length > 30
        ? pred.issue.title.slice(0, 27) + '...'
        : pred.issue.title;

      const issueLine = ` ${pred.issue.identifier}: ${issueTitle}`;
      const metaLine = `${assigneeLabel} [${priorityLabel}]`;

      const padding = Math.max(0, 69 - issueLine.length - metaLine.length);
      lines.push('│' + issueLine + ' '.repeat(padding) + metaLine + '│');
    }

    lines.push('└' + '─'.repeat(70) + '┘');
    lines.push('');
  }

  // Commands
  lines.push('─'.repeat(72));
  lines.push('Commands:');
  for (let i = 0; i < batches.length; i++) {
    const issueIds = batches[i].issues.map(i => i.identifier).join(' ');
    lines.push(`  [${i + 1}] swarm start ${issueIds}`);
  }
  lines.push('─'.repeat(72));

  return lines.join('\n');
}

// ============================================================================
// Priority Label Helper
// ============================================================================

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0: return 'None';
    case 1: return 'Urgent';
    case 2: return 'High';
    case 3: return 'Medium';
    case 4: return 'Low';
    default: return `P${priority}`;
  }
}

// ============================================================================
// Issue Prediction (for CLI)
// ============================================================================

export interface IssuePredictionResult {
  confidence: 'cold_start' | 'low' | 'medium' | 'high';
  complexity: 'low' | 'medium' | 'high';
  timeMinutes: number;
  conflictRisk: number;
  predictedFiles: string[];
  warnings: string[];
}

export function predictIssue(issue: LinearIssue, knowledgeBase?: KnowledgeBase): IssuePredictionResult {
  const kb = knowledgeBase || new KnowledgeBase();
  const text = `${issue.title} ${issue.description || ''}`;
  const keywords = kb.extractKeywords(text);

  // Get similar patterns from KB
  const similarPatterns = kb.findSimilarPatterns(issue.title, issue.description || '');

  // Determine confidence
  let confidence: 'cold_start' | 'low' | 'medium' | 'high';
  if (similarPatterns.length >= 5) confidence = 'high';
  else if (similarPatterns.length >= 2) confidence = 'medium';
  else if (similarPatterns.length >= 1) confidence = 'low';
  else confidence = 'cold_start';

  // Predict files
  const predictedFiles = predictFiles(issue, kb);

  // Estimate complexity
  const { level: complexity, minutes: timeMinutes } = estimateComplexity(issue);

  // Calculate conflict risk
  let conflictRisk = 0;
  if (predictedFiles.length > 1) {
    let totalRisk = 0;
    let pairCount = 0;
    for (let i = 0; i < predictedFiles.length; i++) {
      for (let j = i + 1; j < predictedFiles.length; j++) {
        totalRisk += kb.getConflictRisk(predictedFiles[i], predictedFiles[j]);
        pairCount++;
      }
    }
    conflictRisk = pairCount > 0 ? totalRisk / pairCount : 0;
  }

  // Generate warnings
  const warnings: string[] = [];
  if (confidence === 'cold_start') {
    warnings.push('No historical patterns found - predictions may be inaccurate');
  }
  if (conflictRisk > 0.3) {
    warnings.push(`High conflict risk detected (${(conflictRisk * 100).toFixed(0)}%)`);
  }
  if (complexity === 'high') {
    warnings.push('High complexity issue - consider breaking into smaller tasks');
  }

  return {
    confidence,
    complexity,
    timeMinutes,
    conflictRisk,
    predictedFiles,
    warnings,
  };
}
