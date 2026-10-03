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
  parseOxlintResult,
  parseRuleId,
} from '../../scripts/internal/oxlint-metrics-uploader';

test('eslint rules keep their bare name', () => {
  expect(parseRuleId('eslint(no-console)')).toMatchObject({
    parsed: 'no-console',
    pluginId: 'eslint',
  });
  expect(parseRuleId('eslint(prefer-destructuring)')).toMatchObject({
    parsed: 'prefer-destructuring',
    pluginId: 'eslint',
  });
});

test('plugin rules are recorded under plugin/rule (#42981)', () => {
  // These are the codes oxlint actually emits. They previously fell through to
  // the raw `react-hooks(exhaustive-deps)` string, so the rows no longer lined
  // up with the ids the same rules were recorded under before the migration.
  expect(parseRuleId('react-hooks(exhaustive-deps)')).toMatchObject({
    parsed: 'react-hooks/exhaustive-deps',
    pluginId: 'react-hooks',
  });
  expect(parseRuleId('react-hooks(rules-of-hooks)')).toMatchObject({
    parsed: 'react-hooks/rules-of-hooks',
    pluginId: 'react-hooks',
  });
  expect(parseRuleId('react(jsx-key)')).toMatchObject({
    parsed: 'react/jsx-key',
    pluginId: 'react',
  });
  expect(parseRuleId('jest(no-conditional-expect)')).toMatchObject({
    parsed: 'jest/no-conditional-expect',
    pluginId: 'jest',
  });
  expect(parseRuleId('oxc(erasing-op)')).toMatchObject({
    parsed: 'oxc/erasing-op',
    pluginId: 'oxc',
  });
  expect(parseRuleId('typescript(no-explicit-any)')).toMatchObject({
    parsed: 'typescript/no-explicit-any',
    pluginId: 'typescript',
  });
});

test('the legacy eslint-plugin- prefix still collapses to the plugin name', () => {
  expect(parseRuleId('eslint-plugin-unicorn(no-new-array)')).toMatchObject({
    parsed: 'unicorn/no-new-array',
    pluginId: 'unicorn',
  });
});

test('an unrecognized or missing code is passed through rather than dropped', () => {
  expect(parseRuleId('something-unparseable')).toMatchObject({
    parsed: 'something-unparseable',
    pluginId: 'unknown',
  });
  expect(parseRuleId(undefined)).toMatchObject({
    parsed: 'unknown',
    pluginId: 'unknown',
  });
  expect(parseRuleId('')).toMatchObject({
    parsed: 'unknown',
    pluginId: 'unknown',
  });
});

test('parseOxlintResult aggregates diagnostics and records their locations', () => {
  const result = parseOxlintResult({
    diagnostics: [
      {
        code: 'eslint(no-console)',
        filename: 'src/first.ts',
        message: 'Unexpected console statement',
        labels: [{ span: { line: 4, column: 8 } }],
      },
      {
        code: 'eslint(no-console)',
        filename: 'src/second.ts',
        message: 'Unexpected console statement',
        labels: [{ span: { line: 9, column: 2 } }],
      },
      {
        code: 'theme-colors(no-literal-colors)',
        filename: 'src/theme.ts',
        message: 'Use a theme color',
        labels: [{ span: { line: 12, column: 6 } }],
      },
    ],
  });

  expect(result.metricsByRule).toEqual({
    'no-console': { count: 2 },
    'theme-colors/no-literal-colors': { count: 1 },
  });
  expect(result.occurrencesData).toMatchObject([
    {
      rule: 'no-console',
      message: 'Unexpected console statement',
      file: 'src/first.ts',
      line: 4,
      column: 8,
    },
    {
      rule: 'no-console',
      message: 'Unexpected console statement',
      file: 'src/second.ts',
      line: 9,
      column: 2,
    },
    {
      rule: 'theme-colors/no-literal-colors',
      message: 'Use a theme color',
      file: 'src/theme.ts',
      line: 12,
      column: 6,
    },
  ]);
  expect(result.occurrencesData[0].ts).toEqual(expect.any(String));
});

test('parseOxlintResult filters diagnostics by plugin ID prefixes', () => {
  const result = parseOxlintResult(
    {
      diagnostics: [
        {
          code: 'eslint(no-console)',
          filename: 'src/app.ts',
          message: 'Unexpected console statement',
        },
        {
          code: 'i18n-strings(no-template-vars)',
          filename: 'src/translation.ts',
          message: 'Avoid template variables',
        },
      ],
    },
    ['i18n-strings'],
  );

  expect(result.metricsByRule).toEqual({
    'i18n-strings/no-template-vars': { count: 1 },
  });
  expect(result.occurrencesData).toMatchObject([
    {
      rule: 'i18n-strings/no-template-vars',
      file: 'src/translation.ts',
      message: 'Avoid template variables',
    },
  ]);
});
