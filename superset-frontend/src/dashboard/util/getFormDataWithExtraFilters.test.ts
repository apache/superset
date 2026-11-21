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
import { getSelectExtraFormData } from 'src/filters/utils';
import getFormDataWithExtraFilters, {
  CachedFormDataWithExtraControls,
  getCustomizationSelectionSources,
  GetFormDataWithExtraFiltersArguments,
} from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import {
  ChartCustomizationType,
  DataMask,
  DataMaskWithId,
  SemanticSelectionSource,
  DatasourceType,
  buildQueryObject,
  QueryFormData,
} from '@superset-ui/core';
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

const semanticCustomization = createChartCustomization({
  targets: [
    {
      datasetId: 7,
      datasourceType: DatasourceType.SemanticView,
      semantic_selection_version: 'cube-member-id-v1',
    },
  ],
});
const semanticTargetSource = {
  datasource: '7__semantic_view',
  version: 'cube-member-id-v1',
};
const unknownSelectionSource = { datasource: '', version: null };
const selectedMask: DataMask = { filterState: { value: ['country'] } };
const certifiedMask: DataMask = {
  ...selectedMask,
  extraFormData: { semantic_selection_sources: [semanticTargetSource] },
};

test.each<{
  name: string;
  customization?: ChartCustomizationItem;
  mask?: DataMask;
  groupByApplied: boolean;
  expected: SemanticSelectionSource[];
}>([
  {
    name: 'unapplied group-by',
    customization: semanticCustomization,
    mask: certifiedMask,
    groupByApplied: false,
    expected: [],
  },
  {
    name: 'applied certified group-by',
    customization: semanticCustomization,
    mask: certifiedMask,
    groupByApplied: true,
    expected: [semanticTargetSource, semanticTargetSource],
  },
  {
    name: 'uncertified selected group-by',
    customization: semanticCustomization,
    mask: selectedMask,
    groupByApplied: true,
    expected: [semanticTargetSource, unknownSelectionSource],
  },
  ...[
    'chart_customization_timegrain',
    'chart_customization_deckgl_layer_visibility',
  ].map(filterType => ({
    name: `presentation-only ${filterType}`,
    customization: { ...semanticCustomization, filterType },
    mask: selectedMask,
    groupByApplied: false,
    expected: [],
  })),
  {
    name: 'presentation control with member overrides',
    customization: {
      ...semanticCustomization,
      filterType: 'chart_customization_timegrain',
    },
    mask: { extraFormData: { granularity_sqla: 'country' } },
    groupByApplied: false,
    expected: [semanticTargetSource, unknownSelectionSource],
  },
  {
    name: 'idle ordinary control',
    customization: { ...semanticCustomization, filterType: 'ordinary' },
    mask: {},
    groupByApplied: false,
    expected: [],
  },
  {
    name: 'selected ordinary control without provenance',
    customization: { ...semanticCustomization, filterType: 'ordinary' },
    mask: selectedMask,
    groupByApplied: false,
    expected: [semanticTargetSource, unknownSelectionSource],
  },
  {
    name: 'legacy table target',
    customization: createChartCustomization(),
    mask: selectedMask,
    groupByApplied: true,
    expected: [
      { datasource: '3__table', version: null },
      unknownSelectionSource,
    ],
  },
  {
    name: 'missing customization and idle mask',
    groupByApplied: false,
    expected: [],
  },
  {
    name: 'missing target identity',
    customization: createChartCustomization({ targets: [] }),
    mask: selectedMask,
    groupByApplied: true,
    expected: [unknownSelectionSource, unknownSelectionSource],
  },
  {
    name: 'applied group-by without selected value',
    customization: semanticCustomization,
    groupByApplied: true,
    expected: [semanticTargetSource],
  },
])(
  'customization provenance: $name',
  ({ customization, mask, groupByApplied, expected }) => {
    expect(
      getCustomizationSelectionSources({ customization, mask, groupByApplied }),
    ).toEqual(expected);
  },
);

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

