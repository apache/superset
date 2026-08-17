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
const { parseRuleId } = require('../../scripts/oxlint-metrics-uploader');

test('eslint rules keep their bare name', () => {
  expect(parseRuleId('eslint(no-console)')).toBe('no-console');
  expect(parseRuleId('eslint(prefer-destructuring)')).toBe(
    'prefer-destructuring',
  );
});

test('plugin rules are recorded under plugin/rule (#42981)', () => {
  // These are the codes oxlint actually emits. They previously fell through to
  // the raw `react-hooks(exhaustive-deps)` string, so the rows no longer lined
  // up with the ids the same rules were recorded under before the migration.
  expect(parseRuleId('react-hooks(exhaustive-deps)')).toBe(
    'react-hooks/exhaustive-deps',
  );
  expect(parseRuleId('react-hooks(rules-of-hooks)')).toBe(
    'react-hooks/rules-of-hooks',
  );
  expect(parseRuleId('react(jsx-key)')).toBe('react/jsx-key');
  expect(parseRuleId('jest(no-conditional-expect)')).toBe(
    'jest/no-conditional-expect',
  );
  expect(parseRuleId('oxc(erasing-op)')).toBe('oxc/erasing-op');
  expect(parseRuleId('typescript(no-explicit-any)')).toBe(
    'typescript/no-explicit-any',
  );
});

test('the legacy eslint-plugin- prefix still collapses to the plugin name', () => {
  expect(parseRuleId('eslint-plugin-unicorn(no-new-array)')).toBe(
    'unicorn/no-new-array',
  );
});

test('an unrecognized or missing code is passed through rather than dropped', () => {
  expect(parseRuleId('something-unparseable')).toBe('something-unparseable');
  expect(parseRuleId(undefined)).toBe('unknown');
  expect(parseRuleId('')).toBe('unknown');
});
