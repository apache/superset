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
/**
 * Datasource resolution from the real default-selection path: a NEW filter on a
 * dashboard whose charts use a semantic view, with Redux state shaped like the
 * dashboard-datasets payload. Routes are registered exactly; a SQL-dataset
 * request for a semantic view's id is a tripwire that fails the test rather
 * than being answered by a catch-all mock.
 */
import {
  DatasourceType,
  Filter,
  NativeFilterType,
  Preset,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import fetchMock from 'fetch-mock';
import {
  dashboardCharts,
  dashboardDatasources,
  MockDashboardDatasource,
  semanticViewDimensions,
  semanticViewEntry,
  sqlDatasetEntry,
  sqlDatasetResult,
} from 'spec/fixtures/mockSemanticDashboardDatasources';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import {
  RangeFilterPlugin,
  SelectFilterPlugin,
  TimeColumnFilterPlugin,
  TimeFilterPlugin,
  TimeGrainFilterPlugin,
} from 'src/filters/components';
import { ChartCustomizationDynamicGroupBy } from 'src/chartCustomizations/components';
import { ChartCustomizationPlugins } from 'src/constants';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import FiltersConfigModal, {
  FiltersConfigModalProps,
} from './FiltersConfigModal';

class FilterPreset extends Preset {
  constructor() {
    super({
      name: 'Native filters',
      plugins: [
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new TimeColumnFilterPlugin().configure({ key: 'filter_timecolumn' }),
        new TimeGrainFilterPlugin().configure({ key: 'filter_timegrain' }),
        new ChartCustomizationDynamicGroupBy().configure({
          key: ChartCustomizationPlugins.DynamicGroupBy,
        }),
      ],
    });
  }
}

const VIEW_ID = 2;
const VIEW_NAME = 'Orders View';

const props: FiltersConfigModalProps = {
  isOpen: true,
  createNewOnOpen: true,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

const structureRoute = (id: number) =>
  `glob:*/api/v1/semantic_view/${id}/structure`;

/** URLs of forbidden requests, recorded by tripwire routes. */
let forbiddenRequests: string[] = [];

/**
 * Fail-closed guard: any request to `/api/v1/dataset/<id>` (with or without a
 * query string) is recorded. By default it is answered with 500; pass a body to
 * model a readable same-id SQL dataset whose data must never leak into a
 * semantic-view filter. Tests assert the list is empty, so a mis-typed binding
 * fails the test for the intended reason.
 */
const forbidDatasetRequests = (id: number, body?: object) => {
  fetchMock.get(
    `glob:*/api/v1/dataset/${id}*`,
    ({ url }: { url: string }) => {
      forbiddenRequests.push(url);
      return body ?? 500;
    },
    { name: `forbidden-dataset-${id}` },
  );
};

const mockSemanticViewStructure = (id: number, name = VIEW_NAME) => {
  fetchMock.get(structureRoute(id), {
    result: {
      name,
      semantic_selection_version: null,
      description: null,
      cache_timeout: null,
      dimensions: semanticViewDimensions.map(dimension => ({
        ...dimension,
        description: null,
        grain: null,
      })),
      metrics: [{ name: 'Orders.count', type: 'int64', definition: 'count' }],
    },
  });
};

const mockChartData = () => {
  fetchMock.post('glob:*/api/v1/chart/data*', {
    result: [
      {
        status: 'success',
        data: [{ 'Orders.status': 'shipped' }],
        applied_filters: [],
      },
    ],
  });
};

const mockCombinedDatasourceList = (items: object[]) => {
  fetchMock.get(
    'glob:*/api/v1/datasource/?q=*',
    { result: items, count: items.length },
    { name: 'datasource-list' },
  );
};

const stateFor = (
  datasources: Record<string, MockDashboardDatasource>,
  chartUids: string[],
  savedFilters: Filter[] = [],
) => ({
  datasources,
  charts: dashboardCharts(...chartUids),
  dashboardLayout: { present: {}, past: [], future: [] },
  dashboardInfo: {
    metadata: { native_filter_configuration: savedFilters },
  },
});

const semanticOnlyState = () =>
  stateFor(dashboardDatasources(semanticViewEntry(VIEW_ID)), [
    `${VIEW_ID}__semantic_view`,
    `${VIEW_ID}__semantic_view`,
  ]);

const renderModal = (
  initialState: ReturnType<typeof stateFor>,
  modalProps: FiltersConfigModalProps = props,
) =>
  render(<FiltersConfigModal {...modalProps} />, {
    initialState,
    useDnd: true,
    useRedux: true,
  });

/**
 * Waits until the form has asked for the bound datasource's metadata through
 * either endpoint, so the tripwire assertion that follows reports a forbidden
 * request by its URL instead of timing out on a missing field.
 */
const waitForDatasourceRequest = (id: number) =>
  waitFor(() =>
    expect(
      fetchMock.callHistory.called(structureRoute(id)) ||
        forbiddenRequests.length > 0,
    ).toBe(true),
  );

const findDatasourceField = () =>
  screen.findByTestId('filters-config-modal__datasource-input');

const openColumnOptions = async () => {
  await userEvent.click(
    await screen.findByRole('combobox', { name: 'Column select' }),
  );
};

beforeAll(() => {
  new FilterPreset().register();
});

beforeEach(() => {
  window.featureFlags = { SEMANTIC_LAYERS: true } as never;
  forbiddenRequests = [];
  supersetGetCache.clear();
  mockCombinedDatasourceList([
    { id: VIEW_ID, table_name: VIEW_NAME, kind: 'semantic_view' },
  ]);
  mockChartData();
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  supersetGetCache.clear();
  window.featureFlags = {} as never;
});

test('a new filter on a semantic-view dashboard binds to the semantic view by type', async () => {
  forbidDatasetRequests(VIEW_ID);
  mockSemanticViewStructure(VIEW_ID);

  renderModal(semanticOnlyState());

  await waitForDatasourceRequest(VIEW_ID);
  expect(forbiddenRequests).toEqual([]);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  await openColumnOptions();
  expect(await screen.findByText('Orders.status')).toBeInTheDocument();
  expect(forbiddenRequests).toEqual([]);
});

const SQL_COLUMNS_PROJECTION =
  '?q=(columns:!(columns.column_name,columns.is_dttm,columns.type_generic,columns.filterable))';
const SQL_DETAILS_PROJECTION =
  '?q=(columns:!(columns.column_name,columns.expression,columns.filterable,columns.is_dttm,columns.type,columns.type_generic,columns.verbose_name,database.id,database.database_name,datasource_type,filter_select_enabled,id,is_sqllab_view,main_dttm_col,metrics.metric_name,metrics.verbose_name,schema,sql,table_name,time_grain_sqla))';

/** Records every SQL-dataset request for an id that may legitimately be read. */
const allowDatasetRequests = (id: number, tableName = 'sql_orders') => {
  const urls: string[] = [];
  fetchMock.get(
    `glob:*/api/v1/dataset/${id}?*`,
    ({ url }: { url: string }) => {
      urls.push(url);
      return sqlDatasetResult(id, tableName);
    },
    { name: `dataset-${id}` },
  );
  return urls;
};

/** The most recently opened, still-visible select dropdown. */
const openDropdown = () => {
  const dropdowns = Array.from(
    // eslint-disable-next-line testing-library/no-node-access
    document.querySelectorAll<HTMLElement>(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    ),
  );
  return dropdowns[dropdowns.length - 1];
};

/** Picks an option from the most recently opened select dropdown. */
const pickOpenOption = async (text: string) => {
  const option = await waitFor(() => within(openDropdown()).getByText(text));
  await userEvent.click(option);
};

/** The selected value shown by the column select, if any. */
const selectedColumn = () =>
  screen
    .getByRole('combobox', { name: 'Column select' })
    // eslint-disable-next-line testing-library/no-node-access
    .closest('.ant-select')
    // eslint-disable-next-line testing-library/no-node-access
    ?.querySelector('.ant-select-content-has-value, .ant-select-selection-item')
    ?.getAttribute('title') ?? null;

const chooseDatasource = async (label: string) => {
  await userEvent.click(
    within(await findDatasourceField()).getByRole('combobox', {
      name: /^datasource/i,
    }),
  );
  await pickOpenOption(label);
};

const sqlListItem = (id: number, tableName = 'sql_orders') => ({
  id,
  table_name: tableName,
  kind: 'table',
  schema: 'public',
  database: { database_name: 'examples' },
});

const selectFilterType = async (current: RegExp, next: RegExp) => {
  await userEvent.click(screen.getByText(current));
  await userEvent.click(await screen.findByText(next));
};

const savedSemanticFilter = (
  id: string,
  name: string,
  datasetId: number,
  datasourceType: DatasourceType,
  column: string,
): Filter => ({
  ...buildNativeFilter(id, name, []),
  type: NativeFilterType.NativeFilter,
  description: '',
  targets: [{ datasetId, datasourceType, column: { name: column } }],
});

const saveAndCapture = async (onSave: jest.Mock, name = 'Status') => {
  const nameInput = screen.getByRole('textbox', { name: /^filter name$/i });
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, name);
  // The name change is debounced; the sidebar title confirms it registered.
  await waitFor(() =>
    expect(
      within(screen.getByTestId('filter-title-container')).getByText(name),
    ).toBeInTheDocument(),
  );
  await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  return onSave.mock.calls[0][0];
};

test.each([
  ['Numerical range', /^numerical range$/i],
  ['Time column', /^time column$/i],
  ['Time grain', /^time grain$/i],
])(
  'a new %s filter on a semantic-view dashboard binds to the semantic view',
  async (_label, filterType) => {
    forbidDatasetRequests(VIEW_ID);
    mockSemanticViewStructure(VIEW_ID);

    renderModal(semanticOnlyState());
    await waitForDatasourceRequest(VIEW_ID);
    await selectFilterType(/^value$/i, filterType);

    expect(
      await within(await findDatasourceField()).findByText(VIEW_NAME),
    ).toBeInTheDocument();
    expect(forbiddenRequests).toEqual([]);
  },
);

test('a new display control on a semantic-view dashboard binds to the semantic view', async () => {
  forbidDatasetRequests(VIEW_ID);
  mockSemanticViewStructure(VIEW_ID);

  renderModal(semanticOnlyState(), { ...props, createNewOnOpen: false });
  await userEvent.hover(screen.getByTestId('new-item-dropdown-button'));
  await userEvent.click(await screen.findByText('Add display control'));
  await userEvent.click(
    await screen.findByRole('combobox', { name: 'Customization type' }),
  );
  await userEvent.click(await screen.findByText('Dynamic group by'));

  await waitForDatasourceRequest(VIEW_ID);
  expect(forbiddenRequests).toEqual([]);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
});

test('a same-id SQL dataset never supplies data to a semantic-view default', async () => {
  forbidDatasetRequests(VIEW_ID, sqlDatasetResult(VIEW_ID));
  mockSemanticViewStructure(VIEW_ID);

  renderModal(semanticOnlyState());
  await waitForDatasourceRequest(VIEW_ID);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  await openColumnOptions();
  expect(await screen.findByText('Orders.status')).toBeInTheDocument();

  expect(screen.queryByText('sql_orders')).not.toBeInTheDocument();
  expect(screen.queryByText('sql_only_column')).not.toBeInTheDocument();
  expect(forbiddenRequests).toEqual([]);
});

test('a saved semantic-view filter never loads the same-id SQL dataset', async () => {
  forbidDatasetRequests(VIEW_ID, sqlDatasetResult(VIEW_ID));
  mockSemanticViewStructure(VIEW_ID);
  const filter = savedSemanticFilter(
    'NATIVE_FILTER-semantic',
    'Status',
    VIEW_ID,
    DatasourceType.SemanticView,
    'Orders.status',
  );

  renderModal(
    stateFor(
      dashboardDatasources(semanticViewEntry(VIEW_ID)),
      [`${VIEW_ID}__semantic_view`],
      [filter],
    ),
    { ...props, createNewOnOpen: false },
  );

  await waitForDatasourceRequest(VIEW_ID);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  expect(screen.queryByText('sql_orders')).not.toBeInTheDocument();
  expect(forbiddenRequests).toEqual([]);
});

test('saving a default semantic-view filter records the semantic-view target', async () => {
  forbidDatasetRequests(VIEW_ID);
  mockSemanticViewStructure(VIEW_ID);
  const onSave = jest.fn().mockResolvedValue(undefined);

  renderModal(semanticOnlyState(), { ...props, onSave });
  await waitForDatasourceRequest(VIEW_ID);
  await openColumnOptions();
  await userEvent.click(await screen.findByText('Orders.status'));

  const { filterChanges } = await saveAndCapture(onSave);
  const [saved] = filterChanges.modified;
  expect(saved.targets).toEqual([
    {
      datasetId: VIEW_ID,
      datasourceType: DatasourceType.SemanticView,
      column: { name: 'Orders.status' },
    },
  ]);
  expect(forbiddenRequests).toEqual([]);
});

test('a mixed dashboard defaults to a most-used semantic view by its type', async () => {
  forbidDatasetRequests(VIEW_ID);
  mockSemanticViewStructure(VIEW_ID);
  const sqlRequests = allowDatasetRequests(7);

  renderModal(
    stateFor(
      dashboardDatasources(sqlDatasetEntry(7), semanticViewEntry(VIEW_ID)),
      ['7__table', `${VIEW_ID}__semantic_view`, `${VIEW_ID}__semantic_view`],
    ),
  );

  await waitForDatasourceRequest(VIEW_ID);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  expect(forbiddenRequests).toEqual([]);
  expect(sqlRequests).toEqual([]);
});

test('a mixed dashboard defaults to a most-used SQL dataset with unchanged requests', async () => {
  mockSemanticViewStructure(VIEW_ID);
  const sqlRequests = allowDatasetRequests(7);

  renderModal(
    stateFor(
      dashboardDatasources(sqlDatasetEntry(7), semanticViewEntry(VIEW_ID)),
      ['7__table', '7__table', `${VIEW_ID}__semantic_view`],
    ),
  );

  expect(
    await within(await findDatasourceField()).findByText('sql_orders'),
  ).toBeInTheDocument();
  await openColumnOptions();
  expect(await screen.findByText('sql_only_column')).toBeInTheDocument();
  expect(sqlRequests).toEqual(
    expect.arrayContaining([
      `http://localhost/api/v1/dataset/7${SQL_DETAILS_PROJECTION}`,
      `http://localhost/api/v1/dataset/7${SQL_COLUMNS_PROJECTION}`,
    ]),
  );
  expect(fetchMock.callHistory.called(structureRoute(VIEW_ID))).toBe(false);
});

test.each([
  ['semantic view', 1, 2, DatasourceType.SemanticView],
  ['SQL dataset', 2, 1, DatasourceType.Table],
])(
  'when dataset 2 and semantic view 2 share a dashboard, the most-used %s is the default',
  async (_label, sqlCharts, semanticCharts, expectedType) => {
    mockSemanticViewStructure(VIEW_ID);
    const sqlRequests = allowDatasetRequests(VIEW_ID);
    const onSave = jest.fn().mockResolvedValue(undefined);

    renderModal(
      stateFor(
        dashboardDatasources(
          sqlDatasetEntry(VIEW_ID),
          semanticViewEntry(VIEW_ID),
        ),
        [
          ...Array(sqlCharts).fill(`${VIEW_ID}__table`),
          ...Array(semanticCharts).fill(`${VIEW_ID}__semantic_view`),
        ],
      ),
      { ...props, onSave },
    );

    const expectedLabel =
      expectedType === DatasourceType.SemanticView ? VIEW_NAME : 'sql_orders';
    const expectedColumn =
      expectedType === DatasourceType.SemanticView
        ? 'Orders.status'
        : 'sql_only_column';
    expect(
      await within(await findDatasourceField()).findByText(expectedLabel),
    ).toBeInTheDocument();
    await openColumnOptions();
    await userEvent.click(await screen.findByText(expectedColumn));
    if (expectedType === DatasourceType.SemanticView) {
      expect(sqlRequests).toEqual([]);
    } else {
      expect(fetchMock.callHistory.called(structureRoute(VIEW_ID))).toBe(false);
    }

    const { filterChanges } = await saveAndCapture(onSave);
    const [saved] = filterChanges.modified;
    expect(saved.targets[0]).toEqual(
      expect.objectContaining({
        datasetId: VIEW_ID,
        datasourceType: expectedType,
      }),
    );
  },
);

test('the initial scope of a semantic-view filter excludes charts on the same-id SQL dataset', async () => {
  mockSemanticViewStructure(VIEW_ID);
  allowDatasetRequests(VIEW_ID);
  const onSave = jest.fn().mockResolvedValue(undefined);
  // Charts 100 and 101 use semantic view 2; chart 102 uses SQL dataset 2.
  renderModal(
    stateFor(
      dashboardDatasources(
        sqlDatasetEntry(VIEW_ID),
        semanticViewEntry(VIEW_ID),
      ),
      [
        `${VIEW_ID}__semantic_view`,
        `${VIEW_ID}__semantic_view`,
        `${VIEW_ID}__table`,
      ],
    ),
    { ...props, onSave },
  );

  await waitForDatasourceRequest(VIEW_ID);
  await openColumnOptions();
  await userEvent.click(await screen.findByText('Orders.status'));

  const { filterChanges } = await saveAndCapture(onSave);
  const [saved] = filterChanges.modified;
  expect(saved.scope.excluded).toEqual([102]);
});

test('a SQL-only dashboard requests the dataset exactly as before', async () => {
  const sqlRequests = allowDatasetRequests(7);

  renderModal(stateFor(dashboardDatasources(sqlDatasetEntry(7)), ['7__table']));

  expect(
    await within(await findDatasourceField()).findByText('sql_orders'),
  ).toBeInTheDocument();
  await openColumnOptions();
  expect(await screen.findByText('sql_only_column')).toBeInTheDocument();
  expect([...new Set(sqlRequests)].sort()).toEqual(
    [
      `http://localhost/api/v1/dataset/7${SQL_COLUMNS_PROJECTION}`,
      `http://localhost/api/v1/dataset/7${SQL_DETAILS_PROJECTION}`,
    ].sort(),
  );
  expect(
    fetchMock.callHistory
      .calls()
      .some(({ url }) => url.includes('/api/v1/semantic_view/')),
  ).toBe(false);
});

test.each([
  ['semantic view structure', 403],
  ['semantic view structure', 422],
])(
  'a failed %s load (%s) leaves an empty, usable datasource select',
  async (_label, status) => {
    forbidDatasetRequests(VIEW_ID);
    fetchMock.get(structureRoute(VIEW_ID), {
      status,
      body: { message: 'Forbidden semantic view' },
    });

    renderModal(semanticOnlyState());

    const field = await findDatasourceField();
    expect(within(field).queryByText(VIEW_NAME)).not.toBeInTheDocument();
    expect(
      within(field).getByRole('combobox', { name: /^datasource$/i }),
    ).toBeEnabled();
    // The unbound column select makes no request of its own, so a failure
    // surfaces once rather than as a second failing request and toast.
    expect(fetchMock.callHistory.calls(structureRoute(VIEW_ID))).toHaveLength(
      1,
    );
    expect(forbiddenRequests).toEqual([]);
  },
);

test('a failed SQL dataset load leaves an empty, usable datasource select', async () => {
  const urls: string[] = [];
  fetchMock.get('glob:*/api/v1/dataset/7?*', ({ url }: { url: string }) => {
    urls.push(url);
    return 404;
  });

  renderModal(stateFor(dashboardDatasources(sqlDatasetEntry(7)), ['7__table']));

  const field = await findDatasourceField();
  expect(within(field).queryByText('sql_orders')).not.toBeInTheDocument();
  expect(
    within(field).getByRole('combobox', { name: /^datasource$/i }),
  ).toBeEnabled();
  // The details and column requests start together; once the load fails the
  // datasource is unbound, so neither is retried.
  expect([...urls].sort()).toEqual(
    [
      `http://localhost/api/v1/dataset/7${SQL_COLUMNS_PROJECTION}`,
      `http://localhost/api/v1/dataset/7${SQL_DETAILS_PROJECTION}`,
    ].sort(),
  );
});

test('switching between a same-id dataset and semantic view reloads columns by type', async () => {
  mockSemanticViewStructure(VIEW_ID);
  const sqlRequests = allowDatasetRequests(VIEW_ID);
  fetchMock.removeRoute('datasource-list');
  mockCombinedDatasourceList([
    sqlListItem(VIEW_ID),
    { id: VIEW_ID, table_name: VIEW_NAME, kind: 'semantic_view' },
  ]);

  renderModal(
    stateFor(
      dashboardDatasources(
        sqlDatasetEntry(VIEW_ID),
        semanticViewEntry(VIEW_ID),
      ),
      [
        `${VIEW_ID}__table`,
        `${VIEW_ID}__semantic_view`,
        `${VIEW_ID}__semantic_view`,
      ],
    ),
  );

  await waitForDatasourceRequest(VIEW_ID);
  await openColumnOptions();
  await pickOpenOption('Orders.status');
  expect(sqlRequests).toEqual([]);

  expect(selectedColumn()).toBe('Orders.status');

  await chooseDatasource('sql_orders');
  await waitFor(() => expect(sqlRequests.length).toBeGreaterThan(0));
  expect(selectedColumn()).toBeNull();
  await openColumnOptions();
  await waitFor(() =>
    expect(within(openDropdown()).getByText('sql_only_column')).toBeVisible(),
  );
  expect(
    within(openDropdown()).queryByText('Orders.amount'),
  ).not.toBeInTheDocument();

  await chooseDatasource(VIEW_NAME);
  await waitFor(() => expect(selectedColumn()).toBeNull());
  await openColumnOptions();
  await waitFor(() =>
    expect(within(openDropdown()).getByText('Orders.status')).toBeVisible(),
  );
  expect(
    within(openDropdown()).queryByText('sql_only_column'),
  ).not.toBeInTheDocument();
});

test('the time range pre-filter follows the bound semantic view, not a same-id dataset', async () => {
  mockSemanticViewStructure(VIEW_ID);
  allowDatasetRequests(VIEW_ID);
  // Listed first, with no temporal column: an id-only lookup would find it.
  const sqlWithoutTime = {
    ...sqlDatasetEntry(VIEW_ID),
    column_types: [GenericDataType.String],
  };

  renderModal(
    stateFor(dashboardDatasources(sqlWithoutTime, semanticViewEntry(VIEW_ID)), [
      `${VIEW_ID}__semantic_view`,
      `${VIEW_ID}__semantic_view`,
    ]),
  );

  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('checkbox', { name: /^pre-filter available values/i }),
  );
  expect(await screen.findByText(/^time range$/i)).toBeInTheDocument();
});

