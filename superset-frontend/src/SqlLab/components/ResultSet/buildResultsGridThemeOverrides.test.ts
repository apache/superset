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
import type { SupersetTheme } from '@apache-superset/core/theme';
import { buildResultsGridThemeOverrides } from './buildResultsGridThemeOverrides';

test('returns undefined when no resultsGrid tokens are set', () => {
  const theme = {} as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toBeUndefined();
});

test('maps resultsGridHeaderFontSize to headerFontSize', () => {
  const theme = { resultsGridHeaderFontSize: 14 } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    headerFontSize: 14,
  });
});

test('maps resultsGridHeaderFontWeight to headerFontWeight', () => {
  const theme = { resultsGridHeaderFontWeight: 700 } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    headerFontWeight: 700,
  });
});

test('maps resultsGridRowHeight to both rowHeight and headerHeight', () => {
  const theme = { resultsGridRowHeight: 40 } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    rowHeight: 40,
    headerHeight: 40,
  });
});

test('maps resultsGridBorderRadius to both borderRadius and wrapperBorderRadius', () => {
  const theme = { resultsGridBorderRadius: 8 } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    borderRadius: 8,
    wrapperBorderRadius: 8,
  });
});

test('maps resultsGridNoStriping to oddRowBackgroundColor transparent', () => {
  const theme = { resultsGridNoStriping: true } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    oddRowBackgroundColor: 'transparent',
  });
});

test('does not map resultsGridNoStriping when false', () => {
  const theme = { resultsGridNoStriping: false } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toBeUndefined();
});

test('maps all tokens together when all are set', () => {
  const theme = {
    resultsGridHeaderFontSize: 12,
    resultsGridHeaderFontWeight: 600,
    resultsGridRowHeight: 36,
    resultsGridBorderRadius: 4,
    resultsGridNoStriping: true,
  } as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toEqual({
    headerFontSize: 12,
    headerFontWeight: 600,
    rowHeight: 36,
    headerHeight: 36,
    borderRadius: 4,
    wrapperBorderRadius: 4,
    oddRowBackgroundColor: 'transparent',
  });
});

test('ignores non-number values for numeric tokens', () => {
  const theme = {
    resultsGridRowHeight: '40',
    resultsGridHeaderFontSize: undefined,
  } as unknown as SupersetTheme;
  expect(buildResultsGridThemeOverrides(theme)).toBeUndefined();
});