test('cross-filter time_range takes precedence over a native time range filter', () => {
  const nativeTimeFilterId = 'NATIVE_FILTER-time';
  const crossFilterId = '42';
  const nativeRange = 'Last week';
  const clickedRange = '2021-01-01T00:00:00 : 2021-01-02T00:00:00';
  const result = getFormDataWithExtraFilters({
    ...mockArgs,
    nativeFilters: {
      [nativeTimeFilterId]: {
        id: nativeTimeFilterId,
        chartsInScope: [chartId],
      },
    } as unknown as GetFormDataWithExtraFiltersArguments['nativeFilters'],
    activeFilters: {
      [nativeTimeFilterId]: {
        targets: [],
        scope: [chartId],
        values: { time_range: nativeRange },
      },
      [crossFilterId]: {
        targets: [],
        scope: [chartId],
        values: { time_range: clickedRange },
      },
    },
    dataMask: {
      [nativeTimeFilterId]: {
        id: nativeTimeFilterId,
        extraFormData: { time_range: nativeRange },
        filterState: { value: nativeRange },
        ownState: {},
      },
      [crossFilterId]: {
        id: crossFilterId,
        extraFormData: {
          filters: [{ col: 'ds', op: 'TEMPORAL_RANGE', val: clickedRange }],
          time_range: clickedRange,
        },
        filterState: { value: [clickedRange] },
        ownState: {},
      },
    },
  });

  expect(result.extra_form_data).toEqual(
    expect.objectContaining({ time_range: clickedRange }),
  );
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

test('dynamic group by replaces base groupby with the user selection (subset case)', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status'], ['status', 'category']),
  );
  expectGroupBy(result, ['status']);
});

test('timeseries chart: dynamic group by replaces base groupby with the user selection', () => {
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
  expectGroupBy(result, ['series_col']);
});

test('regression #39356: an all-conflicting selection keeps the base groupby and never empties it', () => {
  // Selecting only the x_axis (already in use) contributes no new dimension, so the
  // base groupby survives unchanged rather than the chart losing its dimensions.
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
        filterState: { value: ['time_col'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({ id: customizationId }),
    ],
  });
  expectGroupBy(result, ['series_col', 'breakdown_col']);
});

test('SC-100237: selecting base dimension + new dimension keeps BOTH in groupby', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['product_line', 'deal_size'], ['product_line']),
  );
  expectGroupBy(result, ['product_line', 'deal_size']);
  expectGroupByLength(result, 2);
});

test('dynamic group by replaces base with mixed (overlap + new) selection', () => {
  const result = getFormDataWithExtraFilters(
    makeGroupByArgs(['status', 'new_col'], ['status', 'category']),
  );
  expectGroupBy(result, ['status', 'new_col']);
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

test('chart customization does not match across datasource ID spaces', () => {
  // A customization targeting semantic_view ``3`` must not match a chart
  // backed by table ``3``: the two have independent ID spaces.
  const customizationId = 'CHART_CUSTOMIZATION-groupby-cross';
  const args: GetFormDataWithExtraFiltersArguments = {
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
        extraFormData: { time_grain_sqla: 'PT1H' },
        filterState: { value: ['status'] },
        ownState: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        targets: [
          {
            datasetId: 3,
            datasourceType: 'semantic_view' as any,
            column: { name: 'status' },
          },
        ],
      }),
    ],
  };

  // Customization is on semantic_view:3, chart is on table:3 — they
  // shouldn't be linked, so the chart's groupby is unchanged.
  const result = getFormDataWithExtraFilters(args);
  expectGroupBy(result, ['original_column']);
  expect(result).not.toHaveProperty('time_grain_sqla');
});

test.each([
  ['selected on Apply', ['Orders.status']],
  ['cleared after Clear all', null],
])(
  'hidden required semantic group-by contributes no mask or provenance when %s',
  (_, value) => {
    const customizationId = 'CHART_CUSTOMIZATION-hidden-required';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          datasource: '3__semantic_view',
          semantic_selection_version: 'cube-member-id-v1',
          groupby: ['Orders.status'],
        },
      },
      dataMask: {
        [customizationId]: {
          id: customizationId,
          filterState: { value },
          extraFormData: {
            semantic_selection_sources: [{ datasource: '', version: null }],
          },
        },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: customizationId,
          targets: [
            { datasetId: 3, datasourceType: DatasourceType.SemanticView },
          ],
          controlValues: { enableEmptyFilter: true },
        }),
      ],
    });
    expectGroupBy(result, ['Orders.status']);
    expect(result).toHaveProperty('semantic_selection_sources', []);
    expect(result).not.toHaveProperty(
      'extra_form_data.semantic_selection_sources',
    );
  },
);

