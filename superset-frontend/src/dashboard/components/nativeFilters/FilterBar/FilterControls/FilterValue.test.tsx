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
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  NativeFilterType,
  DatasourceType,
  buildQueryObject,
} from '@superset-ui/core';
import type { DataMask, Filter } from '@superset-ui/core';
import { mergeExtraFormData, withNativeFilterProvenance } from '../../utils';
import FilterValue from './FilterValue';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';

const mockRequestChartData = jest.fn();
const mockGetClientErrorObject = jest.fn();
const mockSuperChartProps = jest.fn();
let mockRenderSelectPlugin = false;
jest.mock('src/components/Chart/chartAction', () => ({
  requestChartDataResolved: (...args: unknown[]) =>
    mockRequestChartData(...args),
}));

jest.mock('@superset-ui/core', () => {
  const original = jest.requireActual('@superset-ui/core');
  return {
    ...original,
    getChartMetadataRegistry: () => ({
      get: () => ({ enableNoResults: false }),
    }),
    SuperChart: (props: Record<string, unknown>) => {
      mockSuperChartProps(props);
      if (mockRenderSelectPlugin) {
        const SelectPlugin = jest.requireActual<
          typeof import('src/filters/components/Select/SelectFilterPlugin')
        >('src/filters/components/Select/SelectFilterPlugin').default;
        const transform = jest.requireActual<
          typeof import('src/filters/components/Select/transformProps')
        >('src/filters/components/Select/transformProps').default;
        return (
          <SelectPlugin
            {...transform(new original.ChartProps(props))}
            showOverflow={Boolean(props.showOverflow)}
            isRefreshing={Boolean(props.isRefreshing)}
            appSection={original.AppSection.Dashboard}
          />
        );
      }
      return (
        <div data-test="mock-super-chart" data-chart-type={props.chartType}>
          SuperChart
        </div>
      );
    },
    isFeatureEnabled: () => false,
    getClientErrorObject: (...args: unknown[]) =>
      mockGetClientErrorObject(...args),
  };
});

jest.mock('../useFilterOutlined', () => ({
  useFilterOutlined: () => ({
    outlinedFilterId: undefined,
    lastUpdated: 0,
  }),
}));

const mockUseFilterDependencies = jest.fn().mockReturnValue({});
const mockUseTransitiveParentIds = jest.fn().mockReturnValue([]);
jest.mock('./state', () => ({
  useFilterDependencies: (...args: unknown[]) =>
    mockUseFilterDependencies(...args),
  useTransitiveParentIds: (...args: unknown[]) =>
    mockUseTransitiveParentIds(...args),
}));

const mockStore = configureStore([thunk]);

const createMockFilter = (overrides: Partial<Filter> = {}): Filter => ({
  id: 'NATIVE_FILTER-1',
  name: 'Test Filter',
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'country' } }],
  defaultDataMask: {},
  controlValues: {},
  cascadeParentIds: [],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  type: NativeFilterType.NativeFilter,
  description: 'Test filter description',
  ...overrides,
});

const getDefaultStoreState = () => ({
  dashboardInfo: { id: 1 },
  dashboardState: {
    isRefreshing: false,
    isFiltersRefreshing: false,
    directPathToChild: [],
    directPathLastUpdated: 0,
  },
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-1': createMockFilter(),
    },
    filterSets: {},
  },
  dataMask: {},
  charts: {},
  dashboardLayout: { present: {} },
});

const defaultProps = {
  filter: createMockFilter(),
  dataMaskSelected: {},
  onFilterSelectionChange: jest.fn(),
  inView: true,
};

function renderFilterValue(
  propOverrides: Record<string, unknown> = {},
  stateOverrides: Record<string, unknown> = {},
) {
  const state = { ...getDefaultStoreState(), ...stateOverrides };
  const store = mockStore(state);
  const mergedProps = { ...defaultProps, ...propOverrides };
  return render(
    <Provider store={store}>
      <FilterValue {...(mergedProps as typeof defaultProps)} />
    </Provider>,
  );
}

