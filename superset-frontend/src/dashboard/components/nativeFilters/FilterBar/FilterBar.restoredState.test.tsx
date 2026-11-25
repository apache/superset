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
import { act, createStore, render, screen } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import fetchMock from 'fetch-mock';
import {
  DataMaskStateWithId,
  Filter,
  NativeFilterType,
  Preset,
} from '@superset-ui/core';
import { SelectFilterPlugin } from 'src/filters/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import dataMaskReducer, { HydrateDataMaskAction } from 'src/dataMask/reducer';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import FilterBar from '.';

jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  requestChartDataResolved: jest.fn(),
}));

new (class extends Preset {
  constructor() {
    super({
      name: 'restored-state',
      plugins: [new SelectFilterPlugin().configure({ key: 'filter_select' })],
    });
  }
})().register();

const REGION = 'NATIVE_FILTER-region';
const COUNTRY = 'NATIVE_FILTER-country';

const OPTIONS: Record<string, string[]> = {
  region: ['APAC', 'EMEA'],
  'country|APAC': ['India', 'Japan'],
  'country|EMEA': ['France', 'Germany'],
};

const inFilter = (col: string, value: string) => ({
  filters: [{ col, op: 'IN' as const, val: [value] }],
});

// Option queries are held until the test resolves them, so the test controls
// when each filter's values arrive.
const pendingQueries: { key: string; resolve: () => void }[] = [];
const requestedKeys: string[] = [];

const createFilter = (
  id: string,
  col: string,
  overrides: Partial<Filter>,
): Filter =>
  ({
    id,
    name: col,
    filterType: 'filter_select',
    targets: [{ datasetId: 1, column: { name: col } }],
    cascadeParentIds: [],
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    type: NativeFilterType.NativeFilter,
    description: '',
    chartsInScope: [],
    tabsInScope: [],
    controlValues: {},
    defaultDataMask: {},
    ...overrides,
  }) satisfies Partial<Filter> as Filter;

const regionFilter = createFilter(REGION, 'region', {
  controlValues: { multiSelect: false, enableEmptyFilter: true },
  defaultDataMask: {
    filterState: { value: ['APAC'] },
    extraFormData: inFilter('region', 'APAC'),
  },
});
const countryFilter = createFilter(COUNTRY, 'country', {
  cascadeParentIds: [REGION],
  requiredFirst: true,
  controlValues: {
    multiSelect: false,
    enableEmptyFilter: true,
    defaultToFirstItem: true,
  },
  defaultDataMask: { filterState: {}, extraFormData: {} },
});

beforeEach(() => {
  pendingQueries.length = 0;
  requestedKeys.length = 0;
  fetchMock.post(
    'glob:*/api/v1/dashboard/*/filter_state*',
    { key: 'restored' },
    { name: 'restored-state-post' },
  );
  fetchMock.put(
    'glob:*/api/v1/dashboard/*/filter_state*',
    { key: 'restored' },
    { name: 'restored-state-put' },
  );
  (requestChartDataResolved as jest.Mock).mockImplementation(
    ({ formData }: { formData: Record<string, unknown> }) => {
      const [col] = formData.groupby as string[];
      const extraFormData = formData.extra_form_data as {
        filters?: { val: string[] }[];
      };
      const parentValue = extraFormData?.filters?.[0]?.val?.[0];
      const key = col === 'region' ? 'region' : `country|${parentValue}`;
      requestedKeys.push(key);
      const data = (OPTIONS[key] ?? []).map(value => ({ [col]: value }));
      return new Promise(resolve => {
        pendingQueries.push({
          key,
          resolve: () =>
            resolve([{ data, colnames: [col], coltypes: [1], rowcount: 2 }]),
        });
      });
    },
  );
});

afterEach(() => {
  fetchMock.removeRoute('restored-state-post');
  fetchMock.removeRoute('restored-state-put');
});

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });

// Resolve option queries in the order they are issued until none are left.
async function resolveAllQueries() {
  for (let idle = 0; idle < 5;) {
    const next = pendingQueries.shift();
    if (next) {
      idle = 0;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => next.resolve());
    } else {
      idle += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    await settle();
  }
}

test('restored parent value with the default extraFormData underneath settles its dependent filters on the restored value', async () => {
  // A saved filter state whose Region value is EMEA while its extraFormData is
  // the default's (APAC), with a dependent "select first value" Country whose
  // restored selection is valid for EMEA but is not its first option.
  const savedState: DataMaskStateWithId = {
    [REGION]: {
      id: REGION,
      filterState: { value: ['EMEA'] },
      extraFormData: inFilter('region', 'APAC'),
    },
    [COUNTRY]: {
      id: COUNTRY,
      filterState: {
        value: ['Germany'],
        label: 'Germany',
        excludeFilterValues: true,
      },
      extraFormData: inFilter('country', 'Germany'),
    },
  };
  const metadata = {
    native_filter_configuration: [regionFilter, countryFilter],
    chart_configuration: {},
  };
  const hydrateAction: HydrateDataMaskAction = {
    type: HYDRATE_DASHBOARD,
    data: { dashboardInfo: { metadata }, dataMask: savedState },
  };
  const dataMask = dataMaskReducer({}, hydrateAction);

  const store = createStore(
    {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        filterBarOrientation: FilterBarOrientation.Vertical,
        metadata,
      },
      dashboardState: {
        ...stateWithoutNativeFilters.dashboardState,
        activeTabs: ['ROOT_ID'],
      },
      dataMask,
      nativeFilters: {
        filters: { [REGION]: regionFilter, [COUNTRY]: countryFilter },
        filtersState: {},
      },
    },
    reducerIndex,
  );

  render(
    <FilterBar
      orientation={FilterBarOrientation.Vertical}
      verticalConfig={{
        width: 280,
        height: 400,
        offset: 0,
        filtersOpen: true,
        toggleFiltersBar: jest.fn(),
      }}
    />,
    { store, useRedux: true, useRouter: true, useDnd: true },
  );

  await settle();
  await resolveAllQueries();

  const applied = (store.getState() as Record<string, unknown>)
    .dataMask as DataMaskStateWithId;
  // Charts are filtered on the value the filter bar displays.
  expect(applied[REGION].filterState?.value).toEqual(['EMEA']);
  expect(applied[REGION].extraFormData).toEqual(inFilter('region', 'EMEA'));
  // The dependent filter only loaded options for the restored parent value,
  // so it kept its restored selection instead of picking a first value for
  // the default.
  expect(requestedKeys).toEqual(['region', 'country|EMEA']);
  expect(applied[COUNTRY].filterState?.value).toEqual(['Germany']);
  expect(applied[COUNTRY].extraFormData).toEqual(
    inFilter('country', 'Germany'),
  );
  // Nothing is left pending.
  expect(screen.getByTestId('filter-bar__apply-button')).toBeDisabled();
});
