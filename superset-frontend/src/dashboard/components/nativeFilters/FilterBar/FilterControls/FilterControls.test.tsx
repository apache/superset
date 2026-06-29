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
import { render, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import {
  ChartCustomizationType,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterControls from './FilterControls';

const mockStore = configureStore([thunk]);

const mockStoreForCustomization = {
  ...stateWithoutNativeFilters,
  dashboardInfo: {
    ...stateWithoutNativeFilters.dashboardInfo,
    // Orientation is denormalized into metadata; the migrated component reads it
    // via selectFilterBarOrientation (metadata.filter_bar_orientation).
    metadata: {
      ...stateWithoutNativeFilters.dashboardInfo.metadata,
      filter_bar_orientation: FilterBarOrientation.Vertical,
    },
  },
};

beforeEach(() => {
  useDashboardInfoStore.setState({
    dashboardInfo:
      mockStoreForCustomization.dashboardInfo as unknown as DashboardInfo,
  });
});

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(selector => selector(mockStoreForCustomization)),
  useDispatch: () => jest.fn(),
}));

const defaultProps = {
  dataMaskSelected: {},
  onFilterSelectionChange: jest.fn(),
  onPendingCustomizationDataMaskChange: jest.fn(),
  chartCustomizationValues: [],
};

test('renders chart customization divider in vertical mode', () => {
  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Test Divider',
    description: 'Test description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Test Divider' }),
  ).toBeInTheDocument();
});

test('renders multiple chart customization dividers in vertical mode', () => {
  const dividers: ChartCustomizationDivider[] = [
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
      type: ChartCustomizationType.Divider,
      title: 'First Divider',
      description: 'First description',
      removed: false,
    },
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-xyz789',
      type: ChartCustomizationType.Divider,
      title: 'Second Divider',
      description: 'Second description',
      removed: false,
    },
  ];

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={dividers} />,
  );

  expect(
    screen.getByRole('heading', { name: 'First Divider' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Second Divider' }),
  ).toBeInTheDocument();
});

test('renders chart customization divider in horizontal mode', () => {
  useDashboardInfoStore.setState({
    dashboardInfo: {
      ...mockStoreForCustomization.dashboardInfo,
      metadata: {
        ...mockStoreForCustomization.dashboardInfo.metadata,
        filter_bar_orientation: FilterBarOrientation.Horizontal,
      },
    } as unknown as DashboardInfo,
  });

  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Horizontal Divider',
    description: 'Horizontal description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Horizontal Divider' }),
  ).toBeInTheDocument();
  // Proves it actually rendered in horizontal mode: horizontal dividers show
  // the description as a tooltip icon (divider-description-icon), whereas
  // vertical dividers render it inline (divider-description).
  expect(screen.getByTestId('divider-description-icon')).toBeInTheDocument();
  expect(screen.queryByTestId('divider-description')).not.toBeInTheDocument();
});

test('does not render removed chart customization dividers', () => {
  const dividers: ChartCustomizationDivider[] = [
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
      type: ChartCustomizationType.Divider,
      title: 'Visible Divider',
      description: 'Should be visible',
      removed: false,
    },
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-xyz789',
      type: ChartCustomizationType.Divider,
      title: 'Hidden Divider',
      description: 'Should not be visible',
      removed: true,
    },
  ];

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={dividers} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Visible Divider' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Hidden Divider' }),
  ).not.toBeInTheDocument();
});

test('renders divider with description icon in vertical mode when description exists', () => {
  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Divider With Description',
    description: 'This is a detailed description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Divider With Description' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('divider-description')).toBeInTheDocument();
});

test('renders empty state when no chart customizations provided', () => {
  const { container } = render(
    <FilterControls {...defaultProps} chartCustomizationValues={[]} />,
  );

  expect(
    container.querySelector('.chart-customization-item-wrapper'),
  ).not.toBeInTheDocument();
});

const createMockFilter = (id: string, name: string) => ({
  id,
  name,
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'country' } }],
  defaultDataMask: {},
  controlValues: {},
  cascadeParentIds: [],
  scope: {
    rootPath: ['ROOT_ID'],
    excluded: [] as string[],
  },
  isInstant: true,
  allowsMultipleValues: true,
  isRequired: false,
});

const getDefaultState = (orientation: FilterBarOrientation) => ({
  dashboardInfo: {
    id: 1,
    filterBarOrientation: orientation,
  },
  dashboardLayout: {
    present: {
      ROOT_ID: {
        type: 'ROOT',
        id: 'ROOT_ID',
        children: ['TABS-1'],
      },
      'TABS-1': {
        type: 'TABS',
        id: 'TABS-1',
        children: ['TAB-1', 'TAB-2'],
      },
      'TAB-1': {
        type: 'TAB',
        id: 'TAB-1',
        children: ['CHART-1'],
      },
      'TAB-2': {
        type: 'TAB',
        id: 'TAB-2',
        children: ['CHART-2'],
      },
      'CHART-1': {
        type: 'CHART',
        id: 'CHART-1',
        meta: { chartId: 1 },
      },
      'CHART-2': {
        type: 'CHART',
        id: 'CHART-2',
        meta: { chartId: 2 },
      },
    },
  },
  charts: {
    1: { id: 1, formData: {} },
    2: { id: 2, formData: {} },
  },
  dataMask: {},
  nativeFilters: {
    filters: {
      'filter-1': createMockFilter('filter-1', 'Country Filter'),
      'filter-2': createMockFilter('filter-2', 'Region Filter'),
      'filter-3': createMockFilter('filter-3', 'City Filter'),
    },
    filterSets: {},
  },
  dashboardState: {
    directPathToChild: [],
    activeTabs: ['TAB-1'],
    chartCustomizationItems: [],
  },
  sliceEntities: {
    slices: {
      1: {
        slice_id: 1,
        slice_name: 'Chart 1',
        form_data: {},
      },
      2: {
        slice_id: 2,
        slice_name: 'Chart 2',
        form_data: {},
      },
    },
  },
  datasources: {},
});

function setupWithFilters(overrideState: any = {}, props: any = {}) {
  const state = {
    ...getDefaultState(FilterBarOrientation.Vertical),
    ...overrideState,
  };
  const store = mockStore(state) as Store;

  return render(
    <Provider store={store}>
      <FilterControls
        dataMaskSelected={{}}
        onFilterSelectionChange={jest.fn()}
        onPendingCustomizationDataMaskChange={jest.fn()}
        chartCustomizationValues={[]}
        {...props}
      />
    </Provider>,
  );
}

// NOTE: Overflow/orientation behaviour (which filters overflow, overflowedByIndex,
// isOverflowing) is covered meaningfully in FilterControls.overflow.test.tsx,
// which mocks the collapsible bar and drives the overflow callback. jsdom has no
// layout, so it cannot exercise real overflow here — earlier smoke tests that only
// asserted `container.toBeInTheDocument()` were removed as misleading false coverage.

test('FilterControls should handle empty filters list', () => {
  const state = getDefaultState(FilterBarOrientation.Vertical);
  state.nativeFilters.filters = {} as any;

  const { container } = setupWithFilters(state);
  expect(container).toBeInTheDocument();
});

test('does not render "Filters out of scope" when all filters are in scope', () => {
  const state = getDefaultState(FilterBarOrientation.Vertical);

  const { useSelector } = jest.requireMock('react-redux');
  useSelector.mockImplementation((selector: (s: typeof state) => unknown) =>
    selector(state),
  );

  setupWithFilters(state);

  expect(screen.queryByText(/Filters out of scope/)).not.toBeInTheDocument();
});