beforeEach(() => {
  mockRenderSelectPlugin = false;
  jest.clearAllMocks();
  // Exercise the real parsing so each rejection shape is handled as in
  // production.
  mockGetClientErrorObject.mockImplementation(
    jest.requireActual('@superset-ui/core').getClientErrorObject,
  );
});

test('semantic range renders without fetching bounds', async () => {
  mockUseTransitiveParentIds.mockReturnValue([]);
  mockUseFilterDependencies.mockReturnValue({});
  mockRequestChartData.mockResolvedValue([{ data: [{ min: 1, max: 2 }] }]);
  renderFilterValue({
    filter: createMockFilter({
      filterType: 'filter_range',
      targets: [
        {
          datasetId: 3,
          datasourceType: DatasourceType.SemanticView,
          column: { name: 'Orders.age' },
        },
      ],
    }),
  });
  await waitFor(() =>
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
  );
  expect(mockRequestChartData).not.toHaveBeenCalled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('renders loading spinner when filter has a data source', () => {
  mockRequestChartData.mockReturnValue(new Promise(() => {}));

  renderFilterValue();

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByTestId('mock-super-chart')).not.toBeInTheDocument();
});

test('renders SuperChart after data loads successfully', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ country: 'US' }] }]);

  renderFilterValue();

  await waitFor(() => {
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
  });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('forwards the dashboard async override to the request', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ country: 'US' }] }]);

  renderFilterValue(
    {},
    { dashboardInfo: { id: 1, metadata: { async_mode: 'force_off' } } },
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
  // Filter requests carry the dashboard's override so they follow the same async
  // policy as the dashboard's charts.
  expect(mockRequestChartData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      requestParams: { async_mode_override: 'force_off' },
    }),
  );
});

const FRIENDLY_MESSAGE = 'Sorry, something went wrong. Try again later.';
const NETWORK_MESSAGE = 'Network error while attempting to fetch resource';

// The compact ErrorAlert shows only its title inline; the message is in a
// hover tooltip and a click-to-open modal. Open both so every rendered
// surface is checked.
async function expectErrorAlert(title: string, message: string) {
  const trigger = await screen.findByText(title);
  await userEvent.hover(trigger);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    `${title}: ${message}`,
  );
  await userEvent.click(trigger);
  expect(await screen.findByRole('dialog')).toHaveTextContent(message);
}

function expectNotInDocument(...fragments: string[]) {
  fragments.forEach(fragment => {
    expect(document.body.textContent).not.toContain(fragment);
  });
}

test('renders error state when API call fails', async () => {
  mockRequestChartData.mockRejectedValue(
    new Response(JSON.stringify({ message: 'Server Error' }), { status: 500 }),
  );

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument('Server Error', 'Network error');
});

test('does not expose database error details without an error_type', async () => {
  const dbError =
    'Error: Received ClickHouse exception, code: 396, DB::Exception: Limit for temporary files size exceeded. (TOO_MANY_ROWS_OR_BYTES) (for url https://db.internal:8443)';
  mockRequestChartData.mockRejectedValue(
    new Response(JSON.stringify({ errors: [{ message: dbError }] }), {
      status: 500,
    }),
  );

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument(
    'ClickHouse',
    'DB::Exception',
    'TOO_MANY_ROWS_OR_BYTES',
    '396',
    'db.internal',
    'Network error',
  );
});

test('does not expose the message of a server-side failure without a response body', async () => {
  // e.g. the async query path rejecting after a query task failed
  mockRequestChartData.mockRejectedValue(new Error('some server message'));

  renderFilterValue();

  await expectErrorAlert('Cannot load filter', FRIENDLY_MESSAGE);
  expectNotInDocument('some server message', 'Network error');
});

test.each([
  ['Chromium', 'Failed to fetch'],
  ['Firefox', 'NetworkError when attempting to fetch resource.'],
  ['Safari', 'Load failed'],
])(
  'shows the network error when the request gets no response (%s)',
  async (_browser, fetchMessage) => {
    mockRequestChartData.mockRejectedValue(new TypeError(fetchMessage));

    renderFilterValue();

    await expectErrorAlert('Network error', NETWORK_MESSAGE);
    expectNotInDocument('Cannot load filter', FRIENDLY_MESSAGE);
  },
);

