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

/**
 * Cascade guards for layout bugs that no other test here can catch.
 *
 * jsdom does not lay out or cascade CSS, so these assert the stylesheet's
 * TEXT rather than computed geometry. That is a real limitation and worth
 * stating: this pins that the fix is still present, not that the widget
 * renders correctly. Visual correctness is host/browser verification.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk rather than importing: Vite's CSS pipeline claims `.css`
// imports, and `?raw` resolves to an empty string here.
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf-8');

function block(selector: string): string {
  // Tolerant of whitespace/formatting differences introduced by the CSS
  // pipeline: match the selector as a whole rule head, not a literal string.
  const head = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[};])\\s*${head}\\s*\\{([^}]*)\\}`, 'm');
  const m = re.exec(css);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[2];
}

describe('big-number sparkline slot', () => {
  // `.sv-echart` sets `min-height: 220px`, which is correct for a primary
  // chart view. min-height beats the parent's `height`, so the sparkline's
  // chart could not shrink into its 64px slot: it rendered 220px tall and,
  // with overflow visible, painted straight over the insight and diagnostics
  // rows below. Reproduced at the DEFAULT 420px widget height, so any short
  // frame hit it.
  it('keeps the shared 220px chart floor off the sparkline', () => {
    expect(block('.sv-echart')).toContain('min-height: 220px');
    expect(block('.sv-bignum-spark > .sv-echart')).toContain('min-height: 0');
  });

  it('clips the sparkline slot so a mis-sized chart cannot paint over siblings', () => {
    expect(block('.sv-bignum-spark')).toContain('overflow: hidden');
  });
});

describe('host diagnostics summary', () => {
  // The summary carries the capability key names, sandbox grants and display
  // modes, and is the only diagnostic that reliably survives the trip out of a
  // host. It was shipped with `text-overflow: ellipsis`, which clipped the
  // capability list mid-word — the styling truncated exactly the payload the
  // line exists to deliver. It must wrap instead.
  it('wraps rather than ellipsizing the capability line', () => {
    const rule = block('.sv-diag > summary');
    expect(rule).not.toContain('text-overflow: ellipsis');
    expect(rule).not.toContain('white-space: nowrap');
    expect(rule).toContain('white-space: normal');
  });
});
