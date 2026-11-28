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
import { compileTemplate, isTemplate } from './template';

test('an item-trigger params object is the template context', () => {
  const format = compileTemplate('{{marker}} {{seriesName}}: {{value}}');
  expect(
    format({ marker: '{m|}', seriesName: 'Sales', value: 1234, name: 'Q1' }),
  ).toBe('{m|} Sales: 1234');
});

test('an axis-trigger params array exposes the first item and every item', () => {
  const format = compileTemplate(
    '{{name}}\n{{#each items}}{{seriesName}}={{value}}\n{{/each}}',
  );
  expect(
    format([
      { name: 'Q1', seriesName: 'Sales', value: 1 },
      { name: 'Q1', seriesName: 'Cost', value: 2 },
    ]),
  ).toBe('Q1\nSales=1\nCost=2\n');
});

test('a bare value with its index, as axis labels and valueFormatter pass', () => {
  const format = compileTemplate("{{formatNumber value ',.1f'}} #{{index}}");
  expect(format(1234.56, 3)).toBe('1,234.6 #3');
});

test('formatNumber takes a d3 format and passes non-numbers through', () => {
  expect(compileTemplate("{{formatNumber value '.3s'}}")(1234567)).toBe(
    '1.23M',
  );
  expect(compileTemplate('{{formatNumber value}}')('n/a')).toBe('n/a');
  expect(compileTemplate('{{formatNumber value}}')(null)).toBe('');
});

test('formatDate takes a d3 time format', () => {
  const format = compileTemplate("{{formatDate value '%Y-%m-%d'}}");
  expect(format(Date.UTC(2024, 0, 15))).toBe('2024-01-15');
  expect(format('not a date')).toBe('not a date');
});

test('default fills empty values', () => {
  const format = compileTemplate("{{default name 'Unknown'}}");
  expect(format({ name: '' })).toBe('Unknown');
  expect(format({ name: 'Q1' })).toBe('Q1');
});

test('output is not HTML-escaped: it is drawn as rich text, not markup', () => {
  expect(compileTemplate('{{name}}')({ name: 'A & B <C>' })).toBe('A & B <C>');
});

test('a template that does not parse throws when compiled', () => {
  expect(() => compileTemplate('{{#each items}}')).toThrow();
});

test('isTemplate recognises only a {$template: string} record', () => {
  expect(isTemplate({ $template: '{{value}}' })).toBe(true);
  expect(isTemplate({ $template: 1 })).toBe(false);
  expect(isTemplate('{{value}}')).toBe(false);
  expect(isTemplate(null)).toBe(false);
});