test('does not fetch data when filter has not been in view', () => {
  renderFilterValue({ inView: false });

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('fetches data when inView is false if filter has requiredFirst', () => {
  mockRequestChartData.mockReturnValue(new Promise(() => {}));
  const requiredFirstFilter = createMockFilter({
    requiredFirst: true,
  });
  renderFilterValue({ filter: requiredFirstFilter, inView: false });

  expect(mockRequestChartData).toHaveBeenCalled();
});

test('does not fetch data when inView is false if filter is filter_time even with requiredFirst', () => {
  const requiredFirstTimeFilter = createMockFilter({
    requiredFirst: true,
    filterType: 'filter_time',
  });
  renderFilterValue({ filter: requiredFirstTimeFilter, inView: false });

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('does not render loading spinner when filter has no data source', () => {
  const filterWithoutDataSource = createMockFilter({
    targets: [{ column: { name: 'country' } }],
  });
  mockRequestChartData.mockReturnValue(new Promise(() => {}));

  renderFilterValue({ filter: filterWithoutDataSource });

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument();
});

const defaultFirstItemParentFilter = createMockFilter({
  id: 'NATIVE_FILTER-PARENT',
  controlValues: { defaultToFirstItem: true },
});
const guardChildFilter = createMockFilter({
  id: 'NATIVE_FILTER-CHILD',
  cascadeParentIds: ['NATIVE_FILTER-PARENT'],
});
const stateWithDefaultFirstItemParent = {
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-CHILD': guardChildFilter,
      'NATIVE_FILTER-PARENT': defaultFirstItemParentFilter,
    },
    filterSets: {},
  },
};

test('guard: does not fetch while a defaultToFirstItem parent has not yet auto-selected', () => {
  // Reproduces sc-108451: B should not fetch from unfiltered data before A selects.
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({});

  renderFilterValue(
    {
      filter: guardChildFilter,
      // Parent entry exists but filterState.value is undefined (no selection yet).
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': { filterState: {}, extraFormData: {} },
      },
    },
    stateWithDefaultFirstItemParent,
  );

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('guard: fetches once a defaultToFirstItem parent has set its first value', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [{ model: 'Corolla' }] }]);
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
  });

  renderFilterValue(
    {
      filter: guardChildFilter,
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': {
          // Parent has auto-selected its first value → guard should pass.
          filterState: { value: ['Toyota'] },
          extraFormData: {
            filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
          },
        },
      },
    },
    stateWithDefaultFirstItemParent,
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
});

test('guard: does not block fetch for a parent without defaultToFirstItem', async () => {
  // Non-defaultToFirstItem parents with values should pass the guard as before.
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
  });

  const regularParent = createMockFilter({ id: 'NATIVE_FILTER-PARENT' });

  renderFilterValue(
    {
      filter: guardChildFilter,
      dataMaskSelected: {
        'NATIVE_FILTER-PARENT': {
          filterState: { value: ['Toyota'] },
          extraFormData: {
            filters: [{ col: 'make', op: 'IN', val: ['Toyota'] }],
          },
        },
      },
    },
    {
      nativeFilters: {
        filters: {
          'NATIVE_FILTER-CHILD': guardChildFilter,
          'NATIVE_FILTER-PARENT': regularParent,
        },
        filterSets: {},
      },
    },
  );

  await waitFor(() => {
    expect(mockRequestChartData).toHaveBeenCalled();
  });
});

