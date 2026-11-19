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
  buildQueryContext,
  DatasourceType,
  ensureIsArray,
  getChartControlPanelRegistry,
  isBinaryAdhocFilter,
  isFeatureEnabled,
  isSimpleAdhocFilter,
  NO_TIME_RANGE,
  QueryFormData,
  VizType,
} from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import { ExplorePageState } from '../types';
import exploreReducer, { ExploreState } from '../reducers/exploreReducer';
import { getFormDataFromControls } from '../controlUtils';
import { setStashFormData } from './exploreActions';
import { HYDRATE_CHART_NORMALIZATION } from 'src/features/versionHistory/reducer';
import {
  hydrateExplore,
  HydrateExplore,
  HYDRATE_EXPLORE,
} from './hydrateExplore';
import { exploreInitialData } from '../fixtures';
import tableControlPanel from '../../../plugins/plugin-chart-table/src/controlPanel';
import calendarControlPanel from '../../../plugins/plugin-chart-calendar/src/controlPanel';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeEach(() => mockedIsFeatureEnabled.mockReturnValue(false));

afterEach(() => {
  window.history.pushState({}, '', '/');
});

// `hiddenFormData` seeds the replaced state's stash, so reintroducing a stash
// guard in hydrateExplore fails the stamp tests that pass one.
function hydrateNewSemanticChart(
  extraFormData: Partial<QueryFormData> = {},
  hiddenFormData: Partial<QueryFormData> = {},
  type = DatasourceType.SemanticView,
) {
  const dispatch = jest.fn();
  const getState = () =>
    ({
      user: {},
      charts: {},
      datasources: {},
      common: { conf: {} },
      explore: { hiddenFormData },
    }) as ExplorePageState;
  hydrateExplore({
    ...exploreInitialData,
    slice: null,
    form_data: {
      adhoc_filters: [],
      applied_time_extras: {},
      datasource: `4__${type}`,
      url_params: {
        datasource_id: '4',
        datasource_type: type,
        viz_type: 'table',
      },
      ...extraFormData,
      // The API omits viz_type; hydration supplies it before query construction.
    } as QueryFormData,
    dataset: {
      ...exploreInitialData.dataset,
      id: 4,
      type,
      semantic_selection_version: 'cube-member-id-v1',
    },
  })(dispatch, getState);
  return dispatch.mock.calls[0][0] as import('./hydrateExplore').HydrateExplore;
}

