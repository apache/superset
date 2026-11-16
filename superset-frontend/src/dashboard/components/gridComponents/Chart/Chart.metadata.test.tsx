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
import { ChartCustomizationPlugins } from 'src/constants';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import reducerIndex from 'spec/helpers/reducerIndex';
import { setDatasetsStatus } from 'src/dashboard/actions/dashboardState';
import { act, createStore, render } from 'spec/helpers/testing-library';
import { DatasourceType, TimeGranularity, VizType } from '@superset-ui/core';
import { useAppSelector } from 'src/views/store';
import {
  replaceDashboardSemanticDatasets,
  updateDashboardSemanticDataset,
} from 'src/dashboard/actions/dashboardInfo';
import {
  postChartFormData,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import mockDatasource from 'spec/fixtures/mockDatasource';
import chartQueries, {
  sliceId as queryId,
} from 'spec/fixtures/mockChartQueries';
import {
  DashboardDatasetsContext,
  type DashboardDatasetsContextValue,
} from 'src/dashboard/contexts/DashboardDatasetsContext';
import { buildQuery as buildTableQuery } from '../../../../../plugins/plugin-chart-table/src/buildQuery';
import { buildQueryUncached as buildInteractiveQuery } from '../../../../../plugins/plugin-chart-ag-grid-table/src/buildQuery';
import type { TableChartFormData } from '../../../../../plugins/plugin-chart-table/src/types';
import Chart from './Chart';

jest.mock('src/components/Chart/chartAction', () => {
  const actions = jest.requireActual('src/components/Chart/chartAction');
  return {
    ...actions,
    postChartFormData: jest.fn(
      (...args: Parameters<typeof postChartFormData>) =>
        actions.triggerQuery(false, args[3]),
    ),
  };
});

afterEach(() => jest.clearAllMocks());

const dashboardId = 111;
const props = {
  id: queryId,
  width: 100,
  height: 100,
  dashboardId,
  updateSliceName: jest.fn(),
  handleToggleFullSize: jest.fn(),
  componentId: 'test',
  sliceName: 'Saved table',
  formData: chartQueries[queryId].form_data,
};

let nextChartId = queryId;

function setupMetadataChart(
  formData: TableChartFormData,
  datasetsStatus = 'loading',
  initialMetadata: DashboardDatasetsContextValue | null = null,
  useStoredMetadata = false,
  sourceRequestKey?: string,
  customizationGrain?: TimeGranularity,
) {
  // Dashboard form-data caching is keyed by chart ID; isolate saved charts.
  const chartId = nextChartId;
  nextChartId += 1;
  const initialState = {
    charts: {
      ...chartQueries,
      [chartId]: {
        ...chartQueries[queryId],
        id: chartId,
        form_data: formData,
        triggerQuery: true,
        chartStatus: 'loading',
        queriesResponse: null,
      },
    },
    sliceEntities: {
      ...sliceEntities,
      slices: {
        [chartId]: {
          ...sliceEntities.slices[queryId],
          viz_type: formData.viz_type,
        },
      },
    },
    datasources: mockDatasource,
    dashboardState: {
      editMode: Boolean(sourceRequestKey),
      expandedSlices: {},
      datasetsStatus,
    },
    nativeFilters: {
      filters: customizationGrain
        ? {
            'CHART_CUSTOMIZATION-grain': {
              id: 'CHART_CUSTOMIZATION-grain',
              type: 'CHART_CUSTOMIZATION',
              filterType: ChartCustomizationPlugins.TimeGrain,
              name: 'Time grain',
              chartsInScope: [chartId],
              scope: { rootPath: [], excluded: [] },
              targets: [],
              defaultDataMask: {},
              controlValues: {},
            },
          }
        : {},
    },
    dataMask: customizationGrain
      ? {
          'CHART_CUSTOMIZATION-grain': {
            id: 'CHART_CUSTOMIZATION-grain',
            extraFormData: { time_grain_sqla: customizationGrain },
            filterState: {},
            ownState: {},
          },
        }
      : {},
    dashboardInfo: {
      id: dashboardId,
      semanticDatasets: initialMetadata,
      common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 0, SQL_MAX_ROW: 666 } },
    },
    dashboardLayout: { present: {}, past: [], future: [] },
  };
  function StoredMetadataChart() {
    const value = useAppSelector(state => state.dashboardInfo.semanticDatasets);
    return (
      <DashboardDatasetsContext.Provider value={value ?? null}>
        <Chart {...props} id={chartId} />
      </DashboardDatasetsContext.Provider>
    );
  }
  const renderChart = (value: DashboardDatasetsContextValue | null) =>
    useStoredMetadata ? (
      <StoredMetadataChart />
    ) : (
      <DashboardDatasetsContext.Provider value={value}>
        <Chart {...props} id={chartId} />
      </DashboardDatasetsContext.Provider>
    );
  const store = createStore(initialState, reducerIndex);
  if (sourceRequestKey) {
    store.dispatch(
      updateDashboardSemanticDataset(
        dashboardId,
        sourceRequestKey,
        null,
        'source-request',
        true,
      ),
    );
  }
  const { rerender } = render(renderChart(initialMetadata), {
    useRedux: true,
    useRouter: true,
    store,
  });
  return {
    settleSource: (
      dataset: DashboardDatasetsContextValue['datasets'][number] | null,
      requestId = 'source-request',
    ) =>
      act(() => {
        store.dispatch(
          updateDashboardSemanticDataset(
            dashboardId,
            sourceRequestKey ?? formData.datasource,
            dataset,
            requestId,
          ),
        );
      }),
    startRefresh: () =>
      act(() => {
        store.dispatch(
          replaceDashboardSemanticDatasets(
            dashboardId,
            null,
            'save-request',
            true,
          ),
        );
        store.dispatch(triggerQuery(true, chartId));
      }),
    settleFailedRefresh: () =>
      act(() => {
        store.dispatch(
          replaceDashboardSemanticDatasets(dashboardId, [], 'save-request'),
        );
      }),
    publishMetadata: (metadata: DashboardDatasetsContextValue) =>
      act(() => rerender(renderChart(metadata))),
    failMetadata: () =>
      act(() => {
        store.dispatch(setDatasetsStatus(ResourceStatus.Error));
      }),
  };
}