test('skips data fetch when cascade parent filters have no values selected', () => {
  // useFilterDependencies returns dependencies with a filter (from parent defaults),
  // but dataMaskSelected has no extraFormData for the parent -- counts disagree, so
  // the component skips the fetch.
  mockUseFilterDependencies.mockReturnValue({
    filters: [{ col: 'region', op: 'IN', val: ['US'] }],
  });
  mockUseTransitiveParentIds.mockReturnValue(['NATIVE_FILTER-PARENT']);

  const childFilter = createMockFilter({
    id: 'NATIVE_FILTER-CHILD',
    cascadeParentIds: ['NATIVE_FILTER-PARENT'],
  });

  const stateWithParent = {
    nativeFilters: {
      filters: {
        'NATIVE_FILTER-CHILD': childFilter,
        'NATIVE_FILTER-PARENT': createMockFilter({
          id: 'NATIVE_FILTER-PARENT',
        }),
      },
      filterSets: {},
    },
  };

  renderFilterValue(
    {
      filter: childFilter,
      dataMaskSelected: {},
    },
    stateWithParent,
  );

  expect(mockRequestChartData).not.toHaveBeenCalled();
});

test('legacy permalink values require an explicit reset before the plugin can emit current identity', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  const onFilterSelectionChange = jest.fn();
  const filter = {
    ...createMockFilter({
      targets: [
        {
          datasetId: 7,
          datasourceType: DatasourceType.SemanticView,
          column: { name: 'Orders.status' },
          semantic_selection_version: 'cube-member-id-v1',
        },
      ],
    }),
    dataMask: { filterState: { value: ['Orders.status'] }, extraFormData: {} },
  };
  renderFilterValue({ filter, onFilterSelectionChange });
  expect(screen.getByText('Reselect saved filter values')).toBeInTheDocument();
  const warning = screen.getByRole('alert');
  const section = warning.querySelector('.ant-alert-section') as HTMLElement;
  const actions = warning.querySelector('.ant-alert-actions') as HTMLElement;
  // JSDOM does not lay out flex items; pin the wrapping and sizing mechanism.
  expect(warning.style.flexWrap).toBe('wrap');
  expect(section.style.flex).toBe('1 1 0%');
  expect(actions.style.marginInlineStart).toBe('0');
  expect(actions.style.maxWidth).toBe('100%');
  expect(actions.style.flexBasis).toBe('100%');
  expect(actions.style.order).toBe('1');
  const resetButton = screen.getByRole('button', {
    name: 'Reset and reselect values',
  });
  expect(actions).toContainElement(resetButton);
  expect(resetButton).toHaveStyleRule('white-space', 'normal');
  expect(resetButton).toHaveStyleRule('min-height', '32px');
  expect(resetButton).toHaveStyleRule('padding-block', '4px');
  expect(screen.queryByTestId('mock-super-chart')).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Reset and reselect values' }),
  );
  expect(onFilterSelectionChange).toHaveBeenCalledWith(filter, {
    filterState: {},
    ownState: {},
    extraFormData: {
      semantic_selection_sources: [
        { datasource: '7__semantic_view', version: 'cube-member-id-v1' },
      ],
    },
  });
});