test('real new semantic chart payload stamps controls and built query extras', () => {
  const action = hydrateNewSemanticChart();
  const { explore, charts } = action.data;
  expect(explore.form_data.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
  expect(explore.controls.semantic_selection_version.value).toBe(
    'cube-member-id-v1',
  );
  const queryFormData = Object.values(charts)[0].latestQueryFormData!;
  expect(queryFormData.datasource).toBe('4__semantic_view');
  expect(queryFormData.viz_type).toBe(VizType.Table);
  expect(queryFormData.semantic_selection_version).toBe('cube-member-id-v1');
  expect(
    // ChartState permits partial form data; hydration supplies identity above.
    buildQueryContext(queryFormData as QueryFormData).queries[0].extras
      ?.semantic_selection_version,
  ).toBe('cube-member-id-v1');
});

test.each<Record<string, string>>([
  {},
  {
    datasource_id: '4',
    datasource_type: 'semantic_view',
    viz_type: 'table',
    slice_id: '9',
    form_data_key: 'cached-navigation',
  },
])('permits only string-valued navigation identities: %j', url_params => {
  expect(
    hydrateNewSemanticChart({ url_params }).data.explore.form_data
      .semantic_selection_version,
  ).toBe('cube-member-id-v1');
});

test.each([
  { slice_id: 9 },
  { metrics: ['old'] },
  { metrics: [] },
  { groupby: ['old'] },
  { x_axis: 'old' },
  { all_columns: ['old'] },
  { adhoc_filters: [{ subject: 'old' }] },
  { applied_time_extras: { __time_col: 'old' } },
  { url_params: { groupby: 'old' } },
  { url_params: { datasource_id: { column: 'old' } } },
  { url_params: [] },
  { url_params: null },
  { applied_time_extras: [] },
  { applied_time_extras: null },
  { adhoc_filters: {} },
  { column_config: { old: {} } },
  { plugin_field: 'old' },
  { semantic_selection_version: 'old' },
])('does not certify non-identity incoming form data: %j', extra => {
  const action = hydrateNewSemanticChart(extra as Partial<QueryFormData>);
  expect(action.data.explore.form_data.semantic_selection_version).toBe(
    'semantic_selection_version' in extra ? 'old' : undefined,
  );
});

test('ignores hidden selections of the replaced state but not a non-semantic dataset', () => {
  // HYDRATE_EXPLORE discards the earlier state's stash, so it cannot reach the
  // new chart; only the incoming form data decides whether a chart is new.
  const action = hydrateNewSemanticChart({}, { metrics: ['old'] });
  expect(action.data.explore.form_data.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
  expect(action.data.explore.form_data.metrics).toBeUndefined();
  expect(action.data.explore.hiddenFormData).toBeUndefined();
  expect(
    hydrateNewSemanticChart({}, {}, DatasourceType.Table).data.explore.form_data
      .semantic_selection_version,
  ).toBeUndefined();
});

test.each([
  { metrics: ['old'] },
  { groupby: ['old'] },
  { adhoc_filters: [{ subject: 'old' }] },
  { slice_id: 9 },
  { url_params: { dashboard_id: '7', groupby: 'old' } },
  { url_params: { dashboard_id: 7 } },
])(
  'still refuses selections or chart identity despite a stash and dashboard_id: %j',
  extra => {
    const action = hydrateNewSemanticChart(
      {
        url_params: {
          datasource_id: '4',
          datasource_type: 'semantic_view',
          dashboard_id: '7',
        },
        ...extra,
      } as Partial<QueryFormData>,
      { all_columns: [] },
    );
    expect(
      action.data.explore.form_data.semantic_selection_version,
    ).toBeUndefined();
  },
);

test('does not stamp a chart opened with a saved-chart URL identity', () => {
  window.history.pushState({}, '', '/explore/?slice_id=9');
  expect(
    hydrateNewSemanticChart().data.explore.form_data.semantic_selection_version,
  ).toBeUndefined();
});

test('datasource switches continue to invalidate the selection version', () => {
  const initial = hydrateNewSemanticChart().data.explore;
  const changed = exploreReducer(
    {
      form_data: initial.form_data,
      controls: initial.controls,
      datasource: initial.datasource,
    },
    {
      type: 'UPDATE_FORM_DATA_BY_DATASOURCE',
      prevDatasource: initial.datasource,
      newDatasource: {
        ...initial.datasource,
        id: 10,
        uid: '10__semantic_view',
        semantic_selection_version: 'other',
      },
    },
  );
  expect(changed.form_data.semantic_selection_version).toBeUndefined();
});

test('creates hydrate action from initial data', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  // ignore type check - we dont need exact explore state for this test
  // @ts-expect-error
  hydrateExplore(exploreInitialData)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        charts: expect.objectContaining({
          371: expect.objectContaining({
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            sliceFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          }),
        }),
        datasources: expect.objectContaining({
          '8__table': expect.anything(),
        }),
        saveModal: expect.objectContaining({
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        }),
        explore: expect.objectContaining({
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: expect.anything(),
          controls: expect.any(Object),
          form_data: expect.anything(),
          slice: expect.anything(),
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        }),
      }),
    }),
  );
});

test('creates hydrate action with existing state', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: { controlsTransferred: ['all_columns'] },
  }));
  // ignore type check - we dont need exact explore state for this test
  // @ts-expect-error
  hydrateExplore(exploreInitialData)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        charts: expect.objectContaining({
          371: expect.objectContaining({
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            sliceFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          }),
        }),
        datasources: expect.objectContaining({
          '8__table': expect.anything(),
        }),
        saveModal: expect.objectContaining({
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        }),
        explore: expect.objectContaining({
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: expect.anything(),
          controls: expect.any(Object),
          controlsTransferred: ['all_columns'],
          form_data: expect.anything(),
          slice: expect.anything(),
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        }),
      }),
    }),
  );
});

