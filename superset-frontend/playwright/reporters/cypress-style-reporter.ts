/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
  TestError,
} from '@playwright/test/reporter';

interface CompletedTest {
  title: string;
  titlePath: string[];
  duration: number;
  outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  errors: TestError[];
}

interface FileResult {
  relativePath: string;
  projectName: string;
  fileIndex: number;
  totalExpected: number;
  results: Map<string, CompletedTest>;
  pendingResults: Map<string, CompletedTest>;
  retryDurations: Map<string, number>;
  bufferedOutput: string[];
  duration: number;
  started: boolean;
}

interface Colors {
  green: string;
  red: string;
  yellow: string;
  cyan: string;
  dim: string;
  reset: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default class CypressStyleReporter implements Reporter {
  private fileResults = new Map<string, FileResult>();
  private fileOrder: string[] = [];
  private totalFiles = 0;
  private multiProject = false;
  private flushedFiles = new Set<string>();
  private colors: Colors;
  private useColor: boolean;
  private boxWidth: number;

  constructor() {
    const useColor = !process.env.NO_COLOR && !!process.stdout.isTTY;
    this.useColor = useColor;
    this.colors = {
      green: useColor ? '\x1B[32m' : '',
      red: useColor ? '\x1B[31m' : '',
      yellow: useColor ? '\x1B[33m' : '',
      cyan: useColor ? '\x1B[36m' : '',
      dim: useColor ? '\x1B[2m' : '',
      reset: useColor ? '\x1B[0m' : '',
    };
    this.boxWidth = Math.min(process.stdout.columns || 90, 90);
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    const allTests = suite.allTests();
    const filesByPath = new Map<string, Set<string>>();

    for (const test of allTests) {
      const tp = test.titlePath();
      const projectName = tp[1] || '';
      const relativePath = tp[2] || '';
      const fileKey = `${projectName}::${relativePath}`;

      // Track which projects each file path appears in
      if (!filesByPath.has(relativePath)) {
        filesByPath.set(relativePath, new Set());
      }
      filesByPath.get(relativePath)!.add(projectName);

      if (!this.fileResults.has(fileKey)) {
        this.fileResults.set(fileKey, {
          relativePath,
          projectName,
          fileIndex: this.fileOrder.length,
          totalExpected: 0,
          results: new Map(),
          pendingResults: new Map(),
          retryDurations: new Map(),
          bufferedOutput: [],
          duration: 0,
          started: false,
        });
        this.fileOrder.push(fileKey);
      }
      this.fileResults.get(fileKey)!.totalExpected += 1;
    }

    this.totalFiles = this.fileOrder.length;
    // Only show project labels when the same file runs in multiple projects
    this.multiProject = [...filesByPath.values()].some(
      projects => projects.size > 1,
    );
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const tp = test.titlePath();
    const fileKey = `${tp[1] || ''}::${tp[2] || ''}`;
    const fileResult = this.fileResults.get(fileKey);
    if (!fileResult) return;
    fileResult.started = true;

    // Accumulate duration across all attempts for accurate per-spec timing
    const prevDuration = fileResult.retryDurations.get(test.id) || 0;
    fileResult.retryDurations.set(test.id, prevDuration + result.duration);

    const isTerminal =
      result.status === 'passed' ||
      result.status === 'skipped' ||
      result.status === 'interrupted' ||
      result.status === 'timedOut' ||
      result.retry === test.retries ||
      // Expected failure (test.fail()) — Playwright won't retry
      (test.expectedStatus === 'failed' && result.status === 'failed');
    const completedTest: CompletedTest = {
      title: test.title,
      titlePath: tp,
      duration: fileResult.retryDurations.get(test.id)!,
      outcome: test.outcome(),
      errors: result.errors,
    };

    if (!isTerminal) {
      fileResult.pendingResults.set(test.id, completedTest);
      return;
    }

    fileResult.results.set(test.id, completedTest);
    fileResult.pendingResults.delete(test.id);

    if (fileResult.results.size === fileResult.totalExpected) {
      this.flushFileBlock(fileKey, false);
    }
  }

  onStdOut(
    chunk: string | Buffer,
    test?: TestCase,
    _result?: TestResult,
  ): void {
    if (test) {
      const tp = test.titlePath();
      const fileKey = `${tp[1] || ''}::${tp[2] || ''}`;
      const fileResult = this.fileResults.get(fileKey);
      if (fileResult && !this.flushedFiles.has(fileKey)) {
        fileResult.bufferedOutput.push(chunk.toString());
        fileResult.started = true;
        return;
      }
    }
    process.stdout.write(chunk);
  }

  onStdErr(
    chunk: string | Buffer,
    test?: TestCase,
    _result?: TestResult,
  ): void {
    if (test) {
      const tp = test.titlePath();
      const fileKey = `${tp[1] || ''}::${tp[2] || ''}`;
      const fileResult = this.fileResults.get(fileKey);
      if (fileResult && !this.flushedFiles.has(fileKey)) {
        fileResult.bufferedOutput.push(chunk.toString());
        fileResult.started = true;
        return;
      }
    }
    process.stderr.write(chunk);
  }

  onError(error: TestError): void {
    const c = this.colors;
    const rawMsg = error.message
      ? error.message.split('\n')[0]
      : 'Unknown error';
    const msg = this.useColor ? rawMsg : this.stripAnsi(rawMsg);
    process.stderr.write(`\n${c.red}  Global error: ${msg}${c.reset}\n`);
    if (error.stack) {
      const stack = this.useColor ? error.stack : this.stripAnsi(error.stack);
      const trimmed = stack.split('\n').slice(0, 4).join('\n');
      process.stderr.write(`${c.dim}${trimmed}${c.reset}\n`);
    }
  }

  onEnd(result: FullResult): void {
    // Promote pending (non-terminal) retry results so interrupted runs
    // preserve the last observed failure instead of losing it entirely
    for (const fileKey of this.fileOrder) {
      const file = this.fileResults.get(fileKey);
      if (!file) continue;
      for (const [testId, pending] of file.pendingResults) {
        if (!file.results.has(testId)) {
          file.results.set(testId, pending);
        }
      }
    }

    const runFailed = result.status !== 'passed';
    for (const fileKey of this.fileOrder) {
      if (!this.flushedFiles.has(fileKey)) {
        const file = this.fileResults.get(fileKey);
        if (!file) continue;
        // Show files with partial results, or 0-result files when the run
        // was interrupted/failed (worker crash, SIGINT, timeout).
        // Skip 0-result files on successful runs (e.g., --list mode).
        if (file.results.size > 0 || (runFailed && file.started)) {
          this.flushFileBlock(fileKey, true);
        }
      }
    }
    this.printFinalSummary(result.status);
  }

  printsToStdio(): boolean {
    return true;
  }

  // --- Private helpers ---

  private flushFileBlock(fileKey: string, interrupted: boolean): void {
    this.flushedFiles.add(fileKey);
    const file = this.fileResults.get(fileKey);
    if (!file) return;

    const c = this.colors;
    const lines: string[] = [];

    // Header
    const displayPath = this.multiProject
      ? `[${file.projectName}] ${file.relativePath}`
      : file.relativePath;
    const counter = `(${file.fileIndex + 1} of ${this.totalFiles})`;
    const gap = Math.max(
      2,
      this.boxWidth - 12 - displayPath.length - counter.length,
    );
    lines.push('');
    lines.push(
      `${c.cyan}  Running:  ${displayPath}${' '.repeat(gap)}${counter}${c.reset}`,
    );
    lines.push('');

    // Sort results by titlePath for deterministic ordering
    const sorted = [...file.results.values()].sort((a, b) =>
      a.titlePath.join('\0').localeCompare(b.titlePath.join('\0')),
    );

    // Render test results with describe nesting
    let currentDescribes: string[] = [];
    for (const t of sorted) {
      const describes = t.titlePath.slice(3, -1);

      // Print new describe headers when context changes
      for (let i = 0; i < describes.length; i += 1) {
        if (currentDescribes[i] !== describes[i]) {
          const indent = `    ${'  '.repeat(i)}`;
          lines.push(`${indent}${describes[i]}`);
          currentDescribes = describes.slice(0, i + 1);
        }
      }
      if (describes.length < currentDescribes.length) {
        currentDescribes = describes.slice();
      }

      const indent = `    ${'  '.repeat(describes.length)}`;
      const dur = formatDuration(t.duration);

      if (t.outcome === 'expected') {
        lines.push(
          `${indent}${c.green}✓${c.reset} ${t.title} ${c.dim}(${dur})${c.reset}`,
        );
      } else if (t.outcome === 'unexpected') {
        lines.push(
          `${indent}${c.red}✗${c.reset} ${t.title} ${c.dim}(${dur})${c.reset}`,
        );
        for (const err of t.errors) {
          lines.push('');
          if (err.message) {
            const msg = this.useColor
              ? err.message
              : this.stripAnsi(err.message);
            for (const msgLine of msg.split('\n')) {
              lines.push(`${indent}  ${c.red}${msgLine}${c.reset}`);
            }
          } else {
            lines.push(`${indent}  ${c.red}Unknown error${c.reset}`);
          }
          if (err.location) {
            lines.push(
              `${indent}    ${c.dim}at ${err.location.file}:${err.location.line}${c.reset}`,
            );
          }
          if (err.stack) {
            const rawStack = this.useColor
              ? err.stack
              : this.stripAnsi(err.stack);
            const stackLines = rawStack
              .split('\n')
              .filter(l => l.trimStart().startsWith('at '))
              .slice(0, 5);
            for (const sl of stackLines) {
              lines.push(`${indent}    ${c.dim}${sl.trim()}${c.reset}`);
            }
          }
        }
      } else if (t.outcome === 'flaky') {
        lines.push(
          `${indent}${c.yellow}✓${c.reset} ${t.title} ${c.yellow}(flaky)${c.reset} ${c.dim}(${dur})${c.reset}`,
        );
      } else if (t.outcome === 'skipped') {
        lines.push(
          `${indent}${c.cyan}-${c.reset} ${t.title} ${c.dim}(skipped)${c.reset}`,
        );
      }
    }

    // Buffered stdout/stderr from tests
    if (file.bufferedOutput.length > 0) {
      lines.push('');
      for (const chunk of file.bufferedOutput) {
        lines.push(`    ${chunk.trimEnd()}`);
      }
    }

    lines.push('');

    // Compute counts
    let passing = 0;
    let failing = 0;
    let skipped = 0;
    let totalDuration = 0;
    for (const r of file.results.values()) {
      totalDuration += r.duration;
      if (r.outcome === 'expected' || r.outcome === 'flaky') passing += 1;
      else if (r.outcome === 'unexpected') failing += 1;
      else if (r.outcome === 'skipped') skipped += 1;
    }
    file.duration = totalDuration;

    // Summary box
    const testsLabel = interrupted
      ? `${file.results.size} of ${file.totalExpected} (interrupted)`
      : `${file.results.size}`;

    const boxRows: string[] = [
      `Tests:        ${testsLabel}`,
      `Passing:      ${passing}`,
      `Failing:      ${failing}`,
    ];
    if (skipped > 0) {
      boxRows.push(`Skipped:      ${skipped}`);
    }
    boxRows.push(`Duration:     ${formatDuration(totalDuration)}`);
    boxRows.push(`Spec Ran:     ${file.relativePath}`);

    lines.push(this.boxTop());
    for (const row of boxRows) {
      lines.push(this.boxLine(row));
    }
    lines.push(this.boxBottom());

    process.stdout.write(`${lines.join('\n')}\n`);
  }

  private printFinalSummary(runStatus: string): void {
    // No tests ran and run succeeded (e.g., --list mode) — nothing to summarize
    if (this.flushedFiles.size === 0 && runStatus === 'passed') return;

    const c = this.colors;
    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(this.boxWidth));
    lines.push('');
    lines.push('  (Run Finished)');
    lines.push('');

    // Table header
    const specColWidth = Math.max(this.boxWidth - 40, 10);
    if (this.multiProject) {
      lines.push(
        `       ${'Spec'.padEnd(specColWidth - 14)}${'Project'.padEnd(14)}Tests  Passing  Failing  Duration`,
      );
    } else {
      lines.push(
        `       ${'Spec'.padEnd(specColWidth)}Tests  Passing  Failing  Duration`,
      );
    }

    lines.push(this.boxTop());

    let totalSpecs = 0;
    let failedSpecs = 0;
    let totalSkipped = 0;

    for (const fileKey of this.fileOrder) {
      const file = this.fileResults.get(fileKey)!;
      // Skip files that were never flushed (e.g., --list mode)
      if (!this.flushedFiles.has(fileKey)) continue;
      let passing = 0;
      let failing = 0;
      let skippedCount = 0;
      const wasInterrupted = file.results.size < file.totalExpected;

      for (const r of file.results.values()) {
        if (r.outcome === 'expected' || r.outcome === 'flaky') passing += 1;
        else if (r.outcome === 'unexpected') failing += 1;
        else if (r.outcome === 'skipped') skippedCount += 1;
      }

      const tests = file.results.size;
      totalSpecs += 1;
      if (failing > 0) failedSpecs += 1;
      totalSkipped += skippedCount;

      const marker = wasInterrupted
        ? `${c.yellow}!${c.reset}`
        : failing > 0
          ? `${c.red}✗${c.reset}`
          : `${c.green}✓${c.reset}`;
      const dur = formatDuration(file.duration);

      let row: string;
      if (this.multiProject) {
        row =
          ` ${marker} ${file.relativePath.padEnd(specColWidth - 14)}` +
          `${file.projectName.padEnd(14)}` +
          `${String(tests).padStart(5)}  ` +
          `${String(passing).padStart(7)}  ` +
          `${String(failing).padStart(7)}  ` +
          `${dur.padStart(8)}`;
      } else {
        row =
          ` ${marker} ${file.relativePath.padEnd(specColWidth)}` +
          `${String(tests).padStart(5)}  ` +
          `${String(passing).padStart(7)}  ` +
          `${String(failing).padStart(7)}  ` +
          `${dur.padStart(8)}`;
      }

      lines.push(this.boxLine(row));
    }

    lines.push(this.boxBottom());
    lines.push('');

    const skippedSuffix = totalSkipped > 0 ? ` (${totalSkipped} skipped)` : '';
    if (failedSpecs > 0) {
      lines.push(
        `    ${c.red}✗ ${failedSpecs} of ${totalSpecs} failed${c.reset}${skippedSuffix}`,
      );
    } else if (runStatus === 'interrupted') {
      lines.push(
        `    ${c.yellow}! Run was interrupted${c.reset}${skippedSuffix}`,
      );
    } else if (runStatus === 'timedout') {
      lines.push(`    ${c.red}✗ Run timed out${c.reset}${skippedSuffix}`);
    } else if (runStatus !== 'passed') {
      lines.push(`    ${c.red}✗ Run failed${c.reset}${skippedSuffix}`);
    } else {
      lines.push(
        `    ${c.green}✓ All ${totalSpecs} passed${c.reset}${skippedSuffix}`,
      );
    }
    lines.push('');

    process.stdout.write(`${lines.join('\n')}\n`);
  }

  private boxTop(): string {
    return `  ┌${'─'.repeat(this.boxWidth - 4)}┐`;
  }

  private boxBottom(): string {
    return `  └${'─'.repeat(this.boxWidth - 4)}┘`;
  }

  private stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*m/g, '');
  }

  private boxLine(content: string): string {
    const inner = this.boxWidth - 6;
    const visibleLen = this.stripAnsi(content).length;
    if (visibleLen >= inner) {
      return `  │ ${content} │`;
    }
    return `  │ ${content}${' '.repeat(inner - visibleLen)} │`;
  }
}