test.each([false, true])(
  'saved semantic-view dynamic group-by mask does not alter the chart request (current=%s)',
  current => {
    const customizationId = 'CHART_CUSTOMIZATION-identity';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          viz_type: 'table',
          datasource: '3__semantic_view',
          groupby: ['original_column'],
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      dataMask: {
        [customizationId]: {
          id: customizationId,
          filterState: { value: ['Orders.status'] },
          // Match GroupByFilterCard's emission: it never certifies sources.
          extraFormData: {
            custom_form_data: { groupby: ['Orders.status'] },
          },
        },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: customizationId,
          targets: [
            {
              datasetId: 3,
              datasourceType: DatasourceType.SemanticView,
              semantic_selection_version: current
                ? 'cube-member-id-v1'
                : undefined,
            },
          ],
        }),
      ],
    });
    expectGroupBy(result, ['original_column']);
    expect(result).not.toHaveProperty('custom_form_data');
    expect(
      buildQueryObject({
        ...result,
        datasource: '3__semantic_view',
        viz_type: 'table',
      } as QueryFormData).extras?.semantic_selection_version,
    ).toEqual('cube-member-id-v1');
  },
);

test('a foreign dynamic-groupby customization that does not apply cannot invalidate Cube selections', () => {
  const customizationId = 'CHART_CUSTOMIZATION-foreign';
  const result = getFormDataWithExtraFilters({
    ...mockArgs,
    filters: {},
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        datasource: '3__semantic_view',
        viz_type: 'table',
        groupby: ['Orders.status'],
        semantic_selection_version: 'cube-member-id-v1',
      },
    },
    dataMask: {
      [customizationId]: {
        id: customizationId,
        filterState: { value: ['status'] },
        extraFormData: {},
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        targets: [{ datasetId: 5, datasourceType: DatasourceType.Table }],
      }),
    ],
  });
  expectGroupBy(result, ['Orders.status']);
  expect(
    buildQueryObject({
      ...result,
      datasource: '3__semantic_view',
      viz_type: 'table',
    } as QueryFormData).extras?.semantic_selection_version,
  ).toBe('cube-member-id-v1');
});

test.each([
  'chart_customization_timegrain',
  'chart_customization_deckgl_layer_visibility',
])(
  'non-member customization %s does not invalidate Cube identity',
  filterType => {
    const customizationId = 'CHART_CUSTOMIZATION-presentation';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          datasource: '3__semantic_view',
          viz_type: 'table',
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      dataMask: {
        [customizationId]: {
          id: customizationId,
          filterState: { value: ['P1D'] },
          extraFormData:
            filterType === 'chart_customization_timegrain'
              ? { time_grain_sqla: 'P1D' }
              : { visible_deckgl_layers: [1, 2] },
        },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: customizationId,
          filterType,
          targets: [],
        }),
      ],
    });
    expect(
      buildQueryObject({
        ...result,
        datasource: '3__semantic_view',
        viz_type: 'table',
      } as QueryFormData).extras?.semantic_selection_version,
    ).toBe('cube-member-id-v1');
  },
);

test.each([
  {
    datasetId: 3,
    datasourceType: DatasourceType.SemanticView,
    value: undefined,
  },
  { datasetId: 5, datasourceType: DatasourceType.Table, value: undefined },
  { datasetId: 3, datasourceType: DatasourceType.SemanticView, value: null },
  { datasetId: 5, datasourceType: DatasourceType.Table, value: null },
])(
  'idle time-column customization does not invalidate Cube identity: %j',
  ({ value, ...target }) => {
    const customizationId = 'CHART_CUSTOMIZATION-idle-time-column';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          datasource: '3__semantic_view',
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      dataMask: {
        [customizationId]: {
          id: customizationId,
          filterState: { value },
          extraFormData: {},
        },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: customizationId,
          filterType: 'chart_customization_timecolumn',
          targets: [target],
        }),
      ],
    });
    expect(
      buildQueryObject({
        ...result,
        datasource: '3__semantic_view',
        viz_type: 'table',
      } as QueryFormData).extras?.semantic_selection_version,
    ).toBe('cube-member-id-v1');
  },
);

