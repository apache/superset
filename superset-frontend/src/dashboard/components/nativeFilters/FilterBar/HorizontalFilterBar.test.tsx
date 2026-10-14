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
import { NativeFilterType, Preset } from '@superset-ui/core';
import type { DataMaskStateWithId, Filter } from '@superset-ui/core';
import { SelectFilterPlugin } from 'src/filters/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import type { DashboardInfo, DashboardLayout } from 'src/dashboard/types';
import {
  useDashboardInfoStore,
  useDashboardLayoutStore,
  useDashboardStateStore,
  useNativeFiltersStore,
  type FilterEntry,
} from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { createSelectNativeFilter } from 'spec/fixtures/mockNativeFilters';
import HorizontalBar from './Horizontal';
import type { HorizontalBarProps } from './types';

// Register the select filter plugin once so FilterControl can render the
// filter name without throwing when the plugin registry is consulted.
class HorizontalFilterBarTestPreset extends Preset {
  constructor() {
    super({
      name: 'Horizontal filter bar test preset',
      plugins: [new SelectFilterPlugin().configure({ key: 'filter_select' })],
    });
  }
}
new HorizontalFilterBarTestPreset().register();

const defaultProps = {
  actions: null,
  canEdit: true,
  dashboardId: 1,
  dataMaskSelected: {},
  filterValues: [],
  chartCustomizationValues: [],
  isInitialized: true,
  onSelectionChange: jest.fn(),
  onPendingCustomizationDataMaskChange: jest.fn(),
};

const renderWrapper = (overrideProps?: Partial<HorizontalBarProps>) =>
  waitFor(() =>
    render(<HorizontalBar {...defaultProps} {...overrideProps} />, {
      useRedux: true,
      useRouter: true,
      initialState: {
        dashboardState: {
          sliceIds: [],
        },
        dashboardInfo: {
          dash_edit_perm: true,
        },
        dashboardLayout: {
          present: {},
          past: [],
          future: [],
        },
      },
    }),
  );

test('should render', async () => {
  const { container } = await renderWrapper();
  expect(container).toBeInTheDocument();
});

test('should not render the empty message', async () => {
  await renderWrapper({
    // Intentionally minimal — Horizontal only reads filterValues.length
    // here, so the missing required Filter fields would never be read.
    filterValues: [
      {
        id: 'test',
        type: NativeFilterType.NativeFilter,
      } as unknown as Filter,
    ],
  });
  expect(
    screen.queryByText('No filters are currently added to this dashboard.'),
  ).not.toBeInTheDocument();
});

test('should render the empty message', async () => {
  await renderWrapper();
  expect(
    screen.getByText('No filters are currently added to this dashboard.'),
  ).toBeInTheDocument();
});

test('should not render the loading icon', async () => {
  await renderWrapper();
  expect(
    screen.queryByRole('status', { name: 'Loading' }),
  ).not.toBeInTheDocument();
});

test('should render the loading icon', async () => {
  await renderWrapper({
    isInitialized: false,
  });
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
});

// --- Tests migrated from disabled Cypress spec
//     `_skip.horizontalFilterBar.test.ts` (sc-107387). ---

const buildStateWithFilters = (
  filters: ReturnType<typeof createSelectNativeFilter>[],
) => ({
  dashboardState: {
    sliceIds: [],
    activeTabs: ['ROOT_ID'],
  },
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    // Orientation is read via selectFilterBarOrientation (metadata), so child
    // FilterControls renders horizontally inside the horizontal bar.
    metadata: {
      native_filter_configuration: filters,
      filter_bar_orientation: FilterBarOrientation.Horizontal,
    },
  },
  dashboardLayout: {
    present: {
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: [] },
    },
    past: [],
    future: [],
  },
  charts: {},
  nativeFilters: {
    filters: filters.reduce(
      (acc, f) => ({ ...acc, [f.id]: f }),
      {} as Record<string, ReturnType<typeof createSelectNativeFilter>>,
    ),
    filtersState: {},
  },
  dataMask: filters.reduce(
    (acc, f) => ({
      ...acc,
      [f.id]: { id: f.id, filterState: { value: null }, extraFormData: {} },
    }),
    {} as Record<string, unknown>,
  ),
  sliceEntities: { slices: {} },
  datasources: {},
});