test('hydrates sliceName from preview form data before saved slice name', () => {
  window.history.pushState({}, '', '/explore/?form_data_key=preview-key');

  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  const previewSliceName = 'RENAMED - Bug Evidence';
  const savedSliceName = 'Most Populated Countries';
  const previewInitialData = {
    ...exploreInitialData,
    form_data: {
      ...exploreInitialData.form_data,
      slice_name: previewSliceName,
    },
    slice: {
      ...exploreInitialData.slice!,
      slice_name: savedSliceName,
    },
  };

  // @ts-expect-error we only need the fields consumed by hydrateExplore
  hydrateExplore(previewInitialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        explore: expect.objectContaining({
          sliceName: previewSliceName,
        }),
      }),
    }),
  );
});

test('hydrates sliceName from saved slice when regular form data has stale name', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  const staleFormDataSliceName = 'Stale Params Name';
  const savedSliceName = 'Current Saved Name';
  const savedChartInitialData = {
    ...exploreInitialData,
    form_data: {
      ...exploreInitialData.form_data,
      slice_name: staleFormDataSliceName,
    },
    slice: {
      ...exploreInitialData.slice!,
      slice_name: savedSliceName,
    },
  };

  // @ts-expect-error we only need the fields consumed by hydrateExplore
  hydrateExplore(savedChartInitialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        explore: expect.objectContaining({
          sliceName: savedSliceName,
        }),
      }),
    }),
  );
});

test('uses configured default time range if not set', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {
      conf: {
        DEFAULT_TIME_FILTER: 'Last year',
      },
    },
    explore: {},
  }));
  // @ts-expect-error
  hydrateExplore({ form_data: {}, slice: {}, dataset: {} })(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        explore: expect.objectContaining({
          form_data: expect.objectContaining({
            time_range: 'Last year',
          }),
        }),
      }),
    }),
  );
  const withTimeRangeSet = {
    form_data: { time_range: 'Last day' },
    slice: {},
    dataset: {},
  };
  // @ts-expect-error
  hydrateExplore(withTimeRangeSet)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        explore: expect.objectContaining({
          form_data: expect.objectContaining({
            time_range: 'Last day',
          }),
        }),
      }),
    }),
  );
});

const instanceRange = 'Last year';
const datasetRange = 'Last day';
const datasetExtra = JSON.stringify({
  default_time_range: datasetRange,
  warning_markdown: 'Note',
});

// Table uses ad hoc time filters; the calendar uses a Time range control.
// They are registered only while `run` runs so other tests keep their state.
function withControlPanels<T>(run: () => T): T {
  const registry = getChartControlPanelRegistry();
  registry.registerValue(VizType.Table, tableControlPanel);
  registry.registerValue('cal_heatmap', calendarControlPanel);
  try {
    return run();
  } finally {
    registry.remove(VizType.Table);
    registry.remove('cal_heatmap');
  }
}

type NewChartOptions = {
  vizType?: string;
  extra?: string;
  formData?: Partial<QueryFormData>;
  slice?: typeof exploreInitialData.slice;
  dataset?: Partial<typeof exploreInitialData.dataset>;
};

// Hydrates a new chart on a dataset whose default datetime column is not its
// first temporal column. Call it inside `withControlPanels`.
function hydrateNewChart({
  vizType = VizType.Table,
  extra = datasetExtra,
  formData = {},
  slice = null,
  dataset = {},
}: NewChartOptions = {}): HydrateExplore['data'] {
  const dispatch = jest.fn();
  hydrateExplore({
    ...exploreInitialData,
    dataset: {
      ...exploreInitialData.dataset,
      columns: [
        { column_name: 'ingested_at', is_dttm: true },
        { column_name: 'created_at', is_dttm: true },
      ],
      main_dttm_col: 'created_at',
      extra,
      ...dataset,
    },
    form_data: {
      datasource: '8__table',
      viz_type: vizType,
      adhoc_filters: [],
      ...formData,
    },
    slice,
  })(
    dispatch,
    () =>
      ({
        user: {},
        charts: {},
        datasources: {},
        common: { conf: { DEFAULT_TIME_FILTER: instanceRange } },
        explore: {},
      }) as unknown as ExplorePageState,
  );
  return dispatch.mock.calls[0][0].data;
}

