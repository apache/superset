/* eslint-disable no-console */
/* global setTimeout, console */
import {formatSI, rightPad} from '../lib/utils/formatters';
import {global} from '../lib/utils/globals';
import {autobind} from '../lib/utils/autobind';
import LocalStorage from '../lib/utils/local-storage';
import assert from 'assert';

const noop = () => {};

const TIME_THRESHOLD_MS = 80; // Minimum number of milliseconds to iterate each bench test
const TIME_COOLDOWN_MS = 5; // milliseconds of "cooldown" between tests
const MIN_ITERATIONS = 1; // Increase if OK to let slow benchmarks take long time

export const LOG_ENTRY = {
  GROUP: 'group',
  TEST: 'test',
  COMPLETE: 'complete'
};

const CALIBRATION_TESTS = [
  {
    id: 'warmup',
    initFunc: noop,
    testFunc: () => 100,
    opts: {}
  }
];

export default class Bench {
  constructor({
    id, // Name is needed for regression (storing/loading)
    log,
    time = TIME_THRESHOLD_MS,
    delay = TIME_COOLDOWN_MS,
    minIterations = MIN_ITERATIONS
  } = {}) {
    if (!log) {
      const markdown = global.probe && global.probe.markdown;
      log = markdown ? logResultsAsMarkdownTable : logResultsAsTree;
    }

    this.id = id;
    this.opts = {log, time, delay, minIterations};
    this.tests = {};
    this.results = {};
    this.table = {};
    autobind(this);
    Object.seal(this);
  }

  calibrate(id, func1, func2, opts) {
    return this;
  }

  run() {
    const timer = new Date();

    const {tests, onBenchmarkComplete} = this;
    const promise = runAsyncTests({tests, onBenchmarkComplete});

    promise.then(() => {
      const elapsed = (new Date() - timer) / 1000;
      logEntry(this, {entry: LOG_ENTRY.COMPLETE, time: elapsed, message: 'Complete'});
      this.onSuiteComplete();
    });

    return promise;
  }

  group(id) {
    assert(!this.tests[id], 'tests need unique id strings');
    this.tests[id] = {id, group: true, opts: this.opts};
    return this;
  }

  // Signatures:
  // add(priority, id, initFunc, testFunc)
  // add(priority, id, testFunc)
  // add(id, initFunc, testFunc)
  // add(id, testFunc)
  add(priority, id, func1, func2) {
    if (typeof priority === 'string') {
      func2 = func1;
      func1 = id;
      id = priority;
      priority = 0;
    }

    assert(id);
    assert(typeof func1 === 'function');

    let initFunc = null;
    let testFunc = func1;
    if (typeof func2 === 'function') {
      initFunc = func1;
      testFunc = func2;
    }

    assert(!this.tests[id], 'tests need unique id strings');
    this.tests[id] = {id, priority, initFunc, testFunc, opts: this.opts};
    return this;
  }

  onBenchmarkComplete({id, time, iterations, itersPerSecond}) {
    // calculate iterations per second, save as numeric value
    const current = Math.round(iterations / time);
    // Format as human readable strings
    this.table[id] = {
      percent: '',
      iterations: `${itersPerSecond}/s`,
      current,
      max: ''
    };
  }

  onSuiteComplete() {
    const localStorage = new LocalStorage({id: this.id});
    const saved = localStorage.getConfiguration();
    const current = this.updateTable(this.table, saved);
    localStorage.updateConfiguration(current);
    console.table(current);
  }

  updateTable(current, saved) {
    for (const id in this.table) {
      if (saved[id] && saved[id].max !== undefined) {
        current[id].max = Math.max(current[id].current, saved[id].max);
        const delta = current[id].current / saved[id].max;
        current[id].percent = `${Math.round(delta * 100 - 100)}%`;
      } else {
        current[id].max = current[id].current;
      }
    }
    return current;
  }
}

// Helper methods

function runCalibrationTests({tests}) {
  let promise = Promise.resolve(true);

  // Run default warm up and calibration tests
  for (const test of CALIBRATION_TESTS) {
    promise = promise.then(() => runAsyncTest({test, silent: true}));
  }

  return promise;
}