const savedForm: TableChartFormData = {
  datasource: '2__semantic_view',
  viz_type: VizType.Table,
  metrics: ['orders'],
  groupby: ['country'],
  time_grain_sqla: TimeGranularity.DAY,
};
const currentMetadata: DashboardDatasetsContextValue = {
  dashboardId,
  datasets: [
    {
      uid: '2__semantic_view',
      type: DatasourceType.SemanticView,
      columns: [{ column_name: 'country', is_dttm: false }],
    },
  ],
};

test.each(
  [VizType.Table, VizType.TableAgGrid].flatMap(vizType =>
    [TimeGranularity.DAY, TimeGranularity.MONTH].flatMap(grain =>
      ['loading', 'complete'].map(status => ({ vizType, grain, status })),
    ),
  ),
)(
  'waits for dashboard metadata before querying $vizType with $grain ($status)',
  ({ vizType, grain, status }) => {
    const formData = {
      ...savedForm,
      viz_type: vizType,
      time_grain_sqla: grain,
    };
    const { publishMetadata } = setupMetadataChart(formData, status);
    expect(postChartFormData).not.toHaveBeenCalled();
    publishMetadata({ ...currentMetadata, dashboardId: dashboardId + 1 });
    expect(postChartFormData).not.toHaveBeenCalled();
    publishMetadata(currentMetadata);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const requestForm = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    expect(requestForm.temporal_columns_lookup).toEqual({ country: false });
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(requestForm).queries[0].extras).not.toHaveProperty(
      'time_grain_sqla',
    );
    expect(formData.time_grain_sqla).toBe(grain);
    expect(formData).not.toHaveProperty('temporal_columns_lookup');
  },
);

