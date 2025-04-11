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
import { supersetTheme } from '@superset-ui/core';
import {
  cleanup,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import FilterScopeSelector from './FilterScopeSelector';

// Add afterEach cleanup
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

const ROOT_ID = 'ROOT_ID';
const GRID = 'GRID';
const TABS = 'TABS';
const TAB = 'TAB';
const FILTER_A = 'FILTER_A';
const FILTER_B = 'FILTER_B';
const FILTER_C = 'FILTER_C';
const TAB_A = 'TAB_A';
const TAB_B = 'TAB_B';
const CHART_A = 'CHART_A';
const CHART_B = 'CHART_B';
const CHART_C = 'CHART_C';
const CHART_D = 'CHART_D';

const EXPAND_ALL = 'Expand all';
const COLLAPSE_ALL = 'Collapse all';
const CHECKED = 'checked';
const UNCHECKED = 'unchecked';
const INDETERMINATE = 'indeterminate';
const ALL_FILTERS = 'All filters';
const ALL_CHARTS = 'All charts';

const createProps = () => ({
  dashboardFilters: {
    1: {
      chartId: 1,
      componentId: 'component-id',
      datasourceId: 'datasource-id',
      directPathToFilter: [],
      isDateFilter: false,
      isInstantFilter: false,
      filterName: FILTER_A,
      columns: { column_b: undefined, column_c: undefined },
      labels: { column_b: FILTER_B, column_c: FILTER_C },
      scopes: {
        column_b: { immune: [], scope: [ROOT_ID] },
        column_c: { immune: [], scope: [ROOT_ID] },
      },
    },
  },
  layout: {
    ROOT_ID: { children: [GRID], id: ROOT_ID, type: 'ROOT' },
    GRID: {
      children: [TABS],
      id: GRID,
      type: GRID,
      parents: [ROOT_ID],
    },
    TABS: {
      children: [TAB_A, TAB_B],
      id: TABS,
      type: TABS,
      parents: [ROOT_ID, GRID],
    },
    TAB_A: {
      meta: { text: TAB_A },
      children: [CHART_A, CHART_B],
      id: TAB_A,
      type: TAB,
      parents: [ROOT_ID, GRID, TABS],
    },
    TAB_B: {
      meta: { text: TAB_B },
      children: [CHART_C, CHART_D],
      id: TAB_B,
      type: TAB,
      parents: [ROOT_ID, GRID, TABS],
    },
    CHART_A: {
      meta: {
        chartId: 2,
        sliceName: CHART_A,
      },
      children: [],
      id: CHART_A,
      type: 'CHART',
      parents: [ROOT_ID, GRID, TABS, TAB_A],
    },
    CHART_B: {
      meta: {
        chartId: 3,
        sliceName: CHART_B,
      },
      children: [],
      id: CHART_B,
      type: 'CHART',
      parents: [ROOT_ID, GRID, TABS, TAB_A],
    },
    CHART_C: {
      meta: {
        chartId: 4,
        sliceName: CHART_C,
      },
      children: [],
      id: CHART_C,
      type: 'CHART',
      parents: [ROOT_ID, GRID, TABS, TAB_B],
    },
    CHART_D: {
      meta: {
        chartId: 5,
        sliceName: CHART_D,
      },
      children: [],
      id: CHART_D,
      type: 'CHART',
      parents: [ROOT_ID, GRID, TABS, TAB_B],
    },
  },
  updateDashboardFiltersScope: jest.fn(),
  setUnsavedChanges: jest.fn(),
  onCloseModal: jest.fn(),
});

type CheckboxState = 'checked' | 'unchecked' | 'indeterminate';

/**
 * Unfortunately react-checkbox-tree doesn't provide an easy way to
 * access the checkbox icon. We need this function to find the element.
 */
function getCheckboxIcon(element: HTMLElement): Element {
  const parent = element.parentElement!;
  if (parent.classList.contains('rct-text')) {
    return parent.children[1];
  }
  return getCheckboxIcon(parent);
}

/**
 * Unfortunately when using react-checkbox-tree, the only perceived change of a
 * checkbox state change is the fill color of the SVG icon.
 */
function getCheckboxState(name: string): CheckboxState {
  const element = screen.getByRole('link', { name });
  const svgPath = getCheckboxIcon(element).children[1].children[0].children[0];
  const fill = svgPath.getAttribute('fill');
  return fill === supersetTheme.colors.primary.base
    ? CHECKED
    : fill === supersetTheme.colors.grayscale.light1
      ? INDETERMINATE
      : UNCHECKED;
}

// Replace the original clickCheckbox function with the async version
async function clickCheckbox(name: string) {
  const element = screen.getByRole('link', { name });
  const checkboxLabel = getCheckboxIcon(element);
  await userEvent.click(checkboxLabel);
}

test('renders with empty filters', () => {
  render(<FilterScopeSelector {...createProps()} dashboardFilters={{}} />, {
    useRedux: true,
  });
  expect(screen.getByText('Configure filter scopes')).toBeInTheDocument();
  expect(
    screen.getByText('There are no filters in this dashboard.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save' }),
  ).not.toBeInTheDocument();
});

test('renders with filters values', () => {
  render(<FilterScopeSelector {...createProps()} />, { useRedux: true });
  expect(screen.getByRole('link', { name: FILTER_A })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: FILTER_B })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: FILTER_C })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: TAB_A })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: TAB_B })).toBeInTheDocument();
  expect(screen.queryByText(CHART_A)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_B)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_C)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_D)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