test.each([[42], ['Orders.count'], ['']])(
  'a non-contributing customization does not add provenance: %j',
  ignoredValue => {
    const currentId = 'CHART_CUSTOMIZATION-current';
    const ignoredId = 'CHART_CUSTOMIZATION-ignored';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          datasource: '3__semantic_view',
          viz_type: 'table',
          metrics: ['Orders.count'],
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      dataMask: {
        [currentId]: {
          id: currentId,
          filterState: { value: ['Orders.status'] },
        },
        [ignoredId]: { id: ignoredId, filterState: { value: [ignoredValue] } },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: currentId,
          targets: [
            {
              datasetId: 3,
              datasourceType: DatasourceType.SemanticView,
              semantic_selection_version: 'cube-member-id-v1',
            },
          ],
        }),
        createChartCustomization({
          id: ignoredId,
          targets: [
            { datasetId: 3, datasourceType: DatasourceType.SemanticView },
          ],
        }),
      ],
    });
    expect(result).not.toHaveProperty('groupby');
    expect(result).toHaveProperty('semantic_selection_sources', []);
    expect(
      buildQueryObject({
        ...result,
        datasource: '3__semantic_view',
        viz_type: 'table',
      } as QueryFormData).extras?.semantic_selection_version,
    ).toBe('cube-member-id-v1');
  },
);

test.each([
  { semantic_selection_version: 'next-version' },
  {
    semantic_selection_sources: [
      { datasource: 'other__semantic_view', version: null },
    ],
  },
  { datasource: '8__semantic_view' },
])('cache invalidates when chart selection provenance changes: %p', change => {
  const args = {
    ...mockArgs,
    filters: {},
    chart: {
      ...mockChart,
      form_data: {
        ...mockChart.form_data,
        datasource: '7__semantic_view',
        semantic_selection_version: 'cube-member-id-v1',
        semantic_selection_sources: [],
      },
    },
  };
  const first = getFormDataWithExtraFilters(args);
  const cached = getFormDataWithExtraFilters(args);
  expect(getFormDataWithExtraFilters(args)).toBe(cached);
  const changed = getFormDataWithExtraFilters({
    ...args,
    chart: { ...args.chart, form_data: { ...args.chart.form_data, ...change } },
  });
  expect(changed).not.toBe(first);
  expect(changed).toEqual(expect.objectContaining(change));
});

test.each([
  ['saved without a marker', undefined],
  ['saved with a stale marker', 'old'],
])(
  'a grain-only time grain control %s applies to a versioned semantic chart',
  (_, version) => {
    const customizationId = 'CHART_CUSTOMIZATION-grain';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          viz_type: 'table',
          datasource: '3__semantic_view',
          groupby: ['Orders.created'],
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      dataMask: {
        [customizationId]: {
          id: customizationId,
          filterState: { value: ['P1Y'] },
          // A mask persisted by the filter bar before its value was
          // classified as selection-free still carries this stamp.
          extraFormData: {
            time_grain_sqla: 'P1Y',
            semantic_selection_sources: [
              { datasource: '3__semantic_view', version: version ?? null },
            ],
          },
        },
      },
      chartCustomizationItems: [
        createChartCustomization({
          id: customizationId,
          name: 'Time grain',
          filterType: 'chart_customization_timegrain',
          targets: [
            {
              datasetId: 3,
              datasourceType: DatasourceType.SemanticView,
              semantic_selection_version: version,
            },
          ],
        }),
      ],
    });
    const { extras } = buildQueryObject({
      ...result,
      datasource: '3__semantic_view',
      viz_type: 'table',
    } as QueryFormData);
    expect(extras?.time_grain_sqla).toEqual('P1Y');
    expect(extras?.semantic_selection_version).toEqual('cube-member-id-v1');
  },
);

