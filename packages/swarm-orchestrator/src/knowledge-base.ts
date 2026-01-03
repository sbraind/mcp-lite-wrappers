/**
 * Swarm Knowledge Base
 * JSONL-based storage with inverted index for pattern retrieval
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  IssuePattern,
  FileAssociation,
  ConflictPair,
  LearningMetrics,
  InvertedIndex,
  DEFAULT_HEURISTICS,
} from './types.js';

const KB_DIR = path.join(process.cwd(), '.claude/swarm/kb');
const PATTERNS_FILE = path.join(KB_DIR, 'patterns.jsonl');
const ASSOCIATIONS_FILE = path.join(KB_DIR, 'file-associations.jsonl');
const CONFLICTS_FILE = path.join(KB_DIR, 'conflict-pairs.jsonl');
const METRICS_FILE = path.join(KB_DIR, 'metrics.json');
const INDEX_FILE = path.join(KB_DIR, 'index.json');

// ============================================================================
// Core JSONL Operations
// ============================================================================

function readJSONL<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function appendJSONL<T>(filePath: string, item: T): void {
  const line = JSON.stringify(item) + '\n';
  fs.appendFileSync(filePath, line);
}

function writeJSONL<T>(filePath: string, items: T[]): void {
  const content = items.map((item) => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(filePath, content);
}

function readJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

function writeJSON<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ============================================================================
// Knowledge Base Class
// ============================================================================

export class KnowledgeBase {
  private index: InvertedIndex | null = null;

  constructor() {
    this.ensureDirectories();
    this.loadIndex();
  }

  public ensureDirectories(): void {
    if (!fs.existsSync(KB_DIR)) {
      fs.mkdirSync(KB_DIR, { recursive: true });
    }
  }

  // --------------------------------------------------------------------------
  // Index Management
  // --------------------------------------------------------------------------

  private loadIndex(): void {
    this.index = readJSON<InvertedIndex>(INDEX_FILE);
    if (!this.index) {
      this.index = { keywords: {}, files: {}, lastUpdated: new Date().toISOString() };
    }
  }

  private saveIndex(): void {
    if (this.index) {
      this.index.lastUpdated = new Date().toISOString();
      writeJSON(INDEX_FILE, this.index);
    }
  }

  public rebuildIndex(): void {
    const patterns = this.getAllPatterns();
    this.index = { keywords: {}, files: {}, lastUpdated: new Date().toISOString() };

    for (const pattern of patterns) {
      // Index by keywords
      for (const keyword of pattern.input.keywords) {
        if (!this.index.keywords[keyword]) {
          this.index.keywords[keyword] = [];
        }
        if (!this.index.keywords[keyword].includes(pattern.id)) {
          this.index.keywords[keyword].push(pattern.id);
        }
      }

      // Index by actual files
      for (const file of pattern.outcomes.filesActual) {
        if (!this.index.files[file]) {
          this.index.files[file] = [];
        }
        if (!this.index.files[file].includes(pattern.id)) {
          this.index.files[file].push(pattern.id);
        }
      }
    }

    this.saveIndex();
    console.log(`Index rebuilt: ${Object.keys(this.index.keywords).length} keywords, ${Object.keys(this.index.files).length} files`);
  }

  // --------------------------------------------------------------------------
  // Pattern Operations
  // --------------------------------------------------------------------------

  public getAllPatterns(): IssuePattern[] {
    return readJSONL<IssuePattern>(PATTERNS_FILE);
  }

  public getPattern(id: string): IssuePattern | null {
    const patterns = this.getAllPatterns();
    return patterns.find((p) => p.id === id) || null;
  }

  public addPattern(pattern: IssuePattern): void {
    appendJSONL(PATTERNS_FILE, pattern);

    // Update index
    if (this.index) {
      for (const keyword of pattern.input.keywords) {
        if (!this.index.keywords[keyword]) {
          this.index.keywords[keyword] = [];
        }
        this.index.keywords[keyword].push(pattern.id);
      }
      this.saveIndex();
    }
  }

  public updatePattern(pattern: IssuePattern): void {
    const patterns = this.getAllPatterns();
    const idx = patterns.findIndex((p) => p.id === pattern.id);
    if (idx >= 0) {
      patterns[idx] = pattern;
      writeJSONL(PATTERNS_FILE, patterns);
    }
  }

  // --------------------------------------------------------------------------
  // Search & Retrieval
  // --------------------------------------------------------------------------

  public searchByKeywords(keywords: string[], k: number = 5): IssuePattern[] {
    if (!this.index) {
      this.loadIndex();
    }

    // Count pattern occurrences across keywords
    const patternScores: Map<string, number> = new Map();

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      const patternIds = this.index?.keywords[normalizedKeyword] || [];
      for (const id of patternIds) {
        patternScores.set(id, (patternScores.get(id) || 0) + 1);
      }
    }

    // Sort by score and get top-k
    const sortedIds = [...patternScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([id]) => id);

    // Load full patterns
    const allPatterns = this.getAllPatterns();
    const patternMap = new Map(allPatterns.map((p) => [p.id, p]));

    return sortedIds.map((id) => patternMap.get(id)!).filter(Boolean);
  }

  public findSimilarPatterns(
    title: string,
    description: string,
    k: number = 5
  ): IssuePattern[] {
    const keywords = this.extractKeywords(title + ' ' + description);
    return this.searchByKeywords(keywords, k);
  }

  // --------------------------------------------------------------------------
  // File Associations
  // --------------------------------------------------------------------------

  public getFileAssociations(): FileAssociation[] {
    return readJSONL<FileAssociation>(ASSOCIATIONS_FILE);
  }

  public updateFileAssociation(keyword: string, file: string): void {
    const associations = this.getFileAssociations();
    let assoc = associations.find((a) => a.keyword === keyword);

    if (!assoc) {
      assoc = { keyword, files: [] };
      associations.push(assoc);
    }

    const fileEntry = assoc.files.find((f) => f.path === file);
    if (fileEntry) {
      fileEntry.frequency += 1;
      fileEntry.lastSeen = new Date().toISOString();
    } else {
      assoc.files.push({
        path: file,
        frequency: 1,
        lastSeen: new Date().toISOString(),
      });
    }

    writeJSONL(ASSOCIATIONS_FILE, associations);
  }

  public predictFilesFromKeywords(keywords: string[]): string[] {
    const associations = this.getFileAssociations();
    const fileScores: Map<string, number> = new Map();
    const now = Date.now();

    for (const keyword of keywords) {
      const assoc = associations.find((a) => a.keyword.toLowerCase() === keyword.toLowerCase());
      if (assoc) {
        for (const fileEntry of assoc.files) {
          // Apply recency weighting (decay over 90 days)
          const daysSince = (now - new Date(fileEntry.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
          const recencyWeight = Math.exp(-daysSince / 90);
          const score = fileEntry.frequency * recencyWeight;
          fileScores.set(fileEntry.path, (fileScores.get(fileEntry.path) || 0) + score);
        }
      }
    }

    return [...fileScores.entries()]
      .filter(([, score]) => score > 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path);
  }

  // --------------------------------------------------------------------------
  // Conflict Pairs
  // --------------------------------------------------------------------------

  public getConflictPairs(): ConflictPair[] {
    return readJSONL<ConflictPair>(CONFLICTS_FILE);
  }

  public recordConflict(fileA: string, fileB: string): void {
    const pairs = this.getConflictPairs();
    const key1 = [fileA, fileB].sort().join('::');

    let pair = pairs.find(
      (p) => [p.fileA, p.fileB].sort().join('::') === key1
    );

    if (!pair) {
      pair = { fileA, fileB, conflictCount: 0, coModificationCount: 0, conflictRate: 0 };
      pairs.push(pair);
    }

    pair.conflictCount += 1;
    pair.conflictRate = pair.conflictCount / (pair.coModificationCount || 1);

    writeJSONL(CONFLICTS_FILE, pairs);
  }

  public recordCoModification(files: string[]): void {
    const pairs = this.getConflictPairs();

    // Record all pairs of files
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join('::');
        let pair = pairs.find(
          (p) => [p.fileA, p.fileB].sort().join('::') === key
        );

        if (!pair) {
          pair = { fileA: files[i], fileB: files[j], conflictCount: 0, coModificationCount: 0, conflictRate: 0 };
          pairs.push(pair);
        }

        pair.coModificationCount += 1;
        pair.conflictRate = pair.conflictCount / pair.coModificationCount;
      }
    }

    writeJSONL(CONFLICTS_FILE, pairs);
  }

  public getConflictRisk(fileA: string, fileB: string): number {
    const pairs = this.getConflictPairs();
    const key = [fileA, fileB].sort().join('::');
    const pair = pairs.find(
      (p) => [p.fileA, p.fileB].sort().join('::') === key
    );
    return pair?.conflictRate || 0;
  }

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  public getMetrics(): LearningMetrics {
    return (
      readJSON<LearningMetrics>(METRICS_FILE) || {
        totalPatterns: 0,
        totalSwarmRuns: 0,
        accuracy: [],
        coldStartAccuracy: { filePrecision: 0, fileRecall: 0 },
        learnedAccuracy: { filePrecision: 0, fileRecall: 0 },
        improvementRate: 0,
        lastUpdated: null,
      }
    );
  }

  public updateMetrics(): void {
    const patterns = this.getAllPatterns();
    const coldStartPatterns = patterns.filter(
      (p) => p.predictions.confidence === 'cold_start'
    );
    const learnedPatterns = patterns.filter(
      (p) => p.predictions.confidence !== 'cold_start'
    );

    const calcAverage = (arr: IssuePattern[], field: keyof IssuePattern['scores']) => {
      if (arr.length === 0) return 0;
      return arr.reduce((sum, p) => sum + (p.scores[field] as number), 0) / arr.length;
    };

    const metrics: LearningMetrics = {
      totalPatterns: patterns.length,
      totalSwarmRuns: Math.ceil(patterns.length / 3), // Estimate
      accuracy: [], // Could compute rolling window here
      coldStartAccuracy: {
        filePrecision: calcAverage(coldStartPatterns, 'filePrecision'),
        fileRecall: calcAverage(coldStartPatterns, 'fileRecall'),
      },
      learnedAccuracy: {
        filePrecision: calcAverage(learnedPatterns, 'filePrecision'),
        fileRecall: calcAverage(learnedPatterns, 'fileRecall'),
      },
      improvementRate:
        learnedPatterns.length > 0 && coldStartPatterns.length > 0
          ? (calcAverage(learnedPatterns, 'filePrecision') -
              calcAverage(coldStartPatterns, 'filePrecision')) /
            calcAverage(coldStartPatterns, 'filePrecision')
          : 0,
      lastUpdated: new Date().toISOString(),
    };

    writeJSON(METRICS_FILE, metrics);
  }

  // --------------------------------------------------------------------------
  // Keyword Extraction
  // --------------------------------------------------------------------------

  public extractKeywords(text: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'this', 'that', 'these', 'those', 'it', 'its', 'i', 'we', 'you', 'he',
      'she', 'they', 'them', 'their', 'our', 'your', 'my', 'me', 'him', 'her',
      'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose',
      'if', 'then', 'else', 'so', 'because', 'although', 'while', 'since',
      'until', 'unless', 'not', 'no', 'yes', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
    ]);

    // Extract words, filter, and normalize
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Also extract camelCase/PascalCase parts
    const camelParts = text
      .match(/[A-Z][a-z]+/g)
      ?.map((w) => w.toLowerCase()) || [];

    // Combine and deduplicate
    return [...new Set([...words, ...camelParts])];
  }

  // --------------------------------------------------------------------------
  // Cold Start Predictions
  // --------------------------------------------------------------------------

  public coldStartPrediction(
    title: string,
    description: string
  ): { files: string[]; complexity: 'low' | 'medium' | 'high'; timeMinutes: number } {
    const keywords = this.extractKeywords(title + ' ' + description);
    const predictedFiles: string[] = [];

    // Match keywords to file globs
    for (const keyword of keywords) {
      const globs = DEFAULT_HEURISTICS.keywordToGlob[keyword.toLowerCase()];
      if (globs) {
        // For now, just return the glob patterns
        // In real implementation, we'd use glob to find actual files
        predictedFiles.push(...globs);
      }
    }

    // Determine complexity from signals
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    const lowerTitle = title.toLowerCase();

    for (const [level, signals] of Object.entries(DEFAULT_HEURISTICS.complexitySignals)) {
      if (signals.some((s) => lowerTitle.includes(s))) {
        complexity = level as 'low' | 'medium' | 'high';
        break;
      }
    }

    return {
      files: [...new Set(predictedFiles)],
      complexity,
      timeMinutes: DEFAULT_HEURISTICS.timeEstimates[complexity],
    };
  }

  // --------------------------------------------------------------------------
  // Pattern Statistics
  // --------------------------------------------------------------------------

  public getStats(): {
    totalPatterns: number;
    totalSwarmRuns: number;
    totalFileAssociations: number;
    totalConflictPairs: number;
    avgPrecision: number;
    avgRecall: number;
    topKeywords: { keyword: string; count: number }[];
    accuracy: {
      date: string;
      filePrecision: number;
      fileRecall: number;
      timeAccuracy: number;
      conflictPredictionAccuracy: number;
    }[];
    coldStartAccuracy: { filePrecision: number; fileRecall: number } | null;
    learnedAccuracy: { filePrecision: number; fileRecall: number } | null;
    improvementRate: number;
    lastUpdated: string | null;
  } {
    const patterns = this.getAllPatterns();
    const fileAssociations = this.getFileAssociations();
    const conflictPairs = this.getConflictPairs();
    const metrics = this.getMetrics();
    const keywordCounts: Map<string, number> = new Map();

    for (const pattern of patterns) {
      for (const keyword of pattern.input.keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }

    const topKeywords = [...keywordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    const avgPrecision =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.scores.filePrecision, 0) / patterns.length
        : 0;

    const avgRecall =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.scores.fileRecall, 0) / patterns.length
        : 0;

    return {
      totalPatterns: patterns.length,
      totalSwarmRuns: metrics.totalSwarmRuns,
      totalFileAssociations: fileAssociations.length,
      totalConflictPairs: conflictPairs.length,
      avgPrecision,
      avgRecall,
      topKeywords,
      accuracy: metrics.accuracy,
      coldStartAccuracy: metrics.coldStartAccuracy.filePrecision > 0 ? metrics.coldStartAccuracy : null,
      learnedAccuracy: metrics.learnedAccuracy.filePrecision > 0 ? metrics.learnedAccuracy : null,
      improvementRate: metrics.improvementRate,
      lastUpdated: metrics.lastUpdated,
    };
  }

  // --------------------------------------------------------------------------
  // Cold Start Bootstrap from Git History
  // --------------------------------------------------------------------------

  public coldStartFromGitHistory(options: {
    maxCommits: number;
    minFilesChanged: number;
    excludePatterns: string[];
  }): void {
    const { execSync } = require('child_process');

    console.log(`Analyzing last ${options.maxCommits} commits...`);

    try {
      // Get commit log with file changes
      const logOutput = execSync(
        `git log --oneline --name-only -n ${options.maxCommits}`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
      );

      const lines = logOutput.split('\n');
      let currentCommitMessage = '';
      let currentFiles: string[] = [];
      let patternsAdded = 0;

      for (const line of lines) {
        if (!line.trim()) {
          // Empty line separates commits
          if (currentCommitMessage && currentFiles.length >= options.minFilesChanged) {
            // Filter out excluded patterns
            const filteredFiles = currentFiles.filter(f =>
              !options.excludePatterns.some(pattern => {
                if (pattern.endsWith('/')) {
                  return f.startsWith(pattern);
                }
                if (pattern.startsWith('*')) {
                  return f.endsWith(pattern.slice(1));
                }
                return f === pattern;
              })
            );

            if (filteredFiles.length >= options.minFilesChanged) {
              // Extract keywords from commit message
              const keywords = this.extractKeywords(currentCommitMessage);

              // Update file associations
              for (const keyword of keywords) {
                for (const file of filteredFiles) {
                  this.updateFileAssociation(keyword, file);
                }
              }

              // Record co-modifications for conflict prediction
              this.recordCoModification(filteredFiles);

              patternsAdded++;
            }
          }
          currentCommitMessage = '';
          currentFiles = [];
        } else if (!currentCommitMessage) {
          // First non-empty line after separator is commit message
          // Format: "abc1234 Commit message here"
          currentCommitMessage = line.replace(/^[a-f0-9]+\s+/, '');
        } else {
          // Subsequent lines are file paths
          currentFiles.push(line.trim());
        }
      }

      console.log(`Processed ${patternsAdded} commits into knowledge base`);

      // Rebuild index
      this.rebuildIndex();

      // Update metrics
      this.updateMetrics();

    } catch (error) {
      console.error('Error bootstrapping from git history:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const kb = new KnowledgeBase();
