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

import CypressStyleReporter from '../../playwright/reporters/cypress-style-reporter';

/* eslint-disable @typescript-eslint/no-explicit-any */

function mockTest(opts: {
  id: string;
  title: string;
  project?: string;
  file?: string;
  describes?: string[];
  retries?: number;
  outcome?: string;
  expectedStatus?: string;
}): any {
  const project = opts.project ?? 'chromium';
  const file = opts.file ?? 'tests/example.spec.ts';
  const describes = opts.describes ?? [];
  const titlePath = ['', project, file, ...describes, opts.title];
  return {
    id: opts.id,
    title: opts.title,
    titlePath: () => titlePath,
    retries: opts.retries ?? 0,
    outcome: () => opts.outcome ?? 'expected',
    expectedStatus: opts.expectedStatus ?? 'passed',
  };
}

function mockResult(
  opts: {
    status?: string;
    duration?: number;
    retry?: number;
    errors?: any[];
  } = {},
): any {
  return {
    status: opts.status ?? 'passed',
    duration: opts.duration ?? 1000,
    retry: opts.retry ?? 0,
    errors: opts.errors ?? [],
  };
}

function mockSuite(tests: any[]): any {
  return { allTests: () => tests };
}

const mockConfig: any = {};
const mockFullResult: any = { status: 'passed' };

let stdoutChunks: string[];
let stderrChunks: string[];

function getStdout(): string {
  return stdoutChunks.join('');
}

function getStderr(): string {
  return stderrChunks.join('');
}

beforeEach(() => {
  stdoutChunks = [];
  stderrChunks = [];
  jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdoutChunks.push(chunk.toString());
    return true;
  });
  jest.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderrChunks.push(chunk.toString());
    return true;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NO_COLOR;
});

test('renders a single file block with header, results, and summary box', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'test one',
    file: 'auth/login.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'test two',
    file: 'auth/login.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));

  // File should not flush after first test (1 of 2)
  reporter.onTestEnd(t1, mockResult({ duration: 2000 }));
  expect(getStdout()).toBe('');

  // File should flush after second test (2 of 2)
  reporter.onTestEnd(t2, mockResult({ duration: 3000 }));
  const output = getStdout();
  expect(output).toContain('Running:  auth/login.spec.ts');
  expect(output).toContain('(1 of 1)');
  expect(output).toContain('✓ test one');
  expect(output).toContain('✓ test two');
  expect(output).toContain('Tests:        2');
  expect(output).toContain('Passing:      2');
  expect(output).toContain('Failing:      0');
  expect(output).toContain('┌');
  expect(output).toContain('└');
});

test('non-terminal retry results are not stored; terminal result flushes correctly', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'retry test',
    file: 'tests/retry.spec.ts',
    retries: 2,
    outcome: 'unexpected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // Attempt 0: fails, retry=0 !== retries=2 → not terminal
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'failed', retry: 0, errors: [{ message: 'fail' }] }),
  );
  expect(getStdout()).toBe('');

  // Attempt 1: fails, retry=1 !== retries=2 → not terminal
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'failed', retry: 1, errors: [{ message: 'fail' }] }),
  );
  expect(getStdout()).toBe('');

  // Attempt 2: fails, retry=2 === retries=2 → terminal
  reporter.onTestEnd(
    t1,
    mockResult({
      status: 'failed',
      retry: 2,
      duration: 500,
      errors: [{ message: 'final fail' }],
    }),
  );
  const output = getStdout();
  expect(output).toContain('✗ retry test');
  expect(output).toContain('Tests:        1');
  expect(output).toContain('Failing:      1');
});

test('flaky tests show (flaky) annotation when test fails then passes on retry', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'sometimes fails',
    file: 'tests/flaky.spec.ts',
    retries: 1,
    outcome: 'flaky',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // First attempt fails (retry=0 !== retries=1 → not terminal)
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'failed', retry: 0, errors: [{ message: 'oops' }] }),
  );
  expect(getStdout()).toBe('');

  // Retry passes (terminal: status === 'passed')
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'passed', retry: 1, duration: 800 }),
  );
  const output = getStdout();
  expect(output).toContain('✓ sometimes fails');
  expect(output).toContain('(flaky)');
  expect(output).toContain('Passing:      1');
});