const clearedMask = (id: string, version: string | null): DataMaskWithId => ({
  id,
  filterState: { value: null },
  // A cleared control persisted before its type was considered still
  // carries the stamp the filter bar added to every semantic mask.
  extraFormData: {
    semantic_selection_sources: [{ datasource: '3__semantic_view', version }],
  },
});

const versionedSemanticTable = {
  ...mockChart,
  form_data: {
    ...mockChart.form_data,
    viz_type: 'table',
    datasource: '3__semantic_view',
    groupby: ['Orders.created'],
    semantic_selection_version: 'cube-member-id-v1',
  },
};

const chartExtras = (result: CachedFormDataWithExtraControls) =>
  buildQueryObject({
    ...result,
    datasource: '3__semantic_view',
    viz_type: 'table',
  } as QueryFormData).extras;

test('a hidden semantic customization cannot change ignored-filter compatibility', () => {
  const customizationId = 'CHART_CUSTOMIZATION-hidden-compatibility';
  const args: GetFormDataWithExtraFiltersArguments = {
    ...mockArgs,
    filters: {},
    chart: versionedSemanticTable,
    dataMask: {
      [customizationId]: {
        id: customizationId,
        filterState: { value: ['US'] },
        extraFormData: {
          filters: [{ col: 'Orders.created', op: 'IN', val: ['US'] }],
        },
      },
    },
    chartCustomizationItems: [
      createChartCustomization({
        id: customizationId,
        targets: [
          { datasetId: 3, datasourceType: DatasourceType.SemanticView },
        ],
      }),
    ],
    // A stale same-id native entry must not make the hidden mask participate
    // in the ignored-filter lookup or invalidate the cached chart request.
    nativeFilters: {
      [customizationId]: {
        id: customizationId,
        filterType: 'filter_select',
        targets: [{ datasetId: 12, datasourceType: DatasourceType.Table }],
        chartsInScope: [chartId],
      },
    },
  };
  const withoutHiddenMaskArgs = {
    ...args,
    dataMask: {},
  };
  getFormDataWithExtraFilters(withoutHiddenMaskArgs);
  const withoutHiddenMask = getFormDataWithExtraFilters(withoutHiddenMaskArgs);
  const withHiddenMask = getFormDataWithExtraFilters(args);
  expect(withHiddenMask).toBe(withoutHiddenMask);
  expect(chartExtras(withHiddenMask)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test.each([null, 'old'])(
  'a cleared time grain display control (stamp %s) keeps the chart identity',
  version => {
    const id = 'CHART_CUSTOMIZATION-grain-cleared';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: versionedSemanticTable,
      dataMask: { [id]: clearedMask(id, version) },
      chartCustomizationItems: [
        createChartCustomization({
          id,
          name: 'Time grain',
          filterType: 'chart_customization_timegrain',
          targets: [
            { datasetId: 3, datasourceType: DatasourceType.SemanticView },
          ],
        }),
      ],
    });
    expect(chartExtras(result)?.semantic_selection_version).toEqual(
      'cube-member-id-v1',
    );
  },
);

test.each([
  ['filter_timegrain', 'cube-member-id-v1'],
  ['filter_select', 'unverified-external-selections'],
])(
  'a cleared native %s with an unmarked source yields %s',
  (filterType, expected) => {
    const id = `NATIVE_FILTER-${filterType}`;
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: versionedSemanticTable,
      dataMask: { [id]: clearedMask(id, null) },
      nativeFilters: {
        [id]: {
          id,
          filterType,
          chartsInScope: [chartId],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          targets: [
            {
              datasetId: 3,
              datasourceType: DatasourceType.SemanticView,
              ...(filterType === 'filter_select' && {
                column: { name: 'Orders.status' },
              }),
            },
          ],
        },
      } as unknown as GetFormDataWithExtraFiltersArguments['nativeFilters'],
    });
    expect(chartExtras(result)?.semantic_selection_version).toEqual(expected);
  },
);

