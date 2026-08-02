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
import { deriveMessageTitle, isCollapsible, messageBody } from './messageTitle';

test('prefers a heading the model wrote', () => {
  expect(
    deriveMessageTitle('## Dashboard structure\n\nIt has three rows.'),
  ).toBe('Dashboard structure');
});

test('falls back to the first sentence', () => {
  expect(
    deriveMessageTitle('This dashboard tracks revenue. It has 4 charts.'),
  ).toBe('This dashboard tracks revenue.');
});

test('strips markdown decoration from the title', () => {
  expect(deriveMessageTitle('- **Revenue** grew by `12%`')).toBe(
    'Revenue grew by 12%',
  );
  expect(deriveMessageTitle('See [the docs](https://example.com) first.')).toBe(
    'See the docs first.',
  );
});

test('does not split on decimals or dotted identifiers', () => {
  expect(deriveMessageTitle('Chart v1.2 uses slice.id for lookups.')).toBe(
    'Chart v1.2 uses slice.id for lookups.',
  );
});

test('skips a leading code fence when deriving a title', () => {
  expect(deriveMessageTitle('```sql\nSELECT 1\n```')).toBe('SELECT 1');
});

test('truncates a long title', () => {
  const title = deriveMessageTitle('x'.repeat(200));
  expect(title).toHaveLength(71);
  expect(title.endsWith('…')).toBe(true);
});

test('falls back to a generic label for empty content', () => {
  expect(deriveMessageTitle('   ')).toBe('Assistant');
});

test('only long or multi-line replies are collapsible', () => {
  expect(isCollapsible('Short answer.')).toBe(false);
  expect(isCollapsible('Line one\nLine two')).toBe(true);
  expect(isCollapsible('y'.repeat(120))).toBe(true);
});

test('a leading heading is not repeated in the body', () => {
  const content = '## Revenue overview\n\nIt tracks revenue by region.';
  expect(messageBody(content)).toBe('It tracks revenue by region.');
});

test('headings further down stay part of the body', () => {
  const content = 'Intro line.\n\n## Details\n\nMore.';
  expect(messageBody(content)).toBe(content);
});
