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
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual, omit } from 'lodash-es';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { ControlStateMapping } from '@superset-ui/chart-controls';
import {
  DatasourceType,
  FeatureFlag,
  getChartComponentRegistry,
  QueryFormData,
  QueryMode,
  VizType,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import AgGridTableChartPlugin from '@superset-ui/plugin-chart-ag-grid-table';
import { getControlsState } from 'src/explore/store';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import { QUERY_MODE_REQUISITES } from 'src/explore/constants';
import { setControlValue } from 'src/explore/actions/exploreActions';
import { ExplorePageState } from 'src/explore/types';
import { chart } from 'src/components/Chart/chartReducer';
import ChartRenderer, {
  ChartRendererProps,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';
import levelsToMirrors from '../../../plugins/plugin-chart-ag-grid-table/src/TreeTable/levelsToMirrors';
import treeBuildQuery from '../../../plugins/plugin-chart-ag-grid-table/src/TreeTable/buildQuery';
import { ControlPanelsContainer } from './ControlPanelsContainer';

const treeFormData = {
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  datasource: '1__table',
  row_limit: 1000,
  levels: [
    {
      key: 'parent',
      name: 'Parent',
      id_column: 'parent',
      columns: ['value'],
      detail_fields: [],
      time_column: 'ds',
    },
    {
      key: 'child',
      name: 'Child',
      id_column: 'child',
      parent_column: 'parent',
      columns: ['value'],
      detail_fields: [],
    },
  ],
};

const chartRenderingFailed = jest.fn();
const renderedTreeLevels = jest.fn();
const chartActions = {
  chartRenderingFailed,
  chartRenderingSucceeded: jest.fn(),
  logEvent: jest.fn(),
} as unknown as ChartRendererProps['actions'];

/** Render the last Tree query through Explore's chart renderer and current control form data. */
function RenderedTreeChart() {
  const explore = useSelector((state: ExplorePageState) => state.explore);
  const renderedChart = useSelector(
    (state: ExplorePageState) => state.charts[1],
  );
  const { controls, hiddenFormData } = explore;
  const hiddenKeys = Object.keys(hiddenFormData ?? {});
  const fieldsToOmit = controls.query_mode?.value
    ? hiddenKeys.filter(key => !QUERY_MODE_REQUISITES.has(key))
    : hiddenKeys;
  const formData = omit(
    getFormDataFromControls(controls),
    fieldsToOmit,
  ) as QueryFormData;
  if (formData.query_mode === 'tree') renderedTreeLevels(formData.levels);
  return (
    <ChartRenderer
      actions={chartActions}
      chartId={1}
      vizType={VizType.TableAgGrid}
      source={ChartSource.Explore}
      datasource={explore.datasource as ChartRendererProps['datasource']}
      chartStatus={renderedChart.chartStatus}
      chartIsStale={
        explore.controls.query_mode.value !==
        renderedChart.latestQueryFormData.query_mode
      }
      formData={formData}
      latestQueryFormData={renderedChart.latestQueryFormData}
      width={800}
      height={400}
      queriesResponse={renderedChart.queriesResponse}
    />
  );
}

const treeResponse = [
  {
    data: [{ parent: 'Last queried parent', value: 1 }],
    colnames: ['parent', 'value'],
    coltypes: [GenericDataType.String, GenericDataType.Numeric],
  },
  { data: [{ rowcount: 1 }] },
];

function StorePanel() {
  const dispatch = useDispatch();
  const explore = useSelector((state: ExplorePageState) => state.explore);
  const errors = Object.values(explore.controls).flatMap(
    control => control.validationErrors ?? [],
  );
  return (
    <ControlPanelsContainer
      exploreState={explore}
      controls={explore.controls}
      form_data={getFormDataFromControls(explore.controls)}
      actions={{
        setControlValue: (...args) => dispatch(setControlValue(...args)),
        resetSemanticSelections: jest.fn(),
      }}
      datasource_type={DatasourceType.Table}
      chart={{ ...chart, chartStatus: 'success', queriesResponse: [] }}
      isDatasourceMetaLoading={false}
      errorMessage={errors.length ? errors.join(' ') : null}
      onQuery={jest.fn()}
      onStop={jest.fn()}
      canStopQuery={false}
      chartIsStale
    />
  );
}

function setup(
  queryMode = 'aggregate',
  invalid = false,
  pageLength = 20,
  treePageLength?: number,
  withChart = false,
) {
  window.featureFlags = {
    ...window.featureFlags,
    [FeatureFlag.TableV2TreeModeEnabled]: true,
  };
  new AgGridTableChartPlugin()
    .configure({ key: VizType.TableAgGrid })
    .register();
  const datasource = {
    id: 1,
    uid: '1__table',
    type: DatasourceType.Table,
    columns: ['parent', 'child', 'value', 'ds'].map(column_name => ({
      column_name,
      is_dttm: column_name === 'ds',
      groupby: true,
    })),
    metrics: [{ metric_name: 'count', expression: 'COUNT(*)' }],
    verbose_map: {},
    column_formats: {},
  };
  const input: QueryFormData = {
    ...treeFormData,
    query_mode: queryMode,
    levels: invalid ? [] : treeFormData.levels,
    groupby: ['parent'],
    metrics: ['count'],
    percent_metrics: ['count'],
    all_columns: ['value'],
    server_pagination: true,
    server_page_length: pageLength,
    tree_server_page_length: treePageLength,
  };
  const initial = {
    datasource,
    form_data: input,
    controls: Object.fromEntries(
      Object.entries(input).map(([name, value]) => [name, { value }]),
    ),
  };
  const controls = getControlsState(initial, input) as ControlStateMapping;
  const store = configureStore({
    reducer: reducerIndex,
    preloadedState: {
      ...(withChart && {
        charts: {
          1: {
            ...chart,
            id: 1,
            chartStatus: 'success',
            latestQueryFormData: input,
            queriesResponse: treeResponse,
          },
        },
      }),
      explore: {
        datasource,
        controls,
        form_data: getFormDataFromControls(controls),
        hiddenFormData: {},
      },
    } as never,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
    devTools: false,
  });
  render(
    <>
      <StorePanel />
      {withChart && <RenderedTreeChart />}
    </>,
    { store },
  );
  return store;
}

test.each([QueryMode.Raw, QueryMode.Aggregate])(
  'Explore keeps the last Tree result when switching through %s without a query',
  async mode => {
    setupAGGridModules();
    chartRenderingFailed.mockClear();
    renderedTreeLevels.mockClear();
    const plugin = new AgGridTableChartPlugin()
      .configure({ key: VizType.TableAgGrid })
      .register();
    getChartComponentRegistry().registerValue(
      VizType.TableAgGrid,
      await plugin.loadChart(),
    );
    const store = setup('tree', false, 50, undefined, true);
    expect(await screen.findByText('Last queried parent')).toBeInTheDocument();
    const grid = screen.getByRole('grid');
    act(() => {
      store.dispatch(setControlValue('query_mode', mode));
    });
    expect(store.getState().explore.hiddenFormData?.levels).toBeDefined();
    act(() => {
      store.dispatch(setControlValue('query_mode', 'tree'));
    });
    expect(chartRenderingFailed).not.toHaveBeenCalled();
    expect(renderedTreeLevels).toHaveBeenCalled();
    expect(await screen.findByText('Last queried parent')).toBeInTheDocument();
    expect({
      sameGrid: screen.getByRole('grid') === grid,
      everyTreeRenderHasLevels: renderedTreeLevels.mock.calls.every(
        ([levels]) => isEqual(levels, treeFormData.levels),
      ),
    }).toEqual({ sameGrid: true, everyTreeRenderHasLevels: true });
  },
);

test.each([
  ['aggregate', 0],
  ['aggregate', 25],
  ['aggregate', 20],
  ['raw', 0],
  ['raw', 25],
  ['raw', 20],
] as const)(
  '%s page length %s survives independent Tree paging and return',
  async (mode, pageLength) => {
    const store = setup(mode, false, pageLength);
    act(() => {
      store.dispatch(setControlValue('query_mode', 'tree'));
    });
    await waitFor(() =>
      expect(store.getState().explore.controls.query_mode.value).toBe('tree'),
    );
    expect(store.getState().explore.controls.server_page_length.value).toBe(
      pageLength,
    );
    expect(
      screen
        .getByRole('combobox', { name: 'Page length' })
        .closest('.ant-select'),
    ).toHaveTextContent('50');
    expect(
      screen.queryByRole('combobox', { name: 'Server Page Length' }),
    ).not.toBeInTheDocument();
    expect(
      store.getState().explore.controls.tree_server_page_length.value,
    ).toBe(50);
    const formData = getFormDataFromControls(store.getState().explore.controls);
    expect(formData.server_page_length).toBe(pageLength);
    expect(treeBuildQuery(formData).queries[0]).toMatchObject({
      row_limit: 50,
      row_offset: 0,
    });
    act(() => {
      store.dispatch(setControlValue('tree_server_page_length', 20));
    });
    expect(
      treeBuildQuery(getFormDataFromControls(store.getState().explore.controls))
        .queries[0].row_limit,
    ).toBe(20);
    expect(
      screen
        .getByRole('combobox', { name: 'Page length' })
        .closest('.ant-select'),
    ).toHaveTextContent('20');
    act(() => {
      store.dispatch(setControlValue('query_mode', mode));
    });
    await waitFor(() =>
      expect(store.getState().explore.controls.query_mode.value).toBe(mode),
    );
    expect(store.getState().explore.controls.server_page_length.value).toBe(
      pageLength,
    );
    expect(
      getFormDataFromControls(store.getState().explore.controls)
        .server_page_length,
    ).toBe(pageLength);
    expect(
      screen
        .getByRole('combobox', { name: 'Server Page Length' })
        .closest('.ant-select'),
    ).toHaveTextContent(String(pageLength));
  },
);

test.each([0, 25, 20])(
  'hydrating Tree preserves Table V2 page length %s and defaults only its own setting',
  pageLength => {
    const store = setup('tree', false, pageLength);
    expect(store.getState().explore.controls.server_page_length.value).toBe(
      pageLength,
    );
    expect(
      screen
        .getByRole('combobox', { name: 'Page length' })
        .closest('.ant-select'),
    ).toHaveTextContent('50');
    const formData = getFormDataFromControls(store.getState().explore.controls);
    expect(formData.server_page_length).toBe(pageLength);
    expect(formData.tree_server_page_length).toBe(50);
    expect(treeBuildQuery(formData).queries[0].row_limit).toBe(50);
  },
);

test('a saved Tree page length remains the selected and queried value', () => {
  const store = setup('tree', false, 25, 20);
  const formData = getFormDataFromControls(store.getState().explore.controls);
  expect(formData.tree_server_page_length).toBe(20);
  expect(formData.server_page_length).toBe(25);
  expect(
    screen
      .getByRole('combobox', { name: 'Page length' })
      .closest('.ant-select'),
  ).toHaveTextContent('20');
  expect(treeBuildQuery(formData).queries[0].row_limit).toBe(20);
});

test.each(['aggregate', 'raw'])(
  'turning off %s server pagination retains the original page-length reset',
  async mode => {
    const store = setup(mode, false, 25);
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Server pagination' }),
    );
    await waitFor(() =>
      expect(store.getState().explore.controls.server_page_length.value).toBe(
        10,
      ),
    );
  },
);

test('Aggregate → Tree → Aggregate and Tree → Raw → Tree preserve independent controls and mirrors', async () => {
  const store = setup();
  const aggregateValues = {
    groupby: ['parent'],
    metrics: ['count'],
    percent_metrics: ['count'],
    server_pagination: true,
  };
  await userEvent.click(screen.getByText('Tree', { selector: 'span' }));
  await waitFor(() =>
    expect(store.getState().explore.controls.query_mode.value).toBe('tree'),
  );
  expect(store.getState().explore.controls.metrics.value).toEqual(['count']);
  await userEvent.click(screen.getByText('Aggregate', { selector: 'span' }));
  await waitFor(() =>
    expect(store.getState().explore.controls.query_mode.value).toBe(
      'aggregate',
    ),
  );
  for (const [key, value] of Object.entries(aggregateValues))
    expect(store.getState().explore.controls[key].value).toEqual(value);
  await userEvent.click(screen.getByText('Tree', { selector: 'span' }));
  await userEvent.click(screen.getByText('Raw records', { selector: 'span' }));
  await userEvent.click(screen.getByText('Tree', { selector: 'span' }));
  await waitFor(() =>
    expect(store.getState().explore.controls.levels.value).toEqual(
      treeFormData.levels,
    ),
  );
  for (const [key, value] of Object.entries(
    levelsToMirrors(treeFormData.levels!),
  ))
    expect(store.getState().explore.controls[key].value).toEqual(value);
  expect(store.getState().explore.controls.metrics.value).toEqual(['count']);
});

test.each(['aggregate', 'raw'])(
  'the Table V2 page-length control stays free-form through Tree and return to %s',
  async mode => {
    const store = setup('tree');
    expect(store.getState().explore.controls.server_page_length.freeForm).toBe(
      true,
    );
    act(() => {
      store.dispatch(setControlValue('query_mode', mode));
    });
    await waitFor(() =>
      expect(store.getState().explore.controls.query_mode.value).toBe(mode),
    );
    const { explore } = store.getState();
    const control = explore.controls.server_page_length;
    const mapped = control.mapStateToProps?.(
      explore as unknown as Parameters<
        NonNullable<typeof control.mapStateToProps>
      >[0],
      control,
      { queriesResponse: null },
    );
    expect({ ...control, ...mapped }.freeForm).toBe(true);
  },
);

test.each(['aggregate', 'raw'])(
  'invalid Tree → %s → Tree refreshes Redux validation and Run without editing Levels',
  async mode => {
    const store = setup('tree', true);
    await waitFor(() =>
      expect(store.getState().explore.controls.levels.validationErrors).toEqual(
        ['Add at least one level.'],
      ),
    );
    expect(screen.getByTestId('run-query-button')).toBeDisabled();
    act(() => {
      store.dispatch(setControlValue('query_mode', mode));
    });
    await waitFor(() =>
      expect(store.getState().explore.controls.levels.validationErrors).toEqual(
        [],
      ),
    );
    expect(screen.getByTestId('run-query-button')).toBeEnabled();
    act(() => {
      store.dispatch(setControlValue('query_mode', 'tree'));
    });
    await waitFor(() =>
      expect(store.getState().explore.controls.levels.validationErrors).toEqual(
        ['Add at least one level.'],
      ),
    );
    expect(screen.getByTestId('run-query-button')).toBeDisabled();
  },
);