test.each([
  ['no source', undefined],
  ['an unmarked source', [{ datasource: '3__semantic_view', version: null }]],
  ['a stale source', [{ datasource: '3__semantic_view', version: 'old' }]],
  [
    'a foreign source',
    [{ datasource: '4__semantic_view', version: 'cube-member-id-v1' }],
  ],
])(
  'a native grain control mixed with a member override and %s still refuses',
  (_, sources) => {
    const id = 'NATIVE_FILTER-mixed-grain';
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      filters: {},
      chart: versionedSemanticTable,
      dataMask: {
        [id]: {
          id,
          filterState: { value: ['P1Y'] },
          extraFormData: {
            time_grain_sqla: 'P1Y',
            custom_form_data: { groupby: ['Orders.status'] },
            ...(sources && { semantic_selection_sources: sources }),
          },
        },
      },
      nativeFilters: {
        [id]: {
          id,
          filterType: 'filter_timegrain',
          chartsInScope: [chartId],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          targets: [
            { datasetId: 3, datasourceType: DatasourceType.SemanticView },
          ],
        },
      } as unknown as GetFormDataWithExtraFiltersArguments['nativeFilters'],
    });
    expect(chartExtras(result)?.semantic_selection_version).toEqual(
      'unverified-external-selections',
    );
  },
);

test.each(['filter_select', 'filter_range'])(
  'SQL %s predicates do not invalidate a versioned semantic chart',
  filterType => {
    const args: GetFormDataWithExtraFiltersArguments = {
      ...mockArgs,
      filters: {},
      chart: versionedSemanticTable,
      nativeFilters: {
        sql: {
          id: 'sql',
          filterType,
          targets: [{ datasetId: 12, datasourceType: DatasourceType.Table }],
          chartsInScope: [chartId],
        },
      },
      dataMask: {
        sql: {
          id: 'sql',
          filterState: { value: ['US'] },
          extraFormData: {
            filters: [
              filterType === 'filter_range'
                ? { col: 'Orders.created', op: '>=', val: 5 }
                : { col: 'Orders.created', op: 'IN', val: ['US'] },
            ],
          },
        },
      },
    };
    const result = getFormDataWithExtraFilters(args);
    expect(result.extra_form_data?.filters ?? []).toEqual([]);
    expect(chartExtras(result)?.semantic_selection_version).toBe(
      'cube-member-id-v1',
    );
  },
);

function externalPredicateArgs(): GetFormDataWithExtraFiltersArguments {
  return {
    ...mockArgs,
    filters: {},
    chart: versionedSemanticTable,
    chartConfiguration: {
      42: {
        id: 42,
        crossFilters: { scope: 'global', chartsInScope: [chartId] },
      },
    },
    sourceDatasources: { 42: '12__table' },
    nativeFilters: {},
    dataMask: {
      42: {
        id: '42',
        filterState: { value: ['US'] },
        extraFormData: {
          filters: [{ col: 'Orders.created', op: 'IN', val: ['US'] }],
        },
      },
    },
  };
}