test('semantic select still requests chart data for its options', async () => {
  mockUseTransitiveParentIds.mockReturnValue([]);
  mockUseFilterDependencies.mockReturnValue({});
  mockRequestChartData.mockResolvedValue([
    { data: [{ 'Orders.status': 'Open' }] },
  ]);
  renderFilterValue({
    filter: createMockFilter({
      filterType: 'filter_select',
      targets: [
        {
          datasetId: 3,
          datasourceType: DatasourceType.SemanticView,
          column: { name: 'Orders.status' },
        },
      ],
    }),
  });
  await waitFor(() => expect(mockRequestChartData).toHaveBeenCalled());
  expect(mockRequestChartData.mock.calls[0][0].formData).toEqual(
    expect.objectContaining({
      datasource: '3__semantic_view',
      viz_type: 'filter_select',
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
  );
});

const semanticGrainControl = (semantic_selection_version?: string) =>
  createMockFilter({
    id: 'CHART_CUSTOMIZATION-grain',
    filterType: 'chart_customization_timegrain',
    targets: [
      {
        datasetId: 3,
        datasourceType: DatasourceType.SemanticView,
        semantic_selection_version,
      },
    ],
  });

async function emitFromPlugin(
  filter: Filter,
  dataMask: DataMask,
): Promise<jest.Mock> {
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  const onFilterSelectionChange: jest.Mock = jest.fn();
  renderFilterValue({ filter, onFilterSelectionChange });
  await waitFor(() =>
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
  );
  expect(mockSuperChartProps).toHaveBeenCalled();
  const [props] = mockSuperChartProps.mock.lastCall as [
    { hooks: { setDataMask: (mask: DataMask) => void } },
  ];
  props.hooks.setDataMask(dataMask);
  return onFilterSelectionChange;
}

test.each([undefined, 'cube-member-id-v1'])(
  'a grain-only value carries no selection provenance (target version %s)',
  async version => {
    const filter: Filter = semanticGrainControl(version);
    const mask: DataMask = {
      filterState: { value: ['P1Y'] },
      extraFormData: { time_grain_sqla: 'P1Y' },
    };
    const onFilterSelectionChange: jest.Mock = await emitFromPlugin(
      filter,
      mask,
    );
    expect(onFilterSelectionChange).toHaveBeenCalledWith(filter, mask);
  },
);

test('a semantic member selection is still stamped with its provenance', async () => {
  const filter: Filter = createMockFilter({
    filterType: 'filter_select',
    targets: [
      {
        datasetId: 3,
        datasourceType: DatasourceType.SemanticView,
        column: { name: 'Orders.status' },
      },
    ],
  });
  const filters = [{ col: 'Orders.status', op: 'IN' as const, val: ['Open'] }];
  const onFilterSelectionChange: jest.Mock = await emitFromPlugin(filter, {
    filterState: { value: ['Open'] },
    extraFormData: { filters },
  });
  expect(onFilterSelectionChange).toHaveBeenCalledWith(filter, {
    filterState: { value: ['Open'] },
    extraFormData: {
      filters,
      semantic_selection_sources: [
        { datasource: '3__semantic_view', version: null },
      ],
    },
  });
});

test('a saved grain-only value is not reported as a stale selection', async () => {
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  renderFilterValue({
    filter: {
      ...semanticGrainControl('cube-member-id-v1'),
      // Persisted before grain-only values stopped carrying provenance.
      dataMask: {
        filterState: { value: ['P1Y'] },
        extraFormData: {
          time_grain_sqla: 'P1Y',
          semantic_selection_sources: [
            { datasource: '3__semantic_view', version: null },
          ],
        },
      },
    },
  });
  await waitFor(() =>
    expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
  );
  expect(
    screen.queryByText('Reselect saved filter values'),
  ).not.toBeInTheDocument();
});

const grainControlOfType = (
  filterType: string,
  semantic_selection_version?: string,
): Filter =>
  createMockFilter({
    id:
      filterType === 'filter_timegrain'
        ? 'NATIVE_FILTER-grain'
        : 'CHART_CUSTOMIZATION-grain',
    filterType,
    targets: [
      {
        datasetId: 3,
        datasourceType: DatasourceType.SemanticView,
        semantic_selection_version,
      },
    ],
  });

const versionAfterApplying = (emitted: DataMask): string | undefined =>
  buildQueryObject({
    datasource: '3__semantic_view',
    viz_type: 'table',
    semantic_selection_version: 'cube-member-id-v1',
    extra_form_data: mergeExtraFormData({}, emitted.extraFormData),
  }).extras?.semantic_selection_version;

test.each(['chart_customization_timegrain', 'filter_timegrain'])(
  'clearing a %s control restores the chart identity',
  async filterType => {
    const onFilterSelectionChange: jest.Mock = await emitFromPlugin(
      grainControlOfType(filterType),
      { extraFormData: {}, filterState: { value: null, label: undefined } },
    );
    const emitted: DataMask = onFilterSelectionChange.mock.lastCall![1];
    expect(emitted.extraFormData?.semantic_selection_sources).toBeUndefined();
    expect(versionAfterApplying(emitted)).toBe('cube-member-id-v1');
  },
);

test.each(['chart_customization_timegrain', 'filter_timegrain'])(
  'a %s control saved without a default is not a stale selection',
  async filterType => {
    mockRequestChartData.mockResolvedValue([{ data: [] }]);
    renderFilterValue({
      filter: {
        ...grainControlOfType(filterType, 'cube-member-id-v1'),
        dataMask: { filterState: { value: null }, extraFormData: {} },
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
    );
    expect(
      screen.queryByText('Reselect saved filter values'),
    ).not.toBeInTheDocument();
  },
);

test('clearing a semantic member filter still carries its provenance', async () => {
  const filter: Filter = createMockFilter({
    filterType: 'filter_select',
    targets: [
      {
        datasetId: 3,
        datasourceType: DatasourceType.SemanticView,
        column: { name: 'Orders.status' },
      },
    ],
  });
  const onFilterSelectionChange: jest.Mock = await emitFromPlugin(filter, {
    extraFormData: {},
    filterState: { value: null },
  });
  const emitted: DataMask = onFilterSelectionChange.mock.lastCall![1];
  expect(emitted.extraFormData?.semantic_selection_sources).toEqual([
    { datasource: '3__semantic_view', version: null },
  ]);
});

test.each([false, true])(
  'ordinary native values remain excluded after plugin emission (select first: %s)',
  async defaultToFirstItem => {
    const filter = createMockFilter({ controlValues: { defaultToFirstItem } });
    const mask: DataMask = {
      filterState: { value: ['US'] },
      extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['US'] }] },
    };
    let change: jest.Mock;
    if (defaultToFirstItem) {
      mockRenderSelectPlugin = true;
      mockRequestChartData.mockResolvedValue([
        {
          data: [{ country: 'US' }, { country: 'CA' }],
          colnames: ['country'],
          coltypes: [1],
        },
      ]);
      change = jest.fn();
      renderFilterValue({ filter, onFilterSelectionChange: change });
      await waitFor(() =>
        expect(change).toHaveBeenCalledWith(
          filter,
          expect.objectContaining({
            filterState: expect.objectContaining({ value: ['US'] }),
          }),
        ),
      );
    } else {
      change = await emitFromPlugin(filter, mask);
    }
    const emitted: DataMask = change.mock.lastCall[1];
    const result = getFormDataWithExtraFilters({
      chart: {
        id: 99,
        form_data: {
          datasource: '3__semantic_view',
          viz_type: 'table',
          semantic_selection_version: 'cube-member-id-v1',
        },
      },
      chartConfiguration: {},
      filters: {},
      sliceId: 99,
      nativeFilters: { [filter.id]: { ...filter, chartsInScope: [99] } },
      dataMask: { [filter.id]: { id: filter.id, ...emitted } },
      extraControls: {},
      allSliceIds: [99],
    });
    expect(result.extra_form_data?.filters ?? []).toEqual([]);
    expect(
      buildQueryObject({
        extra_form_data: result.extra_form_data,
        semantic_selection_version: result.semantic_selection_version,
        datasource: '3__semantic_view',
        viz_type: 'table',
      }).extras?.semantic_selection_version,
    ).toBe('cube-member-id-v1');
  },
);

test.each([
  ['never initialized', 'filter_select', undefined],
  ['Clear all select', 'filter_select', null],
  ['empty select', 'filter_select', []],
  ['Clear all range', 'filter_range', [null, null]],
])(
  '%s empty state is not a legacy saved selection',
  async (_label, filterType, value) => {
    mockRequestChartData.mockResolvedValue([{ data: [] }]);
    const filter = {
      ...createMockFilter({
        filterType,
        targets: [
          {
            datasetId: 7,
            datasourceType: DatasourceType.SemanticView,
            column: { name: 'Orders.status' },
            semantic_selection_version: 'member-id-v1',
          },
        ],
      }),
      dataMask: { filterState: { value }, extraFormData: {} },
    };
    renderFilterValue({ filter });
    expect(
      screen.queryByText('Reselect saved filter values'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('mock-super-chart')).toBeInTheDocument(),
    );
  },
);

test('nonempty unversioned saved values still require reset', () => {
  mockRequestChartData.mockResolvedValue([{ data: [] }]);
  const filter = {
    ...createMockFilter({
      targets: [
        {
          datasetId: 7,
          datasourceType: DatasourceType.SemanticView,
          column: { name: 'Orders.status' },
          semantic_selection_version: 'member-id-v1',
        },
      ],
    }),
    dataMask: { filterState: { value: ['legacy'] }, extraFormData: {} },
  };
  renderFilterValue({ filter });
  expect(screen.getByText('Reselect saved filter values')).toBeInTheDocument();
});

test.each([
  { value: '' },
  { value: [0] },
  { value: { key: 'legacy' } },
  { value: [null, 5], filterType: 'filter_range' },
  { value: [5, null], filterType: 'filter_range' },
  {
    value: [null, null],
    filterType: 'filter_range',
    extraFormData: {
      filters: [{ col: 'Orders.amount', op: '>' as const, val: 5 }],
    },
  },
  { value: 0 },
  { value: false },
  { value: [null] },
  { value: [null, null], filterType: 'filter_select' },
  {
    value: null,
    extraFormData: {
      filters: [{ col: 'Orders.status', op: 'IN' as const, val: ['AIR'] }],
    },
  },
  {
    value: null,
    extraFormData: { custom_form_data: { groupby: ['Orders.status'] } },
  },
  {
    value: null,
    extraFormData: {
      semantic_selection_sources: [
        { datasource: '7__semantic_view', version: 'old' },
      ],
    },
  },
  {
    value: [],
    extraFormData: {
      semantic_selection_sources: [
        { datasource: '8__semantic_view', version: 'member-id-v1' },
      ],
    },
  },
])(
  'empty-looking or genuine legacy selection still warns: %j',
  ({ value, extraFormData = {}, filterType = 'filter_select' }) => {
    mockRequestChartData.mockResolvedValue([{ data: [] }]);
    renderFilterValue({
      filter: {
        ...createMockFilter({
          filterType,
          targets: [
            {
              datasetId: 7,
              datasourceType: DatasourceType.SemanticView,
              column: { name: 'Orders.status' },
              semantic_selection_version: 'member-id-v1',
            },
          ],
        }),
        dataMask: { filterState: { value }, extraFormData },
      },
    });
    expect(
      screen.getByText('Reselect saved filter values'),
    ).toBeInTheDocument();
  },
);

test.each([undefined, 'member-id-v1'])(
  'an unmounted clear has the same chart-side provenance as plugin emission (version %s)',
  async version => {
    const filter = createMockFilter({
      targets: [
        {
          datasetId: 3,
          datasourceType: DatasourceType.SemanticView,
          semantic_selection_version: version,
          column: { name: 'Orders.status' },
        },
      ],
    });
    const empty: DataMask = { filterState: { value: null }, extraFormData: {} };
    const beforeMount = withNativeFilterProvenance(
      empty,
      filter.filterType,
      filter.targets[0],
    );
    expect(mockSuperChartProps).not.toHaveBeenCalled();
    const onChange = await emitFromPlugin(filter, empty);
    const mounted: DataMask = onChange.mock.lastCall![1];
    expect(beforeMount).toEqual(mounted);
    expect(beforeMount.extraFormData?.semantic_selection_sources).toEqual([
      { datasource: '3__semantic_view', version: version ?? null },
    ]);
    for (const [datasource, chartVersion] of [
      ['3__semantic_view', 'member-id-v1'],
      ['4__semantic_view', 'member-id-v1'],
      ['3__semantic_view', 'another-version'],
    ]) {
      for (const mask of [beforeMount, mounted]) {
        expect(
          buildQueryObject({
            datasource,
            viz_type: 'table',
            semantic_selection_version: chartVersion,
            extra_form_data: mergeExtraFormData({}, mask.extraFormData),
          }).extras?.semantic_selection_version,
        ).toBe(
          datasource === '3__semantic_view' && version === chartVersion
            ? chartVersion
            : 'unverified-external-selections',
        );
      }
    }
  },
);