test('saving an edited semantic-view filter on a mixed dashboard keeps every target', async () => {
  mockSemanticViewStructure(VIEW_ID);
  allowDatasetRequests(VIEW_ID);
  const onSave = jest.fn().mockResolvedValue(undefined);
  const semanticFilter = savedSemanticFilter(
    'NATIVE_FILTER-semantic',
    'Status',
    VIEW_ID,
    DatasourceType.SemanticView,
    'Orders.status',
  );
  const sqlFilter = savedSemanticFilter(
    'NATIVE_FILTER-sql',
    'SQL column',
    VIEW_ID,
    DatasourceType.Table,
    'sql_only_column',
  );

  renderModal(
    stateFor(
      dashboardDatasources(
        sqlDatasetEntry(VIEW_ID),
        semanticViewEntry(VIEW_ID),
      ),
      [`${VIEW_ID}__table`, `${VIEW_ID}__semantic_view`],
      [semanticFilter, sqlFilter],
    ),
    { ...props, onSave, createNewOnOpen: false },
  );

  await waitForDatasourceRequest(VIEW_ID);
  expect(
    await within(await findDatasourceField()).findByText(VIEW_NAME),
  ).toBeInTheDocument();
  const { filterChanges } = await saveAndCapture(onSave, 'Order status');
  expect(filterChanges.modified).toHaveLength(1);
  expect(filterChanges.modified[0].targets).toEqual(semanticFilter.targets);
  expect(filterChanges.deleted).toEqual([]);
});

