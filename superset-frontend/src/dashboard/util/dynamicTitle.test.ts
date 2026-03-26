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
  canApplyDynamicTitleToScope,
  createDynamicTitleAlias,
  DYNAMIC_TITLE_CHART_TITLE_ALIAS,
  extractDynamicTitleAliases,
  findDynamicTitleScopeConflict,
  getDynamicTitleControlValues,
  hasSingleChartScope,
  isBuiltInDynamicTitleAlias,
  renderDynamicTitleTemplate,
  usesChartTitleToken,
} from './dynamicTitle';

test('extractDynamicTitleAliases returns unique aliases from template tokens', () => {
  expect(
    extractDynamicTitleAliases(
      'Sales in {{country}} during {{period}} {{country}}',
    ),
  ).toEqual(['country', 'period']);
});

test('renderDynamicTitleTemplate replaces aliases and trims whitespace', () => {
  expect(
    renderDynamicTitleTemplate('Sales in {{country}} for {{period}}', {
      country: 'Brazil',
      period: '',
    }),
  ).toBe('Sales in Brazil for');
});

test('createDynamicTitleAlias generates stable unique aliases', () => {
  expect(createDynamicTitleAlias('Country Filter', ['country_filter'])).toBe(
    'country_filter_2',
  );
});

test('createDynamicTitleAlias reserves built-in dynamic title aliases', () => {
  expect(createDynamicTitleAlias('Chart title', [])).toBe('chart_title_2');
});

test('getDynamicTitleControlValues removes reserved token mappings', () => {
  expect(
    getDynamicTitleControlValues({
      controlValues: {
        template: '{{chart_title}} - {{country}}',
        tokenMappings: {
          chart_title: 'NATIVE_FILTER-chart-title',
          country: 'NATIVE_FILTER-country',
        },
      },
    }),
  ).toEqual({
    template: '{{chart_title}} - {{country}}',
    tokenMappings: {
      country: 'NATIVE_FILTER-country',
    },
  });
});

test('findDynamicTitleScopeConflict returns overlapping dynamic title', () => {
  expect(
    findDynamicTitleScopeConflict(
      {
        id: 'dynamic-title-2',
        chartsInScope: [2, 3],
      },
      [
        {
          id: 'dynamic-title-1',
          chartsInScope: [1, 2],
        },
      ],
    ),
  ).toEqual({
    id: 'dynamic-title-1',
    chartsInScope: [1, 2],
  });
});

test('findDynamicTitleScopeConflict ignores non-overlapping dynamic titles', () => {
  expect(
    findDynamicTitleScopeConflict(
      {
        id: 'dynamic-title-2',
        chartsInScope: [3, 4],
      },
      [
        {
          id: 'dynamic-title-1',
          chartsInScope: [1, 2],
        },
      ],
    ),
  ).toBeUndefined();
});

test('hasSingleChartScope requires exactly one chart', () => {
  expect(hasSingleChartScope([42])).toBe(true);
  expect(hasSingleChartScope([42, 43])).toBe(false);
  expect(hasSingleChartScope([])).toBe(false);
  expect(hasSingleChartScope()).toBe(false);
});

test('isBuiltInDynamicTitleAlias only matches reserved aliases', () => {
  expect(isBuiltInDynamicTitleAlias(DYNAMIC_TITLE_CHART_TITLE_ALIAS)).toBe(
    true,
  );
  expect(isBuiltInDynamicTitleAlias('country')).toBe(false);
});

test('usesChartTitleToken detects built-in chart title token', () => {
  expect(usesChartTitleToken('{{chart_title}} - {{country}}')).toBe(true);
  expect(usesChartTitleToken('Sales in {{country}}')).toBe(false);
});

test('canApplyDynamicTitleToScope allows multi-chart templates with chart_title', () => {
  expect(canApplyDynamicTitleToScope('Sales in {{country}}', [1])).toBe(true);
  expect(canApplyDynamicTitleToScope('Sales in {{country}}', [1, 2])).toBe(
    false,
  );
  expect(
    canApplyDynamicTitleToScope('{{chart_title}} - {{country}}', [1, 2]),
  ).toBe(true);
});