test.each([VizType.Table, VizType.TableAgGrid])(
  'failed metadata does not leave %s waiting forever',
  vizType => {
    const { failMetadata } = setupMetadataChart({
      ...savedForm,
      viz_type: vizType,
    });
    expect(postChartFormData).not.toHaveBeenCalled();
    failMetadata();
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const requestForm = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(requestForm).queries[0].extras?.time_grain_sqla).toBe(
      TimeGranularity.DAY,
    );
  },
);

test.each(
  [VizType.Table, VizType.TableAgGrid].flatMap(vizType =>
    [true, undefined].map(is_dttm => ({ vizType, is_dttm })),
  ),
)(
  'retains $vizType grain for temporal or unknown metadata ($is_dttm)',
  ({ vizType, is_dttm }) => {
    const { publishMetadata } = setupMetadataChart({
      ...savedForm,
      viz_type: vizType,
    });
    expect(postChartFormData).not.toHaveBeenCalled();
    publishMetadata({
      dashboardId,
      datasets: [
        {
          ...currentMetadata.datasets[0],
          columns: [{ column_name: 'country', is_dttm }],
        },
      ],
    });
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const requestForm = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(requestForm).queries[0].extras?.time_grain_sqla).toBe(
      TimeGranularity.DAY,
    );
  },
);

test('completed metadata without the source leaves semantic validation intact', () => {
  const { publishMetadata } = setupMetadataChart(savedForm);
  expect(postChartFormData).not.toHaveBeenCalled();
  publishMetadata({ dashboardId, datasets: [] });
  expect(postChartFormData).toHaveBeenCalledTimes(1);
  const requestForm = jest.mocked(postChartFormData).mock
    .calls[0][0] as TableChartFormData;
  expect(buildTableQuery(requestForm).queries[0].extras?.time_grain_sqla).toBe(
    TimeGranularity.DAY,
  );
});

test.each([VizType.Table, VizType.TableAgGrid])(
  'SQL %s does not wait for semantic metadata',
  vizType => {
    setupMetadataChart({
      ...savedForm,
      viz_type: vizType,
      datasource: '7__table',
    });
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const requestForm = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(requestForm).queries[0].extras?.time_grain_sqla).toBe(
      TimeGranularity.DAY,
    );
  },
);

test('semantic table without a stored grain does not wait for metadata', () => {
  setupMetadataChart({ ...savedForm, time_grain_sqla: undefined });
  expect(postChartFormData).toHaveBeenCalledTimes(1);
});

test.each([VizType.Table, VizType.TableAgGrid])(
  'post-save failed metadata refresh releases %s with unknown columns',
  vizType => {
    const { startRefresh, settleFailedRefresh } = setupMetadataChart(
      { ...savedForm, viz_type: vizType },
      'complete',
      currentMetadata,
      true,
    );
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    jest.mocked(postChartFormData).mockClear();
    startRefresh();
    expect(postChartFormData).not.toHaveBeenCalled();
    settleFailedRefresh();
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const requestForm = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    expect(requestForm.temporal_columns_lookup).toBeUndefined();
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(requestForm).queries[0].extras?.time_grain_sqla).toBe(
      TimeGranularity.DAY,
    );
  },
);

test.each(
  [VizType.Table, VizType.TableAgGrid].flatMap(vizType =>
    ['complete', 'error'].map(status => ({ vizType, status })),
  ),
)(
  'waits for edit-mode source metadata for $vizType despite page status $status',
  ({ vizType, status }) => {
    const { settleSource } = setupMetadataChart(
      { ...savedForm, viz_type: vizType },
      status,
      currentMetadata,
      true,
      savedForm.datasource,
    );
    expect(postChartFormData).not.toHaveBeenCalled();
    settleSource(currentMetadata.datasets[0], 'old-request');
    expect(postChartFormData).not.toHaveBeenCalled();
    settleSource(currentMetadata.datasets[0]);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const request = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(request).queries[0].extras).not.toHaveProperty(
      'time_grain_sqla',
    );
  },
);

