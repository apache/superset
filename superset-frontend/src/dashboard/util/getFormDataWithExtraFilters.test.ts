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
import { sliceId as chartId } from 'spec/fixtures/mockChartQueries';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('getFormDataWithExtraFilters', () => {
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
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
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
        },
      ],
    };

    const result = getFormDataWithExtraFilters(argsWithCustomization);
    expect((result as any).time_grain_sqla).toEqual('PT1H');
  });

  test('should merge both filters and customization extraFormData', () => {
    const customizationId = 'CHART_CUSTOMIZATION-1';
    const argsWithBoth: GetFormDataWithExtraFiltersArguments = {
      ...mockArgs,
      chartConfiguration: {
        [filterId]: {
          id: filterId,
          targets: [
            {
              datasetId: 123,
              column: { name: 'country_name' },
            },
          ],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
          cascadeParentIds: [],
        },
      } as any,
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
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
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
        },
      ],
    };

    const result = getFormDataWithExtraFilters(argsWithBoth);
    expect((result as any).time_grain_sqla).toEqual('PT1H');
    expect(result.extra_form_data).toBeDefined();
  });

  // Regression tests for Dynamic Group By display control bugs

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
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
          name: 'Dynamic Group By',
          filterType: 'chart_customization_dynamic_groupby',
          targets: [{ datasetId: 3, column: { name: 'status' } }],
          scope: { rootPath: [], excluded: [] },
          chartsInScope: [chartId],
          defaultDataMask: {},
          controlValues: {},
        },
      ],
    };
  };

  test('dynamic group by does not inject a filter using the selected column name as a value', () => {
    // Selecting a column should replace groupby, never add a WHERE IN filter
    // using the column NAME as the filter VALUE (e.g. WHERE status IN ('status'))
    const result = getFormDataWithExtraFilters(makeGroupByArgs(['status']));
    const spuriousFilter = (result as any).filters?.find(
      (f: any) =>
        f.col === 'status' && Array.isArray(f.val) && f.val.includes('status'),
    );
    expect(spuriousFilter).toBeUndefined();
    expect(result.groupby).toEqual(['status']);
  });

  test('dynamic group by still applies when the selected column is already in the base groupby', () => {
    // Previously, nonConflictingColumns guard blocked columns already in chart's base groupby
    const result = getFormDataWithExtraFilters(
      makeGroupByArgs(['status'], ['status']),
    );
    expect(result.groupby).toEqual(['status']);
  });

  test('chord chart does not duplicate a selected column that already exists in the base groupby', () => {
    const result = getFormDataWithExtraFilters({
      ...makeGroupByArgs(['status'], ['status']),
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

    expect(result.groupby).toEqual(['status']);
  });

  test('dynamic group by normalizes a single-select string value into a one-item groupby array', () => {
    // filterState.value is a string (not array) in single-select mode
    const result = getFormDataWithExtraFilters(makeGroupByArgs('status'));
    expect(result.groupby).toEqual(['status']);
  });

  test('structural conflict: metric column blocks groupby override (nonConflictingColumns guard)', () => {
    // When a user selects a column that already serves as a metric, it is in
    // existingColumns (buildExistingColumnsSet includes metric column names).
    // nonConflictingColumns becomes empty → early-return → groupby unchanged.
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
          // User selected 'revenue', but 'revenue' is already in metrics →
          // structural conflict → nonConflictingColumns = [] → early-return.
          filterState: { value: ['revenue'] },
          ownState: {},
        },
      },
      chartCustomizationItems: [
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
          name: 'Dynamic Group By',
          filterType: 'chart_customization_dynamic_groupby',
          targets: [{ datasetId: 3, column: { name: 'revenue' } }],
          scope: { rootPath: [], excluded: [] },
          chartsInScope: [chartId],
          defaultDataMask: {},
          controlValues: {},
        },
      ],
    };

    const result = getFormDataWithExtraFilters(argsWithMetricConflict);
    // Revenue is in existingColumns (metrics), so no override is applied.
    expect(result.groupby).toEqual(['original_column']);
  });

  test('multi-column selection: all selected columns appear in result groupby', () => {
    // Selecting multiple columns via the Dynamic Group By control should
    // add all non-conflicting columns to groupby.
    const result = getFormDataWithExtraFilters(
      makeGroupByArgs(['status', 'product_line']),
    );
    expect(result.groupby).toEqual(
      expect.arrayContaining(['status', 'product_line']),
    );
    expect(result.groupby).toHaveLength(2);
  });

  test('dataset mismatch: display control for a different dataset does not affect the chart', () => {
    // When the customization's target datasetId does not match the chart's
    // datasource ID, processGroupByCustomizations must return {} and leave
    // the chart's groupby unchanged.
    const customizationId = 'CHART_CUSTOMIZATION-wrong-dataset';
    const argsWrongDataset: GetFormDataWithExtraFiltersArguments = {
      ...mockArgs,
      chart: {
        ...mockChart,
        form_data: {
          ...mockChart.form_data,
          viz_type: 'table',
          datasource: '3__table', // chart uses dataset 3
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
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
          name: 'Dynamic Group By',
          filterType: 'chart_customization_dynamic_groupby',
          targets: [{ datasetId: 999, column: { name: 'status' } }], // wrong dataset
          scope: { rootPath: [], excluded: [] },
          chartsInScope: [chartId],
          defaultDataMask: {},
          controlValues: {},
        },
      ],
    };

    const result = getFormDataWithExtraFilters(argsWrongDataset);
    expect(result.groupby).toEqual(['original_column']);
  });

  test('Scope boundary: display control with chartsInScope:[] does not affect the chart', () => {
    // When calculateScopes returns chartsInScope:[] (e.g. because a legacy
    // display control lacks a `scope` field), setInScopeStatusOfCustomizations
    // writes [] back to nativeFilters.  The chart should not be modified.
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
        {
          id: customizationId,
          type: 'CHART_CUSTOMIZATION' as any,
          name: 'Out Of Scope Group By',
          filterType: 'chart_customization_dynamic_groupby',
          targets: [{ datasetId: 3, column: { name: 'status' } }],
          scope: { rootPath: [], excluded: [] },
          // Empty array means "no charts in scope" — must NOT apply.
          chartsInScope: [],
          defaultDataMask: {},
          controlValues: {},
        },
      ],
    };

    const result = getFormDataWithExtraFilters(argsOutOfScope);
    // groupby must stay unchanged when the chart is outside scope
    expect(result.groupby).toEqual(['original_column']);
  });
});