test('after a failed semantic view load the editor can pick a working datasource', async () => {
  forbidDatasetRequests(VIEW_ID);
  fetchMock.get(structureRoute(VIEW_ID), {
    status: 403,
    body: { message: 'Forbidden semantic view' },
  });
  const sqlRequests = allowDatasetRequests(7);
  fetchMock.removeRoute('datasource-list');
  mockCombinedDatasourceList([
    sqlListItem(7),
    { id: VIEW_ID, table_name: VIEW_NAME, kind: 'semantic_view' },
  ]);

  renderModal(semanticOnlyState());

  await chooseDatasource('sql_orders');
  await waitFor(() => expect(sqlRequests.length).toBeGreaterThan(0));
  await openColumnOptions();
  expect(await screen.findByText('sql_only_column')).toBeInTheDocument();
  expect(forbiddenRequests).toEqual([]);
});

test('choosing a datasource whose load failed retries it', async () => {
  forbidDatasetRequests(VIEW_ID);
  fetchMock.get(structureRoute(VIEW_ID), {
    status: 403,
    body: { message: 'Forbidden semantic view' },
  });

  renderModal(semanticOnlyState());
  await findDatasourceField();
  expect(fetchMock.callHistory.calls(structureRoute(VIEW_ID))).toHaveLength(1);

  await chooseDatasource(VIEW_NAME);
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(structureRoute(VIEW_ID))).toHaveLength(
      2,
    ),
  );
  expect(forbiddenRequests).toEqual([]);
});
