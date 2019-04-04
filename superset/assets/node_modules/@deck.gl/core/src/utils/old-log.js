// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// TODO / DEPRECATED - remove once probe.gl log integration is proving
/* eslint-disable no-console */
/* global console */
import assert from '../utils/assert';

const cache = {};

function log(priority, arg, ...args) {
  assert(Number.isFinite(priority), 'log priority must be a number');
  if (priority <= log.priority) {
    // Node doesn't have console.debug, but using it looks better in browser consoles
    args = formatArgs(arg, ...args);
    if (console.debug) {
      console.debug(...args);
    } else {
      console.info(...args);
    }
  }
}

function once(priority, arg, ...args) {
  if (!cache[arg] && priority <= log.priority) {
    args = checkForAssertionErrors(args);
    console.error(...formatArgs(arg, ...args));
    cache[arg] = true;
  }
}

function warn(arg, ...args) {
  if (!cache[arg]) {
    console.warn(`deck.gl: ${arg}`, ...args);
    cache[arg] = true;
  }
}

function error(arg, ...args) {
  console.error(`deck.gl: ${arg}`, ...args);
}

function deprecated(oldUsage, newUsage) {
  log.warn(`\`${oldUsage}\` is deprecated and will be removed \
in a later version. Use \`${newUsage}\` instead`);
}

function removed(oldUsage, newUsage) {
  log.error(`\`${oldUsage}\` is no longer supported. Use \`${newUsage}\` instead,\
 check our upgrade-guide.md for more details`);
}

// Logs a message with a time
function time(priority, label) {
  assert(Number.isFinite(priority), 'log priority must be a number');
  if (priority <= log.priority) {
    // In case the platform doesn't have console.time
    if (console.time) {
      console.time(label);
    } else {
      console.info(label);
    }
  }
}

function timeEnd(priority, label) {
  assert(Number.isFinite(priority), 'log priority must be a number');
  if (priority <= log.priority) {
    // In case the platform doesn't have console.timeEnd
    if (console.timeEnd) {
      console.timeEnd(label);
    } else {
      console.info(label);
    }
  }
}

function group(priority, arg, {collapsed = false} = {}) {
  if (priority <= log.priority) {
    if (collapsed) {
      console.groupCollapsed(`luma.gl: ${arg}`);
    } else {
      console.group(`luma.gl: ${arg}`);
    }
  }
}

function groupEnd(priority, arg) {
  if (priority <= log.priority) {
    console.groupEnd(`luma.gl: ${arg}`);
  }
}

// Helper functions

function formatArgs(firstArg, ...args) {
  if (typeof firstArg === 'function') {
    firstArg = firstArg();
  }
  if (typeof firstArg === 'string') {
    args.unshift(`deck.gl ${firstArg}`);
  } else {
    args.unshift(firstArg);
    args.unshift('deck.gl');
  }
  return args;
}

// Assertions don't generate standard exceptions and don't print nicely
function checkForAssertionErrors(args) {
  const isAssertion =
    args &&
    args.length > 0 &&
    typeof args[0] === 'object' &&
    args[0] !== null &&
    args[0].name === 'AssertionError';

  if (isAssertion) {
    args = Array.prototype.slice.call(args);
    args.unshift(`assert(${args[0].message})`);
  }
  return args;
}

log.priority = 0;
log.log = log;
log.once = once;
log.time = time;
log.timeEnd = timeEnd;
log.warn = warn;
log.error = error;
log.deprecated = deprecated;
log.removed = removed;
log.group = group;
log.groupEnd = groupEnd;

export default log;
