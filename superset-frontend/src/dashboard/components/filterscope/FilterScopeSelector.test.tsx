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
  cleanup,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import FilterScopeSelector from './FilterScopeSelector';
import type { DashboardLayout } from 'src/dashboard/types';

// --- Mock child components ---

jest.mock('./FilterFieldTree', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-test="filter-field-tree">
      FilterFieldTree (checked={String(props.checked)})
    </div>
  ),
}));

jest.mock('./FilterScopeTree', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-test="filter-scope-tree">
      FilterScopeTree (checked={String(props.checked)})
    </div>
  ),
}));

// --- Mock utility functions ---

jest.mock('src/dashboard/util/getFilterFieldNodesTree', () => ({
  __esModule: true,
  default: jest.fn(() => [
    {
      value: 'ALL_FILTERS_ROOT',
      label: 'All filters',
      children: [
        {
          value: 1,
          label: 'Filter A',
          children: [
            { value: '1_column_b', label: 'Filter B' },
            { value: '1_column_c', label: 'Filter C' },
          ],
        },
      ],
    },
  ]),
}));

jest.mock('src/dashboard/util/getFilterScopeNodesTree', () => ({
  __esModule: true,
  default: jest.fn(() => [
    {
      value: 'ROOT_ID',
      label: 'All charts',
      children: [{ value: 2, label: 'Chart A' }],
    },
  ]),
}));

jest.mock('src/dashboard/util/getFilterScopeParentNodes', () => ({
  __esModule: true,
  default: jest.fn(() => ['ROOT_ID']),
}));

jest.mock('src/dashboard/util/buildFilterScopeTreeEntry', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock('src/dashboard/util/getKeyForFilterScopeTree', () => ({
  __esModule: true,
  default: jest.fn(() => '1_column_b'),
}));

jest.mock('src/dashboard/util/getSelectedChartIdForFilterScopeTree', () => ({
  __esModule: true,
  default: jest.fn(() => 1),
}));

jest.mock('src/dashboard/util/getFilterScopeFromNodesTree', () => ({
  __esModule: true,
  default: jest.fn(() => ({ scope: ['ROOT_ID'], immune: [] })),
}));

jest.mock('src/dashboard/util/getRevertedFilterScope', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock('src/dashboard/util/activeDashboardFilters', () => ({
  getChartIdsInFilterScope: jest.fn(() => [2, 3]),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockDashboardFilters = {
  1: {
    chartId: 1,
    componentId: 'component-1',
    filterName: 'Filter A',
    datasourceId: 'ds-1',
    directPathToFilter: ['ROOT_ID', 'GRID', 'CHART_1'],
    isDateFilter: false,
    isInstantFilter: false,
    columns: { column_b: undefined, column_c: undefined },
    labels: { column_b: 'Filter B', column_c: 'Filter C' },
    scopes: {
      column_b: { immune: [], scope: ['ROOT_ID'] },
      column_c: { immune: [], scope: ['ROOT_ID'] },
    },
  },
};

const mockLayout: DashboardLayout = {
  ROOT_ID: { children: ['GRID'], id: 'ROOT_ID', type: 'ROOT' },
  GRID: {
    children: ['CHART_1', 'CHART_2'],
    id: 'GRID',
    type: 'GRID',
    parents: ['ROOT_ID'],
  },
  CHART_1: {
    meta: { chartId: 1, sliceName: 'Chart 1' },
    children: [],
    id: 'CHART_1',
    type: 'CHART',
    parents: ['ROOT_ID', 'GRID'],
  },
  CHART_2: {
    meta: { chartId: 2, sliceName: 'Chart 2' },
    children: [],
    id: 'CHART_2',
    type: 'CHART',
    parents: ['ROOT_ID', 'GRID'],
  },
} as unknown as DashboardLayout;

const defaultProps = {
  dashboardFilters: mockDashboardFilters,
  layout: mockLayout,
  updateDashboardFiltersScope: jest.fn(),
  setUnsavedChanges: jest.fn(),
  onCloseModal: jest.fn(),
};

test('renders the header, filter field panel, and scope panel', () => {
  render(<FilterScopeSelector {...defaultProps} />, { useRedux: true });

  expect(screen.getByText('Configure filter scopes')).toBeInTheDocument();
  expect(screen.getByTestId('filter-field-tree')).toBeInTheDocument();
  expect(screen.getByTestId('filter-scope-tree')).toBeInTheDocument();
});

test('renders the search input with correct placeholder', () => {
  render(<FilterScopeSelector {...defaultProps} />, { useRedux: true });

  const searchInput = screen.getByPlaceholderText('Search...');
  expect(searchInput).toBeInTheDocument();
  expect(searchInput).toHaveAttribute('type', 'text');
});

test('renders Close and Save buttons when filters exist', () => {
  render(<FilterScopeSelector {...defaultProps} />, { useRedux: true });

  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

test('renders only Close button and a warning when no filters exist', () => {
  render(<FilterScopeSelector {...defaultProps} dashboardFilters={{}} />, {
    useRedux: true,
  });

  expect(
    screen.getByText('There are no filters in this dashboard.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save' }),
  ).not.toBeInTheDocument();
});

test('does not render FilterFieldTree or FilterScopeTree when no filters exist', () => {
  render(<FilterScopeSelector {...defaultProps} dashboardFilters={{}} />, {
    useRedux: true,
  });

  expect(screen.queryByTestId('filter-field-tree')).not.toBeInTheDocument();
  expect(screen.queryByTestId('filter-scope-tree')).not.toBeInTheDocument();
});

test('calls onCloseModal when Close button is clicked', () => {
  const onCloseModal = jest.fn();
  render(
    <FilterScopeSelector {...defaultProps} onCloseModal={onCloseModal} />,
    { useRedux: true },
  );

  userEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onCloseModal).toHaveBeenCalledTimes(1);
});

test('calls updateDashboardFiltersScope, setUnsavedChanges, and onCloseModal when Save is clicked', () => {
  const updateDashboardFiltersScope = jest.fn();
  const setUnsavedChanges = jest.fn();
  const onCloseModal = jest.fn();

  render(
    <FilterScopeSelector
      {...defaultProps}
      updateDashboardFiltersScope={updateDashboardFiltersScope}
      setUnsavedChanges={setUnsavedChanges}
      onCloseModal={onCloseModal}
    />,
    { useRedux: true },
  );

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(updateDashboardFiltersScope).toHaveBeenCalledTimes(1);
  expect(setUnsavedChanges).toHaveBeenCalledWith(true);
  expect(onCloseModal).toHaveBeenCalledTimes(1);
});

test('renders the editing filters name section with "Editing 1 filter:" label', () => {
  render(<FilterScopeSelector {...defaultProps} />, { useRedux: true });

  expect(screen.getByText('Editing 1 filter:')).toBeInTheDocument();
  // The active filter label should appear (column_b maps to "Filter B")
  expect(screen.getByText('Filter B')).toBeInTheDocument();
});

test('updates search text when typing in the search input', () => {
  render(<FilterScopeSelector {...defaultProps} />, { useRedux: true });

  const searchInput = screen.getByPlaceholderText('Search...');
  userEvent.type(searchInput, 'Chart');

  expect(searchInput).toHaveValue('Chart');
});