test('skipped tests render with dash marker and summary count', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'passing test',
    file: 'tests/skip.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'skipped test',
    file: 'tests/skip.spec.ts',
    outcome: 'skipped',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));

  reporter.onTestEnd(t1, mockResult({ duration: 500 }));
  reporter.onTestEnd(t2, mockResult({ status: 'skipped', duration: 0 }));

  const output = getStdout();
  expect(output).toContain('✓ passing test');
  expect(output).toContain('- skipped test');
  expect(output).toContain('(skipped)');
  expect(output).toContain('Skipped:      1');
  expect(output).toContain('Passing:      1');
});

test('NO_COLOR mode produces no ANSI escape sequences', () => {
  const origIsTTY = process.stdout.isTTY;

  try {
    // With TTY and no NO_COLOR → colors present
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });
    delete process.env.NO_COLOR;

    const colorReporter = new CypressStyleReporter();
    const t1 = mockTest({
      id: '1',
      title: 'color test',
      file: 'tests/c.spec.ts',
    });
    colorReporter.onBegin(mockConfig, mockSuite([t1]));
    colorReporter.onTestEnd(t1, mockResult());
    expect(getStdout()).toContain('\x1B[');

    // Reset capture
    stdoutChunks = [];

    // With NO_COLOR=1 → no ANSI codes
    process.env.NO_COLOR = '1';
    const noColorReporter = new CypressStyleReporter();
    const t2 = mockTest({
      id: '1',
      title: 'no color test',
      file: 'tests/nc.spec.ts',
    });
    noColorReporter.onBegin(mockConfig, mockSuite([t2]));
    noColorReporter.onTestEnd(t2, mockResult());
    expect(getStdout()).not.toContain('\x1B[');
  } finally {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: origIsTTY,
      writable: true,
      configurable: true,
    });
  }
});

test('onError prints to stderr', () => {
  const reporter = new CypressStyleReporter();
  reporter.onError({
    message: 'Worker crashed',
    stack: 'Error: Worker crashed\n    at test.ts:10',
  } as any);

  const output = getStderr();
  expect(output).toContain('Global error: Worker crashed');
  expect(output).toContain('Worker crashed');
});

test('incomplete file buckets flush as interrupted in onEnd', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'completed test',
    file: 'tests/interrupted.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'never finished',
    file: 'tests/interrupted.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));

  // Only complete one of two tests
  reporter.onTestEnd(t1, mockResult({ duration: 1000 }));
  expect(getStdout()).toBe('');

  // Simulate run end (e.g., SIGINT)
  reporter.onEnd(mockFullResult);

  const output = getStdout();
  expect(output).toContain('Running:  tests/interrupted.spec.ts');
  expect(output).toContain('1 of 2 (interrupted)');
  expect(output).toContain('✓ completed test');
});

test('test-associated stdout is buffered; global stdout passes through immediately', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'logging test',
    file: 'tests/stdout.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // Global stdout (no test) passes through immediately
  reporter.onStdOut('global setup message\n');
  expect(getStdout()).toBe('global setup message\n');

  // Test-associated stdout is buffered
  stdoutChunks = [];
  reporter.onStdOut('test log line\n', t1);
  expect(getStdout()).toBe('');

  // Complete the test → flush includes buffered output
  reporter.onTestEnd(t1, mockResult());
  const output = getStdout();
  expect(output).toContain('✓ logging test');
  expect(output).toContain('test log line');
});

test('final summary table shows per-file rows and totals', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'passes',
    file: 'auth/login.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'fails',
    file: 'dashboard/list.spec.ts',
    outcome: 'unexpected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onTestEnd(
    t2,
    mockResult({ status: 'failed', errors: [{ message: 'boom' }] }),
  );

  // Trigger final summary
  reporter.onEnd(mockFullResult);

  const output = getStdout();
  expect(output).toContain('(Run Finished)');
  expect(output).toContain('auth/login.spec.ts');
  expect(output).toContain('dashboard/list.spec.ts');
  expect(output).toContain('✓');
  expect(output).toContain('✗');
  // Total line: 1 failure out of 2
  expect(output).toContain('1 of 2 failed');
});

test('disjoint projects do not show project labels', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'auth test',
    project: 'chromium-unauth',
    file: 'auth/login.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'dashboard test',
    project: 'chromium',
    file: 'dashboard/list.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onTestEnd(t2, mockResult());
  reporter.onEnd(mockFullResult);

  const output = getStdout();
  // Disjoint files across projects — no brackets, no Project column
  expect(output).not.toContain('[chromium');
  expect(output).not.toContain('Project');
  expect(output).toContain('auth/login.spec.ts');
  expect(output).toContain('dashboard/list.spec.ts');
});