// Returns the form data of the first query of a new chart.
function hydrateNewChartQuery(options?: NewChartOptions): QueryFormData {
  const { charts } = withControlPanels(() => hydrateNewChart(options));
  return Object.values(charts)[0].latestQueryFormData as QueryFormData;
}

// Returns [column, range] from either an ad hoc filter or the Time range control.
function getTimeFilter(formData: QueryFormData) {
  const filter = ensureIsArray(formData.adhoc_filters)
    .filter(isSimpleAdhocFilter)
    .filter(isBinaryAdhocFilter)
    .find(adhocFilter => adhocFilter.operator === 'TEMPORAL_RANGE');
  return filter
    ? [filter.subject, filter.comparator]
    : [formData.granularity_sqla, formData.time_range];
}

test.each([
  [VizType.Table, datasetExtra, datasetRange],
  ['cal_heatmap', datasetExtra, datasetRange],
  [VizType.Table, `{"default_time_range": "${NO_TIME_RANGE}"}`, NO_TIME_RANGE],
  ['cal_heatmap', `{"default_time_range": "${NO_TIME_RANGE}"}`, NO_TIME_RANGE],
  [VizType.Table, '{}', instanceRange],
  ['cal_heatmap', '{}', instanceRange],
  [VizType.Table, '{bad', instanceRange],
])(
  'a new %s chart on a dataset with extra %s starts with %s on the default datetime column',
  (vizType, extra, range) => {
    expect(getTimeFilter(hydrateNewChartQuery({ vizType, extra }))).toEqual([
      'created_at',
      range,
    ]);
  },
);

test.each([VizType.Table, 'cal_heatmap'])(
  'a range supplied to a new %s chart wins over the dataset default',
  vizType => {
    const query = hydrateNewChartQuery({
      vizType,
      formData: { time_range: NO_TIME_RANGE },
    });
    expect(getTimeFilter(query)).toEqual(['created_at', NO_TIME_RANGE]);
  },
);

test('an ad hoc time filter supplied to a new chart is its only time filter', () => {
  const filter = {
    expressionType: 'SIMPLE',
    clause: 'WHERE',
    subject: 'ingested_at',
    operator: 'TEMPORAL_RANGE',
    comparator: 'Last week',
  } as const;
  const query = hydrateNewChartQuery({ formData: { adhoc_filters: [filter] } });
  expect(query.adhoc_filters).toEqual([expect.objectContaining(filter)]);
});

test('a saved chart ignores the dataset default time range', () => {
  const query = hydrateNewChartQuery({
    vizType: 'cal_heatmap',
    slice: exploreInitialData.slice,
  });
  expect(query.time_range).toBe(instanceRange);
});

test('a dataset without temporal columns adds no default time filter', () => {
  const query = hydrateNewChartQuery({
    dataset: { columns: [], main_dttm_col: '' },
  });
  expect(query.adhoc_filters).toEqual([]);
});

// Switches a new table chart, which starts with the instance range on
// `created_at`, to another dataset and returns the chart's time filter.
function switchNewChartDataset(dataset: Partial<Dataset>) {
  return withControlPanels(() => {
    const { explore } = hydrateNewChart({ extra: '{}' });
    const { controls } = exploreReducer(explore as ExploreState, {
      type: 'UPDATE_FORM_DATA_BY_DATASOURCE',
      prevDatasource: explore.datasource,
      newDatasource: {
        ...explore.datasource,
        id: 9,
        uid: '9__table',
        ...dataset,
      },
    });
    return getTimeFilter(getFormDataFromControls(controls));
  });
}

test.each([
  [datasetExtra, datasetRange],
  ['{}', instanceRange],
])(
  'switching to a dataset with extra %s re-creates a dropped time filter with %s',
  (extra, range) => {
    const timeFilter = switchNewChartDataset({
      columns: [{ column_name: 'event_date', is_dttm: true }],
      main_dttm_col: 'event_date',
      extra,
    });
    expect(timeFilter).toEqual(['event_date', range]);
  },
);

test('switching to a dataset keeps a time filter that carries over', () => {
  expect(switchNewChartDataset({ extra: datasetExtra })).toEqual([
    'created_at',
    instanceRange,
  ]);
});