test.each([VizType.Table, VizType.TableAgGrid])(
  'failed source fetch releases %s for strict validation',
  vizType => {
    const { settleSource } = setupMetadataChart(
      { ...savedForm, viz_type: vizType },
      'complete',
      currentMetadata,
      true,
      savedForm.datasource,
    );
    expect(postChartFormData).not.toHaveBeenCalled();
    settleSource(null);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const request = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(request).queries[0].extras?.time_grain_sqla).toBe(
      TimeGranularity.DAY,
    );
  },
);

test('another source fetch does not hold a chart with proven metadata', () => {
  setupMetadataChart(
    savedForm,
    'complete',
    currentMetadata,
    true,
    '3__semantic_view',
  );
  expect(postChartFormData).toHaveBeenCalledTimes(1);
});

test.each([VizType.Table, VizType.TableAgGrid])(
  'save refresh holds %s even after a page metadata error',
  vizType => {
    const { startRefresh, settleFailedRefresh } = setupMetadataChart(
      { ...savedForm, viz_type: vizType },
      'error',
      currentMetadata,
      true,
    );
    jest.mocked(postChartFormData).mockClear();
    startRefresh();
    expect(postChartFormData).not.toHaveBeenCalled();
    settleFailedRefresh();
    expect(postChartFormData).toHaveBeenCalledTimes(1);
  },
);

test.each([VizType.Table, VizType.TableAgGrid])(
  'dashboard extra grain holds %s without a saved grain',
  vizType => {
    const formData = {
      ...savedForm,
      viz_type: vizType,
      time_grain_sqla: undefined,
      extra_form_data: { time_grain_sqla: TimeGranularity.MONTH },
    };
    const { publishMetadata } = setupMetadataChart(formData);
    expect(postChartFormData).not.toHaveBeenCalled();
    publishMetadata(currentMetadata);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const request = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    expect(request.extra_form_data?.time_grain_sqla).toBe(
      TimeGranularity.MONTH,
    );
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(request).queries[0].extras).not.toHaveProperty(
      'time_grain_sqla',
    );
  },
);

test.each([VizType.Table, VizType.TableAgGrid])(
  'Time grain display control holds %s without a saved grain',
  vizType => {
    const { publishMetadata } = setupMetadataChart(
      { ...savedForm, viz_type: vizType, time_grain_sqla: undefined },
      'loading',
      null,
      false,
      undefined,
      TimeGranularity.MONTH,
    );
    expect(postChartFormData).not.toHaveBeenCalled();
    publishMetadata(currentMetadata);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const request = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    expect(request.time_grain_sqla).toBe(TimeGranularity.MONTH);
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    expect(build(request).queries[0].extras).not.toHaveProperty(
      'time_grain_sqla',
    );
  },
);

test.each(
  [VizType.Table, VizType.TableAgGrid].flatMap(vizType =>
    [false, true].map(is_dttm => ({ vizType, is_dttm })),
  ),
)(
  'loaded metadata applies a display grain only to temporal selections ($vizType, $is_dttm)',
  ({ vizType, is_dttm }) => {
    setupMetadataChart(
      { ...savedForm, viz_type: vizType, time_grain_sqla: undefined },
      'complete',
      {
        dashboardId,
        datasets: [
          {
            ...currentMetadata.datasets[0],
            columns: [{ column_name: 'country', is_dttm }],
          },
        ],
      },
      false,
      undefined,
      TimeGranularity.MONTH,
    );
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    const request = jest.mocked(postChartFormData).mock
      .calls[0][0] as TableChartFormData;
    const build =
      vizType === VizType.Table ? buildTableQuery : buildInteractiveQuery;
    const query = build(request).queries[0];
    if (is_dttm) {
      expect(query.extras?.time_grain_sqla).toBe(TimeGranularity.MONTH);
      expect(query.columns?.[0]).toMatchObject({
        timeGrain: TimeGranularity.MONTH,
        columnType: 'BASE_AXIS',
      });
    } else {
      expect(query.extras).not.toHaveProperty('time_grain_sqla');
      expect(query.columns).toEqual(['country']);
    }
  },
);