test('overlapping projects show project labels in headers and summary', () => {
  const reporter = new CypressStyleReporter();
  // Same file in two projects (overlapping)
  const t1 = mockTest({
    id: '1',
    title: 'test in project A',
    project: 'chromium',
    file: 'shared/test.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'test in project B',
    project: 'firefox',
    file: 'shared/test.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onTestEnd(t2, mockResult());
  reporter.onEnd(mockFullResult);

  const output = getStdout();
  expect(output).toContain('[chromium] shared/test.spec.ts');
  expect(output).toContain('[firefox] shared/test.spec.ts');
  expect(output).toContain('Project');
});

test('failed tests render error message and location', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'fails with location',
    file: 'tests/error.spec.ts',
    outcome: 'unexpected',
  });
  const t2 = mockTest({
    id: '2',
    title: 'fails with stack only',
    file: 'tests/error.spec.ts',
    outcome: 'unexpected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));

  reporter.onTestEnd(
    t1,
    mockResult({
      status: 'failed',
      errors: [
        {
          message:
            'Expected true to be false\n\nExpected: false\nReceived: true',
          location: { file: 'error.spec.ts', line: 42, column: 5 },
        },
      ],
    }),
  );
  reporter.onTestEnd(
    t2,
    mockResult({
      status: 'failed',
      errors: [
        {
          message: 'Timeout exceeded',
          stack:
            'Error: Timeout exceeded\n    at Object.<anonymous> (error.spec.ts:55:3)',
        },
      ],
    }),
  );

  const output = getStdout();
  // Error with location — multiline message preserved
  expect(output).toContain('Expected true to be false');
  expect(output).toContain('Expected: false');
  expect(output).toContain('Received: true');
  expect(output).toContain('at error.spec.ts:42');
  // Error with stack fallback — full message and stack lines preserved
  expect(output).toContain('Timeout exceeded');
  expect(output).toContain('at Object.<anonymous>');
});

test('onStdErr for a test is buffered; global stderr passes through', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'stderr test',
    file: 'tests/stderr.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // Global stderr (no test) passes through immediately
  reporter.onStdErr('global warning\n');
  expect(getStderr()).toBe('global warning\n');

  // Test-associated stderr is buffered
  stderrChunks = [];
  reporter.onStdErr('test warning\n', t1);
  expect(getStderr()).toBe('');

  // Complete the test → flush includes buffered stderr in stdout output
  reporter.onTestEnd(t1, mockResult());
  const output = getStdout();
  expect(output).toContain('test warning');
});

test('describe nesting renders group headers with indentation', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'inner test',
    file: 'tests/nested.spec.ts',
    describes: ['Auth', 'Login Form'],
  });
  const t2 = mockTest({
    id: '2',
    title: 'top level test',
    file: 'tests/nested.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onTestEnd(t2, mockResult());

  const output = getStdout();
  expect(output).toContain('Auth');
  expect(output).toContain('Login Form');
  expect(output).toContain('✓ inner test');
  expect(output).toContain('✓ top level test');
});

test('skipped suffix appears in final summary when tests are skipped', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'runs',
    file: 'tests/skip-summary.spec.ts',
  });
  const t2 = mockTest({
    id: '2',
    title: 'is skipped',
    file: 'tests/skip-summary.spec.ts',
    outcome: 'skipped',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onTestEnd(t2, mockResult({ status: 'skipped', duration: 0 }));
  reporter.onEnd(mockFullResult);

  const output = getStdout();
  // Final summary accounts for skipped
  expect(output).toContain('All 1 passed');
  expect(output).toContain('(1 skipped)');
});

test('file that never started is not shown when run is interrupted', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'never started',
    file: 'tests/crashed.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));
  // No onTestEnd calls — file never started (e.g., maxFailures, SIGINT before this file)
  reporter.onEnd({ status: 'interrupted' } as any);

  const output = getStdout();
  // File never received any test results — do not emit a misleading block
  expect(output).not.toContain('Running:  tests/crashed.spec.ts');
  expect(output).not.toContain('0 of 1');
  // Final summary still shows the run was interrupted
  expect(output).toContain('interrupted');
});

test('--list mode: no file blocks or summary printed when no tests ran', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'listed test',
    file: 'auth/login.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));
  // No onTestEnd calls — --list mode only collects, never runs
  reporter.onEnd({ status: 'passed' } as any);

  const output = getStdout();
  expect(output).not.toContain('interrupted');
  expect(output).not.toContain('Running:');
  expect(output).not.toContain('(Run Finished)');
});

