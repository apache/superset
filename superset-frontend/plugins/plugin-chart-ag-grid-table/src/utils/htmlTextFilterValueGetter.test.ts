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
import { ValueGetterParams } from '@superset-ui/core/components/ThemedAgGridReact';
import htmlTextFilterValueGetter, {
  htmlTextComparator,
} from './htmlTextFilterValueGetter';

const makeParams = (value: unknown): ValueGetterParams =>
  ({
    data: { foo: value },
    colDef: { field: 'foo' },
  }) as unknown as ValueGetterParams;

test('htmlTextFilterValueGetter extracts visible text from HTML anchor', () => {
  expect(
    htmlTextFilterValueGetter(
      makeParams(
        '<a href="https://jira.example.com/123/S18_3232">S18_3232</a>',
      ),
    ),
  ).toBe('S18_3232');
});

test('htmlTextFilterValueGetter strips nested HTML markup', () => {
  expect(
    htmlTextFilterValueGetter(
      makeParams('<div><strong>Hello</strong> <em>World</em></div>'),
    ),
  ).toBe('Hello World');
});

test('htmlTextFilterValueGetter passes plain strings through', () => {
  expect(htmlTextFilterValueGetter(makeParams('plain value'))).toBe(
    'plain value',
  );
});

test('htmlTextFilterValueGetter passes non-string values through', () => {
  expect(htmlTextFilterValueGetter(makeParams(42))).toBe(42);
  expect(htmlTextFilterValueGetter(makeParams(null))).toBeNull();
  expect(htmlTextFilterValueGetter(makeParams(undefined))).toBeUndefined();
});

test('htmlTextComparator orders by visible text, not raw HTML', () => {
  // URL prefixes (zzz vs bbb) would flip the order under raw-HTML sort,
  // but the visible labels (S700_4002 vs S72_3212) sort the other way.
  const left = '<a href="https://jira.example.com/zzz/S700_4002">S700_4002</a>';
  const right = '<a href="https://jira.example.com/bbb/S72_3212">S72_3212</a>';
  expect(htmlTextComparator(left, right)).toBeLessThan(0);
});

test('htmlTextComparator handles nulls and numbers', () => {
  expect(htmlTextComparator(null, null)).toBe(0);
  expect(htmlTextComparator(null, 'x')).toBeLessThan(0);
  expect(htmlTextComparator('x', null)).toBeGreaterThan(0);
  expect(htmlTextComparator(1, 2)).toBeLessThan(0);
  expect(htmlTextComparator(2, 1)).toBeGreaterThan(0);
});

test('htmlTextComparator preserves default codepoint ordering for plain strings', () => {
  // AG Grid's default string comparator orders by codepoint, so 'Z' (90)
  // sorts before 'a' (97). A locale-aware comparator would flip this —
  // verify we match the default so plain string columns are unaffected.
  expect(htmlTextComparator('Z', 'a')).toBeLessThan(0);
  expect(htmlTextComparator('a', 'Z')).toBeGreaterThan(0);
  expect(htmlTextComparator('apple', 'banana')).toBeLessThan(0);
});