test('extracts currency formats from metrics in dataset', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));

  const datasetWithMetrics = {
    ...exploreInitialData.dataset,
    metrics: [
      {
        metric_name: 'count',
        currency: { symbol: 'GBP', symbolPosition: 'prefix' },
      },
      {
        metric_name: 'revenue',
        currency: { symbol: 'USD', symbolPosition: 'suffix' },
      },
      { metric_name: 'no_currency' },
    ],
  };

  // @ts-expect-error
  hydrateExplore({ ...exploreInitialData, dataset: datasetWithMetrics })(
    dispatch,
    // @ts-expect-error
    getState,
  );

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        datasources: expect.objectContaining({
          '8__table': expect.objectContaining({
            currency_formats: {
              count: { symbol: 'GBP', symbolPosition: 'prefix' },
              revenue: { symbol: 'USD', symbolPosition: 'suffix' },
            },
          }),
        }),
      }),
    }),
  );
});

test('seeds only guarded matching-input hydration transitions', () => {
  mockedIsFeatureEnabled.mockReturnValue(true);
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: { conf: { DEFAULT_TIME_FILTER: 'Last year' } },
    explore: {},
  }));
  const persisted = {
    ...exploreInitialData.form_data,
  };
  delete persisted.time_range;
  const initialData = {
    ...exploreInitialData,
    form_data: { ...persisted },
    slice: {
      ...exploreInitialData.slice!,
      form_data: { ...persisted },
    },
  };

  // @ts-expect-error focused hydration fixture
  hydrateExplore(initialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_CHART_NORMALIZATION,
      tracking: expect.objectContaining({
        chartId: 371,
        transitions: expect.objectContaining({
          time_range: {
            control: 'time_range',
            from_present: false,
            to_present: true,
            to_value: 'Last year',
          },
        }),
      }),
    }),
  );
});

test('does not seed normalization metadata for dashboard overrides', () => {
  mockedIsFeatureEnabled.mockReturnValue(true);
  window.history.pushState({}, '', '/explore/?dashboard_id=12');
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));

  // @ts-expect-error focused hydration fixture
  hydrateExplore(exploreInitialData)(dispatch, getState);

  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: HYDRATE_CHART_NORMALIZATION }),
  );
});

test('stamps a new semantic chart after an earlier Explore session stashed hidden controls', () => {
  // Earlier in the same SPA session a saved aggregate-mode table chart was open.
  // Its raw-mode controls are invisible, so StashFormDataContainer stashed them.
  const savedTable = exploreReducer(
    { controls: {}, form_data: {} as QueryFormData },
    {
      type: HYDRATE_EXPLORE,
      data: {
        explore: {
          controls: {},
          form_data: {
            datasource: '1__table',
            viz_type: 'table',
            query_mode: 'aggregate',
            all_columns: [],
            order_by_cols: [],
          } as unknown as QueryFormData,
        },
      },
    } as never,
  );
  const leftover = exploreReducer(
    savedTable,
    setStashFormData(true, ['all_columns', 'order_by_cols']) as never,
  );
  expect(Object.keys(leftover.hiddenFormData ?? {})).toEqual([
    'all_columns',
    'order_by_cols',
  ]);

  // The user then opens a semantic view from the list. HYDRATE_EXPLORE replaces
  // explore state, so nothing from the table chart reaches the new chart.
  const action = hydrateNewSemanticChart({}, leftover.hiddenFormData);
  expect(action.data.explore.hiddenFormData).toBeUndefined();
  expect(
    exploreReducer(leftover, action as never).hiddenFormData,
  ).toBeUndefined();
  expect(action.data.explore.form_data.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});

test('stamps a new semantic chart created from a dashboard (+ Chart with dashboard_id)', () => {
  // ChartCreation: /explore/?viz_type=table&datasource=4__semantic_view&dashboard_id=7
  const action = hydrateNewSemanticChart({
    url_params: {
      viz_type: 'table',
      datasource_id: '4',
      datasource_type: 'semantic_view',
      dashboard_id: '7',
    },
  });
  expect(action.data.explore.form_data.semantic_selection_version).toBe(
    'cube-member-id-v1',
  );
});