test('interrupted run footer shows interruption, not "All 0 passed"', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({ id: '1', title: 'completed', file: 'tests/a.spec.ts' });
  const t2 = mockTest({ id: '2', title: 'never ran', file: 'tests/a.spec.ts' });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onEnd({ status: 'interrupted' } as any);

  const output = getStdout();
  expect(output).not.toContain('All');
  expect(output).toContain('interrupted');
});

test('timed-out run footer shows timeout, not success', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({ id: '1', title: 'ran ok', file: 'tests/b.spec.ts' });

  reporter.onBegin(mockConfig, mockSuite([t1]));
  reporter.onTestEnd(t1, mockResult());
  reporter.onEnd({ status: 'timedout' } as any);

  const output = getStdout();
  expect(output).not.toContain('All');
  expect(output).toContain('timed out');
});

test('retry durations are accumulated across all attempts', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'flaky test',
    file: 'tests/duration.spec.ts',
    retries: 1,
    outcome: 'flaky',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // First attempt: fails after 10s (not terminal: retry 0 !== retries 1)
  reporter.onTestEnd(
    t1,
    mockResult({
      status: 'failed',
      retry: 0,
      duration: 10000,
      errors: [{ message: 'fail' }],
    }),
  );

  // Retry: passes after 1s (terminal: status === 'passed')
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'passed', retry: 1, duration: 1000 }),
  );

  const output = getStdout();
  // Duration should reflect both attempts: 11.0s, not just the final 1.0s
  expect(output).toContain('Duration:     11.0s');
});

test('maxFailures: file that never started is not shown', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'test a',
    file: 'tests/a.spec.ts',
    outcome: 'unexpected',
  });
  const t2 = mockTest({
    id: '2',
    title: 'test b',
    file: 'tests/b.spec.ts',
  });

  reporter.onBegin(mockConfig, mockSuite([t1, t2]));

  // File A runs and fails — maxFailures stops the run before file B starts
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'failed', errors: [{ message: 'fail' }] }),
  );
  reporter.onEnd({ status: 'interrupted' } as any);

  const output = getStdout();
  // File A: should appear (it started and has results)
  expect(output).toContain('Running:  tests/a.spec.ts');
  // File B: should NOT appear (it never started)
  expect(output).not.toContain('Running:  tests/b.spec.ts');
});

test('test.fail() expected failure is treated as terminal even with retries', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'expected to fail',
    file: 'tests/expected-fail.spec.ts',
    retries: 2,
    expectedStatus: 'failed',
    outcome: 'expected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // Single onTestEnd: status 'failed', retry 0 — but expectedStatus is 'failed'
  // so Playwright won't retry. Must be treated as terminal.
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'failed', retry: 0, duration: 1000 }),
  );

  const output = getStdout();
  // outcome is 'expected' → green check
  expect(output).toContain('✓ expected to fail');
  expect(output).toContain('Tests:        1');
});

test('NO_COLOR strips ANSI escapes from error messages and stack traces', () => {
  process.env.NO_COLOR = '1';
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'fails with ansi',
    file: 'tests/ansi-err.spec.ts',
    outcome: 'unexpected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));
  reporter.onTestEnd(
    t1,
    mockResult({
      status: 'failed',
      errors: [
        {
          message: '\x1B[31mExpected\x1B[0m value to be true',
          stack: 'Error: Expected value\n    at \x1B[2mtest.ts:10\x1B[0m',
        },
      ],
    }),
  );

  const output = getStdout();
  expect(output).not.toContain('\x1B[31m');
  expect(output).not.toContain('\x1B[2m');
  expect(output).not.toContain('\x1B[0m');
  expect(output).toContain('Expected');
  expect(output).toContain('value to be true');
  expect(output).toContain('at test.ts:10');
});

test('interrupted test with retries is treated as terminal, not dropped', () => {
  const reporter = new CypressStyleReporter();
  const t1 = mockTest({
    id: '1',
    title: 'was running when interrupted',
    file: 'tests/interrupt-retry.spec.ts',
    retries: 2,
    outcome: 'unexpected',
  });

  reporter.onBegin(mockConfig, mockSuite([t1]));

  // Test is on retry 0 when SIGINT fires — status: 'interrupted', retry: 0
  // Without fix: not terminal (interrupted !== passed/skipped, 0 !== 2)
  // With fix: terminal (interrupted is always terminal)
  reporter.onTestEnd(
    t1,
    mockResult({ status: 'interrupted', retry: 0, duration: 5000 }),
  );

  const output = getStdout();
  expect(output).toContain('✗ was running when interrupted');
  expect(output).toContain('Tests:        1');
});
