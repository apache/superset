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
import getFormDataWithExtraFilters, {
  CachedFormDataWithExtraControls,
  GetFormDataWithExtraFiltersArguments,
} from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { ChartCustomizationType } from '@superset-ui/core';
import { sliceId as chartId } from 'spec/fixtures/mockChartQueries';

type ChartCustomizationItem = NonNullable<
  GetFormDataWithExtraFiltersArguments['chartCustomizationItems']
>[number];

function createChartCustomization(
  overrides: Partial<ChartCustomizationItem> = {},
): ChartCustomizationItem {
  return {
    id: 'CHART_CUSTOMIZATION-1',
    type: ChartCustomizationType.ChartCustomization,
    name: 'Dynamic Group By',
    filterType: 'chart_customization_dynamic_groupby',
    targets: [{ datasetId: 3, column: { name: 'status' } }],
    scope: { rootPath: [], excluded: [] },
    chartsInScope: [chartId],
    defaultDataMask: {},
    controlValues: {},
    ...overrides,
  };
}

const expectGroupBy = (
  result: CachedFormDataWithExtraControls,
  expected: unknown,
) => {
  expect('groupby' in result).toBe(true);
  if (!('groupby' in result)) {
    throw new Error('Expected groupby to be present in form data');
  }
  expect(result.groupby).toEqual(expected);
};

const expectGroupByLength = (
  result: CachedFormDataWithExtraControls,
  length: number,
) => {
  expect('groupby' in result).toBe(true);
  if (!('groupby' in result)) {
    throw new Error('Expected groupby to be present in form data');
  }
  expect(result.groupby).toHaveLength(length);
};

const getResultFilters = (result: CachedFormDataWithExtraControls) => {
  if (!('filters' in result) || !Array.isArray(result.filters)) {
    return [];
  }

  return result.filters.filter(
    (
      filter,
    ): filter is {
      col: string;
      val: unknown[];
    } =>
      typeof filter === 'object' &&
      filter !== null &&
      'col' in filter &&
      'val' in filter &&
      typeof filter.col === 'string' &&
      Array.isArray(filter.val),
  );
};

const filterId = 'native-filter-1';
const mockChart = {
  id: chartId,
  chartAlert: null,
  chartStatus: null,
  chartUpdateEndTime: null,
  chartUpdateStartTime: 1,
  lastRendered: 1,
  latestQueryFormData: {},
  sliceFormData: null,
  queryController: null,
  queriesResponse: null,
  triggerQuery: false,
  form_data: {
    viz_type: 'filter_select',
    filters: [
      {
        col: 'country_name',
        op: 'IN',
        val: ['United States'],
      },
    ],
    datasource: '123',
    url_params: {},
  },
};
const mockArgs: GetFormDataWithExtraFiltersArguments = {
  chartConfiguration: {},
  chart: mockChart,
  filters: {
    region: ['Spain'],
    color: ['pink', 'purple'],
  },
  sliceId: chartId,
  nativeFilters: {},
  dataMask: {
    [filterId]: {
      id: filterId,
      extraFormData: {},
      filterState: {},
      ownState: {},
    },
  },
  extraControls: {
    stack: 'Stacked',
  },
  allSliceIds: [chartId],
};

test('should include filters from the passed filters', () => {
  const result = getFormDataWithExtraFilters(mockArgs);
  expect(result.extra_filters).toHaveLength(2);
  expect(result.extra_filters[0]).toEqual({
    col: 'region',
    op: 'IN',
    val: ['Spain'],
  });
  expect(result.extra_filters[1]).toEqual({
    col: 'color',
    op: 'IN',
    val: ['pink', 'purple'],
  });
});

test('should compose extra control', () => {
  const result: CachedFormDataWithExtraControls =
    getFormDataWithExtraFilters(mockArgs);
  expect(result.stack).toEqual('Stacked');
});

test('should merge extraFormData from chart customizations', () => {
  const customizationId = 'CHART_CUSTOMIZATION-1';
  const argsWithCustomization: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {
          time_grain_sqla: 'PT1H',
        },
        filterState: {
          value: ['category1', 'category2'],
        },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        name: 'Time Grain Customization',
        filterType: 'chart_customization_time_grain',
        targets: [
          {
            datasetId: 123,
            column: { name: 'time_column' },
          },
        ],
        scope: {
          rootPath: [],
          excluded: [],
        },
        chartsInScope: [chartId],
        defaultDataMask: {},
        controlValues: {},
      }),
    ],
  };

  const result = getFormDataWithExtraFilters(argsWithCustomization);
  expect(result).toEqual(expect.objectContaining({ time_grain_sqla: 'PT1H' }));
});

test('should merge both filters and customization extraFormData', () => {
  const customizationId = 'CHART_CUSTOMIZATION-1';
  const argsWithBoth: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    activeFilters: {
      [filterId]: {
        targets: [
          {
            datasetId: 123,
            column: { name: 'country_name' },
          },
        ],
        scope: [chartId],
        values: {
          filters: [
            {
              col: 'country_name',
              op: 'IN',
              val: ['United States'],
            },
          ],
        },
      },
    },
    dataMask: {
      [filterId]: {
        id: filterId,
        extraFormData: {
          filters: [
            {
              col: 'country_name',
              op: 'IN',
              val: ['United States'],
            },
          ],
        },
        filterState: {},
        ownState: {},
      },
      [customizationId]: {
        id: customizationId,
        extraFormData: {
          time_grain_sqla: 'PT1H',
        },
        filterState: {
          value: ['category1'],
        },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        name: 'Time Grain Customization',
        filterType: 'chart_customization_time_grain',
        targets: [
          {
            datasetId: 123,
            column: { name: 'time_column' },
          },
        ],
        scope: {
          rootPath: [],
          excluded: [],
        },
        chartsInScope: [chartId],
        defaultDataMask: {},
        controlValues: {},
      }),
    ],
  };

  const result = getFormDataWithExtraFilters(argsWithBoth);
  expect(result).toEqual(expect.objectContaining({ time_grain_sqla: 'PT1H' }));
  expect(result.extra_form_data).toBeDefined();
});

