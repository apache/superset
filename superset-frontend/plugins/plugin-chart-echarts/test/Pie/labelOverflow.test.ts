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
import {
  applyLabelOverflow,
  LABEL_ELLIPSIS,
  splitGraphemes,
  truncateLine,
  wrapLine,
} from '../../src/Pie/labelOverflow';
import { EchartsPieLabelOverflow } from '../../src/Pie/types';

// Deterministic measure: every user-perceived character is 10px wide.
const measure = (text: string) => splitGraphemes(text).length * 10;

test('truncateLine returns lines that fit unchanged', () => {
  expect(truncateLine('Short', 50, measure)).toBe('Short');
});

test('truncateLine keeps the longest prefix that fits next to the ellipsis', () => {
  // 100px fits 10 characters: 7 of the label plus the 3-character ellipsis.
  const result = truncateLine('Category name', 100, measure);
  expect(result).toBe(`Categor${LABEL_ELLIPSIS}`);
  expect(measure(result)).toBeLessThanOrEqual(100);
});

test('truncateLine trims a trailing space before the ellipsis', () => {
  expect(truncateLine('Big long name', 70, measure)).toBe(
    `Big${LABEL_ELLIPSIS}`,
  );
});

test('truncateLine returns only the ellipsis when nothing else fits', () => {
  expect(truncateLine('Category', 30, measure)).toBe(LABEL_ELLIPSIS);
  expect(truncateLine('Category', 1, measure)).toBe(LABEL_ELLIPSIS);
});

test('truncateLine never splits an emoji surrogate pair', () => {
  const result = truncateLine('A😀😀😀😀 category', 60, measure);
  expect(result).toBe(`A😀😀${LABEL_ELLIPSIS}`);
  expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
});

test('splitGraphemes keeps emoji sequences and combining marks together', () => {
  const accented = 'e\u0301';
  expect(splitGraphemes(`a👩‍💻${accented}`)).toEqual(['a', '👩‍💻', accented]);
});

test('wrapLine breaks at spaces', () => {
  expect(wrapLine('one two three four', 90, measure)).toEqual([
    'one two',
    'three',
    'four',
  ]);
});

test('wrapLine splits words wider than the limit so every line fits', () => {
  const lines = wrapLine('Supercalifragilistic is long', 60, measure);
  expect(lines).toEqual(['Superc', 'alifra', 'gilist', 'ic is', 'long']);
  lines.forEach(line => expect(measure(line)).toBeLessThanOrEqual(60));
});

test('wrapLine splits CJK text without spaces and keeps every character', () => {
  const text = '这是一个非常长的类别名称';
  const lines = wrapLine(text, 40, measure);
  expect(lines.join('')).toBe(text);
  lines.forEach(line => expect(measure(line)).toBeLessThanOrEqual(40));
});

test('wrapLine gives a character wider than the limit its own line', () => {
  expect(wrapLine('abc', 5, measure)).toEqual(['a', 'b', 'c']);
});

test('applyLabelOverflow handles each line of a multiline label separately', () => {
  expect(
    applyLabelOverflow('A long category name\n33.3%', {
      maxWidth: 100,
      overflow: EchartsPieLabelOverflow.Truncate,
      measure,
    }),
  ).toBe(`A long${LABEL_ELLIPSIS}\n33.3%`);
});

test('applyLabelOverflow wraps when overflow is break', () => {
  expect(
    applyLabelOverflow('one two three\n33.3%', {
      maxWidth: 90,
      overflow: EchartsPieLabelOverflow.Break,
      measure,
    }),
  ).toBe('one two\nthree\n33.3%');
});

test('applyLabelOverflow leaves labels alone without a positive max width', () => {
  [0, -10, Number.NaN].forEach(maxWidth =>
    expect(
      applyLabelOverflow('A long category name', {
        maxWidth,
        overflow: EchartsPieLabelOverflow.Truncate,
        measure,
      }),
    ).toBe('A long category name'),
  );
});