// Run a list of bench test case async
function runAsyncTests({tests, onBenchmarkComplete = noop}) {
  // Run default warm up and calibration tests
  let promise = runCalibrationTests({tests, onBenchmarkComplete});

  // Run the suite tests
  for (const id in tests) {
    const test = tests[id];
    promise = promise.then(() => runAsyncTest({test, onBenchmarkComplete}));
  }
  return promise;
}

function runAsyncTest({test, onBenchmarkComplete, silent = false}) {
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        if (test.group) {
          logEntry(test, {entry: LOG_ENTRY.GROUP, id: test.id, message: test.id});
        } else {
          const {time, iterations} = runBenchTest(test);

          const iterationsPerSecond = iterations / time;
          const itersPerSecond = formatSI(iterationsPerSecond);
          if (!silent) {
            logEntry(test, {
              entry: LOG_ENTRY.TEST, id: test.id, priority: test.priority, itersPerSecond, time,
              message: `${test.id} ${itersPerSecond}/s`
            });
          }

          if (onBenchmarkComplete) {
            onBenchmarkComplete({
              id: test.id,
              time,
              iterations,
              iterationsPerSecond,
              itersPerSecond
            });
          }
        }
      } finally {
        resolve(true);
      }
    }, test.opts.delay); // small delay between each test. System cools and DOM console updates...
  });
}

// Run a test func for an increasing amount of iterations until time threshold exceeded
function runBenchTest(test) {
  let iterations = test.opts.minIterations / 10;
  let elapsedMillis = 0;

  // Run increasing amount of interations until we reach time threshold, default at least 100ms
  while (elapsedMillis < test.opts.time) {
    let multiplier = 10;
    if (elapsedMillis > 10) {
      multiplier = (test.opts.time / elapsedMillis) * 1.25;
    }
    iterations *= multiplier;
    const timer = new Date();
    runBenchTestIterations(test, iterations);
    elapsedMillis = new Date() - timer;
  }

  const time = elapsedMillis / 1000;

  return {time, iterations};
}

// Run a test func for a specific amount of iterations
function runBenchTestIterations(test, iterations) {
  const testArgs = test.initFunc && test.initFunc();

  const {context, testFunc} = test;
  if (context && testArgs) {
    for (let i = 0; i < iterations; i++) {
      testFunc.call(context, testArgs);
    }
  } else {
    for (let i = 0; i < iterations; i++) {
      testFunc.call(context);
    }
  }
}

function logEntry(test, opts) {
  const priority = (global.probe && global.probe.priority) | 10;
  if ((opts.priority | 0) <= priority) {
    test.opts.log(opts);
  }
}

export function logResultsAsMarkdownTable({entry, id, itersPerSecond, time}) {
  const COL1 = 50;
  const COL2 = 12;
  switch (entry) {
  case LOG_ENTRY.GROUP:
    console.log('');
    console.log(`| ${rightPad(id, COL1)} | iterations/s |`);
    console.log(`| ${rightPad('---', COL1)} | ---          |`);
    break;
  case LOG_ENTRY.TEST:
    console.log(`| ${rightPad(id, COL1)} | ${rightPad(itersPerSecond, COL2)} |`);
    break;
  case LOG_ENTRY.COMPLETE:
    console.log('');
    console.log(`Completed benchmark in ${time}s`);
    break;
  default:
  }
}

export function logResultsAsTree({entry, id, itersPerSecond, time}) {
  switch (entry) {
  case LOG_ENTRY.GROUP:
    console.log('');
    console.log(`${id}`);
    break;
  case LOG_ENTRY.TEST:
    console.log(`├─ ${id}: ${itersPerSecond} iterations/s`);
    break;
  case LOG_ENTRY.COMPLETE:
    console.log('');
    console.log(`Completed benchmark in ${time}s`);
    break;
  default:
  }
}

export function logResultsAsTreeWithElapsed({entry, id, itersPerSecond, time}) {
  switch (entry) {
  case LOG_ENTRY.TEST:
    console.log(`├─ ${id}: ${itersPerSecond} iterations/s (${time.toFixed(2)}s elapsed)`);
    break;
  default:
    logResultsAsTree({entry, id, itersPerSecond, time});
  }
}