test('SQL cross-filter is skipped even when its column matches a semantic member', () => {
  const result = getFormDataWithExtraFilters(externalPredicateArgs());
  expect(result.extra_form_data?.filters ?? []).toEqual([]);
  expect(chartExtras(result)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test('changing a source chart invalidates cached compatibility', () => {
  const args = externalPredicateArgs();
  const sql = getFormDataWithExtraFilters(args);
  const unknown = getFormDataWithExtraFilters({
    ...args,
    sourceDatasources: {},
  });
  expect(unknown).not.toBe(sql);
  expect(chartExtras(unknown)?.semantic_selection_version).toBe(
    'unverified-external-selections',
  );
});

test('SQL native selection, Clear all and reselect keep chart identity', () => {
  const args = externalPredicateArgs();
  args.nativeFilters = {
    42: {
      id: '42',
      filterType: 'filter_select',
      targets: [{ datasetId: 12 }],
      chartsInScope: [chartId],
    },
  };
  const selected = getFormDataWithExtraFilters(args);
  expect(selected.extra_form_data?.filters ?? []).toEqual([]);
  expect(chartExtras(selected)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
  const clear = getFormDataWithExtraFilters({
    ...args,
    dataMask: {
      42: { id: '42', extraFormData: {}, filterState: { value: null } },
    },
  });
  expect(clear.extra_form_data?.filters ?? []).toEqual([]);
  expect(
    chartExtras(getFormDataWithExtraFilters(args))?.semantic_selection_version,
  ).toBe('cube-member-id-v1');
});

test.each(['unknown', 'foreign semantic', 'semantic mask on SQL source'])(
  '%s cross-filter retains the identity refusal',
  kind => {
    const args = externalPredicateArgs();
    if (kind === 'unknown') args.sourceDatasources = {};
    if (kind === 'foreign semantic')
      args.sourceDatasources = {
        42: '9__semantic_view',
      };
    if (kind === 'semantic mask on SQL source') {
      args.dataMask[42].extraFormData!.semantic_selection_sources = [
        { datasource: '9__semantic_view', version: 'cube-member-id-v1' },
      ];
    }
    expect(
      chartExtras(getFormDataWithExtraFilters(args))
        ?.semantic_selection_version,
    ).toBe('unverified-external-selections');
  },
);

test.each(['filter_select', 'filter_range'])(
  'foreign semantic native %s without provenance stays refused',
  filterType => {
    const args = externalPredicateArgs();
    args.nativeFilters = {
      42: {
        id: '42',
        filterType,
        targets: [
          { datasetId: 9, datasourceType: DatasourceType.SemanticView },
        ],
        chartsInScope: [chartId],
      },
    };
    expect(
      chartExtras(getFormDataWithExtraFilters(args))
        ?.semantic_selection_version,
    ).toBe('unverified-external-selections');
  },
);

test('a SQL time column override remains refused, not silently removed', () => {
  const args = externalPredicateArgs();
  args.dataMask[42].extraFormData = { granularity_sqla: 'created_at' };
  expect(
    chartExtras(getFormDataWithExtraFilters(args))?.semantic_selection_version,
  ).toBe('unverified-external-selections');
});

test('SQL receiving charts still receive SQL cross-filters', () => {
  const args = externalPredicateArgs();
  args.chart = {
    ...versionedSemanticTable,
    form_data: { ...versionedSemanticTable.form_data, datasource: '13__table' },
  };
  expect(getFormDataWithExtraFilters(args).extra_form_data?.filters).toEqual(
    args.dataMask[42].extraFormData?.filters,
  );
});

test('required SQL Value match-nothing mask is omitted without invalidating identity', () => {
  const args = externalPredicateArgs();
  args.nativeFilters = {
    42: {
      id: '42',
      filterType: 'filter_select',
      targets: [{ datasetId: 12 }],
      chartsInScope: [chartId],
    },
  };
  args.dataMask[42].extraFormData = getSelectExtraFormData('country', [], true);
  const result = getFormDataWithExtraFilters(args);
  expect(result.extra_form_data?.adhoc_filters ?? []).toEqual([]);
  expect(chartExtras(result)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test('same-view cross-filter remains applied with current identity', () => {
  const args = externalPredicateArgs();
  args.sourceDatasources = { 42: '3__semantic_view' };
  args.dataMask[42].extraFormData!.semantic_selection_sources = [
    { datasource: '3__semantic_view', version: 'cube-member-id-v1' },
  ];
  const result = getFormDataWithExtraFilters(args);
  expect(result.extra_form_data?.filters).toEqual(
    args.dataMask[42].extraFormData?.filters,
  );
  expect(chartExtras(result)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test.each(
  [
    { sourceId: 3, receiverId: 9 },
    { sourceId: 9, receiverId: 3 },
  ].flatMap(pair =>
    ['cross-filter', 'filter_select', 'filter_range'].flatMap(origin =>
      ['selected', 'cleared', 'cleared-empty-filters'].map(state => ({
        ...pair,
        origin,
        state,
      })),
    ),
  ),
)(
  'foreign-view selections and clears preserve receiver identity: %j',
  ({ sourceId, receiverId, origin, state }) => {
    const args = externalPredicateArgs();
    const version = 'snowflake-table-qualified-v1';
    args.chart = {
      ...versionedSemanticTable,
      form_data: {
        ...versionedSemanticTable.form_data,
        datasource: `${receiverId}__semantic_view`,
        semantic_selection_version: version,
      },
    };
    args.sourceDatasources = { 42: `${sourceId}__semantic_view` };
    if (origin !== 'cross-filter')
      args.nativeFilters = {
        42: {
          id: '42',
          filterType: origin,
          targets: [
            {
              datasetId: sourceId,
              datasourceType: DatasourceType.SemanticView,
              semantic_selection_version: version,
            },
          ],
          chartsInScope: [chartId],
        },
      };
    args.dataMask[42].extraFormData = {
      filters: [{ col: 'C.MARKET_SEGMENT', op: 'IN', val: ['BUILDING'] }],
      semantic_selection_sources: [
        { datasource: `${sourceId}__semantic_view`, version },
      ],
    };
    if (state !== 'selected') {
      args.dataMask[42].filterState = { value: null };
      if (state === 'cleared-empty-filters') {
        args.dataMask[42].extraFormData.filters = [];
      } else {
        delete args.dataMask[42].extraFormData.filters;
      }
    }
    const result = getFormDataWithExtraFilters(args);
    expect(result.extra_form_data?.filters ?? []).toEqual([]);
    expect(result.extra_form_data?.semantic_selection_sources ?? []).toEqual(
      [],
    );
    expect(
      buildQueryObject({
        datasource: `${receiverId}__semantic_view`,
        viz_type: 'table',
        semantic_selection_version: version,
        extra_form_data: result.extra_form_data,
      }).extras?.semantic_selection_version,
    ).toBe(version);
  },
);

test.each(['cube-member-id-v1', 'old'])(
  'same-view cross-filter version %s retains its original validation',
  version => {
    const args = externalPredicateArgs();
    args.sourceDatasources = { 42: '3__semantic_view' };
    args.dataMask[42].extraFormData!.semantic_selection_sources = [
      { datasource: '3__semantic_view', version },
    ];
    const result = getFormDataWithExtraFilters(args);
    expect(result.extra_form_data?.filters).toEqual(
      args.dataMask[42].extraFormData?.filters,
    );
    expect(chartExtras(result)?.semantic_selection_version).toBe(
      version === 'old' ? 'unverified-external-selections' : version,
    );
  },
);

test('foreign provenance reclassification invalidates request cache and clear removes its mask', () => {
  const args = externalPredicateArgs();
  args.sourceDatasources = { 42: '9__semantic_view' };
  args.dataMask[42].extraFormData!.semantic_selection_sources = [
    { datasource: '9__semantic_view', version: 'cube-member-id-v1' },
  ];
  const skipped = getFormDataWithExtraFilters(args);
  expect(skipped.extra_form_data?.filters ?? []).toEqual([]);
  const unknown = getFormDataWithExtraFilters({
    ...args,
    sourceDatasources: {},
  });
  expect(chartExtras(unknown)?.semantic_selection_version).toBe(
    'unverified-external-selections',
  );
  const cleared = getFormDataWithExtraFilters({
    ...args,
    dataMask: {
      42: { id: '42', extraFormData: {}, filterState: { value: null } },
    },
  });
  expect(cleared.extra_form_data?.filters ?? []).toEqual([]);
  expect(chartExtras(cleared)?.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test.each(['cube-member-id-v1', 'old'])(
  'same-view cleared stamp with version %s reaches query validation unchanged',
  version => {
    const args = externalPredicateArgs();
    args.sourceDatasources = { 42: '3__semantic_view' };
    const extraFormData = {
      semantic_selection_sources: [{ datasource: '3__semantic_view', version }],
    };
    args.dataMask[42] = {
      id: '42',
      filterState: { value: null },
      extraFormData,
    };
    const result = getFormDataWithExtraFilters(args);
    expect(result.extra_form_data?.semantic_selection_sources).toEqual(
      extraFormData.semantic_selection_sources,
    );
    expect(chartExtras(result)?.semantic_selection_version).toBe(
      version === 'old' ? 'unverified-external-selections' : version,
    );
  },
);