const renderWithFilters = (
  filters: ReturnType<typeof createSelectNativeFilter>[],
  overrideProps?: Partial<HorizontalBarProps>,
) => {
  const state = buildStateWithFilters(filters);
  // The bar reads these from Zustand, not the Redux initialState.
  useDashboardInfoStore.setState({
    dashboardInfo: state.dashboardInfo as unknown as DashboardInfo,
  });
  useDashboardStateStore.setState({ activeTabs: ['ROOT_ID'] });
  useDashboardLayoutStore.setState({
    layout: state.dashboardLayout.present as unknown as DashboardLayout,
  });
  useNativeFiltersStore.setState({
    filters: state.nativeFilters.filters as unknown as Record<
      string,
      FilterEntry
    >,
  });
  useDataMaskStore.setState({
    dataMask: state.dataMask as DataMaskStateWithId,
  });
  return render(<HorizontalBar {...defaultProps} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
    initialState: state,
  });
};

test('renders default actions slot, settings gear, and empty message together in horizontal mode', async () => {
  const sentinelActions = (
    <button type="button" data-test="sentinel-actions">
      apply
    </button>
  );
  // The bar reads these from Zustand, not the Redux initialState.
  useDashboardInfoStore.setState({
    dashboardInfo: {
      id: 1,
      dash_edit_perm: true,
      metadata: { filter_bar_orientation: FilterBarOrientation.Horizontal },
    } as unknown as DashboardInfo,
  });
  useNativeFiltersStore.setState({ filters: {} });
  useDataMaskStore.setState({ dataMask: {} });

  await waitFor(() =>
    render(
      <HorizontalBar
        {...defaultProps}
        actions={sentinelActions}
        filterValues={[]}
      />,
      {
        useRedux: true,
        useRouter: true,
        initialState: {
          dashboardState: { sliceIds: [] },
          dashboardInfo: {
            id: 1,
            dash_edit_perm: true,
            filterBarOrientation: FilterBarOrientation.Horizontal,
          },
          dashboardLayout: { present: {}, past: [], future: [] },
        },
      },
    ),
  );

  expect(
    screen.getByText('No filters are currently added to this dashboard.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'setting' })).toBeInTheDocument();
  expect(screen.getByTestId('sentinel-actions')).toBeInTheDocument();
});

test('renders all native filters supplied via filterValues in horizontal mode', async () => {
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'test_1', 'country_name'),
    createSelectNativeFilter('NATIVE_FILTER-2', 'test_2', 'country_code'),
    createSelectNativeFilter('NATIVE_FILTER-3', 'test_3', 'region'),
  ];

  renderWithFilters(filters, { filterValues: filters });

  await waitFor(() => {
    const filterNames = screen.getAllByTestId('filter-control-name');
    expect(filterNames).toHaveLength(3);
  });

  ['test_1', 'test_2', 'test_3'].forEach(name => {
    expect(screen.getByText(name)).toBeInTheDocument();
  });
});

test('omits the empty message when at least one filter value is supplied', async () => {
  // Companion to the "renders all native filters" test above: the migrated
  // Cypress "display newly added filter" scenario reduces, at this layer, to
  // proving that supplying a filter value flips off the empty state. The
  // upstream user flow (open edit modal, add filter, save) is integration
  // territory and not covered here.
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'just_added', 'country_name'),
  ];

  renderWithFilters(filters, { filterValues: filters });

  await waitFor(() => {
    expect(screen.getByText('just_added')).toBeInTheDocument();
  });
  expect(
    screen.queryByText('No filters are currently added to this dashboard.'),
  ).not.toBeInTheDocument();
});