test('collapses/expands all filters', () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.click(screen.getAllByRole('button', { name: COLLAPSE_ALL })[0]);
  expect(screen.getByRole('link', { name: ALL_FILTERS })).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: FILTER_A }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: FILTER_B }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: FILTER_C }),
  ).not.toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: EXPAND_ALL })[0]);
  expect(screen.getByRole('link', { name: ALL_FILTERS })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: FILTER_A })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: FILTER_B })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: FILTER_C })).toBeInTheDocument();
});

test('collapses/expands all charts', () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.click(screen.getAllByRole('button', { name: COLLAPSE_ALL })[1]);
  expect(screen.getByText(ALL_CHARTS)).toBeInTheDocument();
  expect(screen.queryByText(CHART_A)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_B)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_C)).not.toBeInTheDocument();
  expect(screen.queryByText(CHART_D)).not.toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: EXPAND_ALL })[1]);
  expect(screen.getByText(ALL_CHARTS)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: CHART_A })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: CHART_B })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: CHART_C })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: CHART_D })).toBeInTheDocument();
});

test('searches for a chart', () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.type(screen.getByPlaceholderText('Search...'), CHART_C);
  expect(screen.queryByRole('link', { name: CHART_A })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: CHART_B })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: CHART_C })).toBeInTheDocument();
});

// Update all tests that use clickCheckbox to be async and await the function call
test('selects a leaf filter', async () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  expect(getCheckboxState(FILTER_C)).toBe(UNCHECKED);
  await clickCheckbox(FILTER_C);
  expect(getCheckboxState(FILTER_C)).toBe(CHECKED);
});

test('selects a leaf chart', async () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.click(screen.getAllByRole('button', { name: EXPAND_ALL })[1]);
  expect(getCheckboxState(CHART_D)).toBe(UNCHECKED);
  await clickCheckbox(CHART_D);
  expect(getCheckboxState(CHART_D)).toBe(CHECKED);
});

test('selects a branch of filters', async () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  expect(getCheckboxState(FILTER_A)).toBe(UNCHECKED);
  expect(getCheckboxState(FILTER_B)).toBe(UNCHECKED);
  expect(getCheckboxState(FILTER_C)).toBe(UNCHECKED);
  await clickCheckbox(FILTER_A);
  expect(getCheckboxState(FILTER_A)).toBe(CHECKED);
  expect(getCheckboxState(FILTER_B)).toBe(CHECKED);
  expect(getCheckboxState(FILTER_C)).toBe(CHECKED);
});

test('selects all filters', async () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.click(screen.getAllByRole('button', { name: EXPAND_ALL })[0]);
  expect(getCheckboxState(ALL_FILTERS)).toBe(UNCHECKED);
  expect(getCheckboxState(FILTER_A)).toBe(UNCHECKED);
  expect(getCheckboxState(FILTER_B)).toBe(UNCHECKED);
  expect(getCheckboxState(FILTER_C)).toBe(UNCHECKED);
  await clickCheckbox(ALL_FILTERS);
  expect(getCheckboxState(ALL_FILTERS)).toBe(CHECKED);
  expect(getCheckboxState(FILTER_A)).toBe(CHECKED);
  expect(getCheckboxState(FILTER_B)).toBe(CHECKED);
  expect(getCheckboxState(FILTER_C)).toBe(CHECKED);
});

test('selects all charts', async () => {
  render(<FilterScopeSelector {...createProps()} />, {
    useRedux: true,
  });
  userEvent.click(screen.getAllByRole('button', { name: EXPAND_ALL })[1]);
  expect(getCheckboxState(TAB_A)).toBe(UNCHECKED);
  expect(getCheckboxState(CHART_A)).toBe(UNCHECKED);
  expect(getCheckboxState(CHART_B)).toBe(UNCHECKED);
  expect(getCheckboxState(TAB_B)).toBe(UNCHECKED);
  expect(getCheckboxState(CHART_C)).toBe(UNCHECKED);
  expect(getCheckboxState(CHART_D)).toBe(UNCHECKED);
  await clickCheckbox(ALL_CHARTS);
  expect(getCheckboxState(TAB_A)).toBe(CHECKED);
  expect(getCheckboxState(CHART_A)).toBe(CHECKED);
  expect(getCheckboxState(CHART_B)).toBe(CHECKED);
  expect(getCheckboxState(TAB_B)).toBe(CHECKED);
  expect(getCheckboxState(CHART_C)).toBe(CHECKED);
  expect(getCheckboxState(CHART_D)).toBe(CHECKED);
});

test('triggers onClose', () => {
  const onCloseModal = jest.fn();
  render(
    <FilterScopeSelector {...createProps()} onCloseModal={onCloseModal} />,
    {
      useRedux: true,
    },
  );
  expect(onCloseModal).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onCloseModal).toHaveBeenCalledTimes(1);
});

test('triggers onSave', () => {
  const updateDashboardFiltersScope = jest.fn();
  const setUnsavedChanges = jest.fn();
  const onCloseModal = jest.fn();
  render(
    <FilterScopeSelector
      {...createProps()}
      updateDashboardFiltersScope={updateDashboardFiltersScope}
      setUnsavedChanges={setUnsavedChanges}
      onCloseModal={onCloseModal}
    />,
    {
      useRedux: true,
    },
  );
  expect(updateDashboardFiltersScope).toHaveBeenCalledTimes(0);
  expect(setUnsavedChanges).toHaveBeenCalledTimes(0);
  expect(onCloseModal).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(updateDashboardFiltersScope).toHaveBeenCalledTimes(1);
  expect(setUnsavedChanges).toHaveBeenCalledTimes(1);
  expect(onCloseModal).toHaveBeenCalledTimes(1);
});