const makeGroupByArgs = (
  selectedValue: string | string[],
  baseGroupby: string[] = [],
): GetFormDataWithExtraFiltersArguments => {
  const customizationId = 'CHART_CUSTOMIZATION-groupby-1';
  return {
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'table',
        datasource: '3__table',
        groupby: baseGroupby,
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: selectedValue },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
      }),
    ],
  };
};

test('dynamic group by does not inject a filter using the selected column name as a value', () => {
  const result = getFormDataWithExtraFilters(makeGroupByArgs(['status']));
  const spuriousFilter = getResultFilters(result).find(
    filter => filter.col === 'status' && filter.val.includes('status'),
  );
  expect(spuriousFilter).toBeUndefined();
  expectGroupBy(result, ['status']);
});

test('dynamic group by still applies when the selected column is already in the base groupby', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status'], ['status']),
  );
  expectGroupBy(result, ['status']);
});

test('dynamic group by with no selection leaves the base groupby unchanged', () => {
  const result = getFormDataWithExtraFilters(makeGroupByArgs([], ['status']));
  expectGroupBy(result, ['status']);
});

test('dynamic group by ignores empty-string selections and keeps the base groupby', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['', 'status'], ['original_column']),
  );
  expectGroupBy(result, ['status']);
});

test('chord chart ignores dynamic group by selections and keeps the existing source unchanged', () => {
  const result = getFormDataWithExtraFilters({
    ...makeGroupByArgs(['payment_method'], ['status']),
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'chord',
        datasource: '3__table',
        groupby: ['status'],
      },
    },
  });

  expectGroupBy(result, ['status']);
});

test('dynamic group by normalizes a single-select string value into a one-item groupby array', () => {
  const result = getFormDataWithExtraFilters(makeGroupByArgs('status'));
  expectGroupBy(result, ['status']);
});

test('structural conflict: metric column blocks groupby override (nonConflictingColumns guard)', () => {
  const customizationId = 'CHART_CUSTOMIZATION-groupby-conflict';
  const argsWithMetricConflict: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'table',
        datasource: '3__table',
        groupby: ['original_column'],
        metrics: ['revenue'],
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: ['revenue'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        targets: [{ datasetId: 3, column: { name: 'revenue' } }],
      }),
    ],
  };

  const result = getFormDataWithExtraFilters(argsWithMetricConflict);
  expectGroupBy(result, ['original_column']);
});

test('multi-column selection: all selected columns appear in result groupby', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status', 'product_line']),
  );
  expectGroupBy(result, expect.arrayContaining(['status', 'product_line']));
  expectGroupByLength(result, 2);
});

test('dataset mismatch: display control for a different dataset does not affect the chart', () => {
  const customizationId = 'CHART_CUSTOMIZATION-wrong-dataset';
  const argsWrongDataset: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'table',
        datasource: '3__table',
        groupby: ['original_column'],
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: ['status'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        targets: [{ datasetId: 999, column: { name: 'status' } }],
      }),
    ],
  };

  const result = getFormDataWithExtraFilters(argsWrongDataset);
  expectGroupBy(result, ['original_column']);
});

test('dynamic group by with overlapping selection preserves multi-column base groupby', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status'], ['status', 'category']),
  );
  expectGroupBy(result, ['status', 'category']);
});

test('timeseries chart: overlapping selection preserves multi-column base groupby', () => {
  const customizationId = 'CHART_CUSTOMIZATION-groupby-1';
  const result = getFormDataWithExtraFilters({
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'echarts_timeseries_line',
        datasource: '3__table',
        groupby: ['series_col', 'breakdown_col'],
        x_axis: 'time_col',
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: ['series_col'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({ id: customizationId }),
    ],
  });
  expectGroupBy(result, ['series_col', 'breakdown_col']);
});

test('partial overlap: only non-existing columns pass through as customization override', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status', 'new_col'], ['status', 'category']),
  );
  expectGroupBy(result, ['new_col']);
});

test('object-typed groupby entries (AdhocColumn) are recognized as existing columns', () => {
  const customizationId = 'CHART_CUSTOMIZATION-groupby-1';
  const result = getFormDataWithExtraFilters({
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'table',
        datasource: '3__table',
        groupby: [{ column_name: 'status' }, 'category'],
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: ['status', 'new_col'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({ id: customizationId }),
    ],
  });
  // 'status' is already in groupby (as an object with column_name), so only 'new_col' passes through
  expectGroupBy(result, ['new_col']);
});

test('Scope boundary: display control with chartsInScope:[] does not affect the chart', () => {
  const customizationId = 'CHART_CUSTOMIZATION-groupby-out-of-scope';
  const argsOutOfScope: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        viz_type: 'table',
        datasource: '3__table',
        groupby: ['original_column'],
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        extraFormData: {},
        filterState: { value: ['replacement_column'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        name: 'Out Of Scope Group By',
        chartsInScope: [],
      }),
    ],
  };

  const result = getFormDataWithExtraFilters(argsOutOfScope);
  expectGroupBy(result, ['original_column']);
});
