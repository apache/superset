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
import { Preset } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import chartQueries from 'spec/fixtures/mockChartQueries';
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import mockDatasource, { datasourceId, id } from 'spec/fixtures/mockDatasource';
import { buildNativeFilter } from 'spec/fixtures/mockNativeFilters';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  RangeFilterPlugin,
  SelectFilterPlugin,
  TimeColumnFilterPlugin,
  TimeFilterPlugin,
  TimeGrainFilterPlugin,
} from 'src/filters/components';
import FiltersConfigModal, {
  FiltersConfigModalProps,
} from './FiltersConfigModal';

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new TimeColumnFilterPlugin().configure({ key: 'filter_timecolumn' }),
        new TimeGrainFilterPlugin().configure({ key: 'filter_timegrain' }),
      ],
    });
  }
}

const defaultState = () => ({
  datasources: { ...mockDatasource },
  charts: chartQueries,
});

const noTemporalColumnsState = () => {
  const state = defaultState();
  return {
    charts: {
      ...state.charts,
    },
    datasources: {
      ...state.datasources,
      [datasourceId]: {
        ...state.datasources[datasourceId],
        column_types: [0, 1],
      },
    },
  };
};

const datasetResult = (id: number) => ({
  description_columns: {},
  id,
  label_columns: {
    columns: 'Columns',
    table_name: 'Table Name',
  },
  result: {
    metrics: [],
    columns: [
      {
        column_name: 'Column A',
        id: 1,
      },
    ],
    table_name: 'birth_names',
    id,
  },
  show_columns: ['id', 'table_name'],
});

fetchMock.get('glob:*/api/v1/dataset/1', datasetResult(1));
fetchMock.get(`glob:*/api/v1/dataset/${id}`, datasetResult(id));

fetchMock.post('glob:*/api/v1/chart/data', {
  result: [
    {
      status: 'success',
      data: [
        { name: 'Aaron', count: 453 },
        { name: 'Abigail', count: 228 },
        { name: 'Adam', count: 454 },
      ],
      applied_filters: [{ column: 'name' }],
    },
  ],
});

const FILTER_TYPE_REGEX = /^filter type$/i;
const FILTER_NAME_REGEX = /^filter name$/i;
const DATASET_REGEX = /^dataset$/i;
const COLUMN_REGEX = /^column$/i;
const VALUE_REGEX = /^value$/i;
const NUMERICAL_RANGE_REGEX = /^numerical range$/i;
const TIME_RANGE_REGEX = /^time range$/i;
const TIME_COLUMN_REGEX = /^time column$/i;
const TIME_GRAIN_REGEX = /^time grain$/i;
const FILTER_SETTINGS_REGEX = /^filter settings$/i;
const DEFAULT_VALUE_REGEX = /^filter has default value$/i;
const MULTIPLE_REGEX = /^can select multiple values$/i;
const FILTER_REQUIRED_REGEX = /^filter value is required/i;
const DEPENDENCIES_REGEX = /^values are dependent on other filters$/i;
const FIRST_VALUE_REGEX = /^select first filter value by default/i;
const INVERSE_SELECTION_REGEX = /^inverse selection/i;
const SEARCH_ALL_REGEX = /^dynamically search all filter values/i;
const PRE_FILTER_REGEX = /^pre-filter available values/i;
const SORT_REGEX = /^sort filter values$/i;
const SAVE_REGEX = /^save$/i;
const NAME_REQUIRED_REGEX = /^name is required$/i;
const COLUMN_REQUIRED_REGEX = /^column is required$/i;
const DEFAULT_VALUE_REQUIRED_REGEX = /^default value is required$/i;
const PRE_FILTER_REQUIRED_REGEX = /^pre-filter is required$/i;
const FILL_REQUIRED_FIELDS_REGEX = /fill all required fields to enable/;
const TIME_RANGE_PREFILTER_REGEX = /^time range$/i;

const props: FiltersConfigModalProps = {
  isOpen: true,
  createNewOnOpen: true,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

beforeAll(() => {
  new MainPreset().register();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function defaultRender(initialState: any = defaultState(), modalProps = props) {
  return render(<FiltersConfigModal {...modalProps} />, {
    initialState,
    useDnd: true,
    useRedux: true,
  });
}

function getCheckbox(name: RegExp) {
  return screen.getByRole('checkbox', { name });
}

function queryCheckbox(name: RegExp) {
  return screen.queryByRole('checkbox', { name });
}

test('renders a value filter type', () => {
  defaultRender();

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.getByText(COLUMN_REGEX)).toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
  expect(getCheckbox(FILTER_REQUIRED_REGEX)).not.toBeChecked();
  expect(queryCheckbox(DEPENDENCIES_REGEX)).not.toBeInTheDocument();
  expect(getCheckbox(FIRST_VALUE_REGEX)).not.toBeChecked();
  expect(getCheckbox(INVERSE_SELECTION_REGEX)).not.toBeChecked();
  expect(getCheckbox(SEARCH_ALL_REGEX)).not.toBeChecked();
  expect(getCheckbox(PRE_FILTER_REGEX)).not.toBeChecked();
  expect(getCheckbox(SORT_REGEX)).not.toBeChecked();

  expect(getCheckbox(MULTIPLE_REGEX)).toBeChecked();
});

test('renders a numerical range filter type', async () => {
  defaultRender();

  userEvent.click(screen.getByText(VALUE_REGEX));

  await waitFor(() => userEvent.click(screen.getByText(NUMERICAL_RANGE_REGEX)));

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.getByText(COLUMN_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_REQUIRED_REGEX)).toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
  expect(getCheckbox(PRE_FILTER_REGEX)).not.toBeChecked();

  expect(queryCheckbox(MULTIPLE_REGEX)).not.toBeInTheDocument();
  expect(queryCheckbox(DEPENDENCIES_REGEX)).not.toBeInTheDocument();
  expect(queryCheckbox(FIRST_VALUE_REGEX)).not.toBeInTheDocument();
  expect(queryCheckbox(INVERSE_SELECTION_REGEX)).not.toBeInTheDocument();
  expect(queryCheckbox(SEARCH_ALL_REGEX)).not.toBeInTheDocument();
  expect(queryCheckbox(SORT_REGEX)).not.toBeInTheDocument();
});

test('renders a time range filter type', async () => {
  defaultRender();

  userEvent.click(screen.getByText(VALUE_REGEX));

  await waitFor(() => userEvent.click(screen.getByText(TIME_RANGE_REGEX)));

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(DATASET_REGEX)).not.toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time column filter type', async () => {
  defaultRender();

  userEvent.click(screen.getByText(VALUE_REGEX));

  await waitFor(() => userEvent.click(screen.getByText(TIME_COLUMN_REGEX)));

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time grain filter type', async () => {
  defaultRender();

  userEvent.click(screen.getByText(VALUE_REGEX));

  await waitFor(() => userEvent.click(screen.getByText(TIME_GRAIN_REGEX)));

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('render time filter types as disabled if there are no temporal columns in the dataset', async () => {
  defaultRender(noTemporalColumnsState());

  userEvent.click(screen.getByText(VALUE_REGEX));

  const timeRange = await screen.findByText(TIME_RANGE_REGEX);
  const timeGrain = await screen.findByText(TIME_GRAIN_REGEX);
  const timeColumn = await screen.findByText(TIME_COLUMN_REGEX);
  const disabledClass = '.ant-select-item-option-disabled';

  expect(timeRange.closest(disabledClass)).toBeInTheDocument();
  expect(timeGrain.closest(disabledClass)).toBeInTheDocument();
  expect(timeColumn.closest(disabledClass)).toBeInTheDocument();
});

test('validates the name', async () => {
  defaultRender();
  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  expect(await screen.findByText(NAME_REQUIRED_REGEX)).toBeInTheDocument();
});

test('validates the column', async () => {
  defaultRender();
  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  expect(await screen.findByText(COLUMN_REQUIRED_REGEX)).toBeInTheDocument();
});

// eslint-disable-next-line jest/no-disabled-tests
test.skip('validates the default value', async () => {
  defaultRender(noTemporalColumnsState());
  expect(await screen.findByText('birth_names')).toBeInTheDocument();
  userEvent.type(screen.getByRole('combobox'), `Column A{Enter}`);
  userEvent.click(getCheckbox(DEFAULT_VALUE_REGEX));
  await waitFor(() => {
    expect(
      screen.queryByText(FILL_REQUIRED_FIELDS_REGEX),
    ).not.toBeInTheDocument();
  });
  expect(
    await screen.findByText(DEFAULT_VALUE_REQUIRED_REGEX),
  ).toBeInTheDocument();
});

test('validates the pre-filter value', async () => {
  jest.useFakeTimers();

  defaultRender();

  userEvent.click(screen.getByText(FILTER_SETTINGS_REGEX));
  userEvent.click(getCheckbox(PRE_FILTER_REGEX));

  jest.runOnlyPendingTimers();
  jest.useRealTimers();

  await waitFor(() => {
    expect(screen.getByText(PRE_FILTER_REQUIRED_REGEX)).toBeInTheDocument();
  });
}, 50000); // Slow-running test, increase timeout to 50 seconds.

// eslint-disable-next-line jest/no-disabled-tests
test.skip("doesn't render time range pre-filter if there are no temporal columns in datasource", async () => {
  defaultRender(noTemporalColumnsState());
  userEvent.click(screen.getByText(DATASET_REGEX));
  await waitFor(() => {
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    userEvent.click(screen.getByText('birth_names'));
  });
  userEvent.click(screen.getByText(FILTER_SETTINGS_REGEX));
  userEvent.click(getCheckbox(PRE_FILTER_REGEX));
  await waitFor(() =>
    expect(
      screen.queryByText(TIME_RANGE_PREFILTER_REGEX),
    ).not.toBeInTheDocument(),
  );
});

test('filters are draggable', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  defaultRender(state, { ...props, createNewOnOpen: false });
  const draggables = document.querySelectorAll('div[draggable=true]');
  expect(draggables.length).toBe(3);
});

/*
  TODO
    adds a new value filter type with all fields filled
    adds a new numerical range filter type with all fields filled
    adds a new time range filter type with all fields filled
    adds a new time column filter type with all fields filled
    adds a new time grain filter type with all fields filled
    collapsible controls opens by default when it is checked
    advanced section opens by default when it has an option checked
    disables the default value when default to first item is checked
    changes the default value options when the column changes
    switches to configuration tab when validation fails
    displays cancel message when there are pending operations
    do not displays cancel message when there are no pending operations
*/

test('deletes a filter', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });
  const removeButtons = screen.getAllByRole('button', {
    name: 'delete',
  });
  userEvent.click(removeButtons[2]);

  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: expect.arrayContaining(['NATIVE_FILTER-3']),
        modified: expect.arrayContaining([]),
        reordered: expect.arrayContaining([]),
      }),
    ),
  );
});

test('deletes a filter including dependencies', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });
  const removeButtons = screen.getAllByRole('button', {
    name: 'delete',
  });
  userEvent.click(removeButtons[1]);
  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: ['NATIVE_FILTER-2'],
        modified: expect.arrayContaining([
          expect.objectContaining({
            id: 'NATIVE_FILTER-1',
          }),
        ]),
        reordered: [],
      }),
    ),
  );
});

test('switches the order between two filters', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
  ];

  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };

  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const draggableFilters = screen.getAllByRole('tab');

  fireEvent.dragStart(draggableFilters[0]);

  fireEvent.dragOver(draggableFilters[1]);

  fireEvent.drop(draggableFilters[1]);

  fireEvent.dragEnd(draggableFilters[0]);

  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: [],
        modified: [],
        reordered: expect.arrayContaining([
          'NATIVE_FILTER-2',
          'NATIVE_FILTER-1',
        ]),
      }),
    ),
  );
});

test('rearranges three filters and deletes one of them', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];

  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };

  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const draggableFilters = screen.getAllByRole('tab');
  const deleteButtons = screen.getAllByRole('button', {
    name: 'delete',
  });
  userEvent.click(deleteButtons[1]);

  fireEvent.dragStart(draggableFilters[0]);
  fireEvent.dragOver(draggableFilters[2]);
  fireEvent.drop(draggableFilters[2]);
  fireEvent.dragEnd(draggableFilters[0]);

  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modified: [],
        deleted: ['NATIVE_FILTER-2'],
        reordered: expect.arrayContaining([
          'NATIVE_FILTER-2',
          'NATIVE_FILTER-3',
          'NATIVE_FILTER-1',
        ]),
      }),
    ),
  );
});

test('modifies the name of a filter', async () => {
  jest.useFakeTimers();
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
  ];

  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };

  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const filterNameInput = screen.getByRole('textbox', {
    name: FILTER_NAME_REGEX,
  });

  userEvent.clear(filterNameInput);
  userEvent.type(filterNameInput, 'New Filter Name');

  jest.runAllTimers();

  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modified: expect.arrayContaining([
          expect.objectContaining({ name: 'New Filter Name' }),
        ]),
      }),
    ),
  );
});

test('prevents saving cyclic dependencies created indirectly', async () => {
  // Test case: Reproduce exact scenario from GitHub issue #33908
  // This test verifies that users cannot create A→B dependency, save it,
  // then later add B→A dependency and save again (which would create a cycle)
  
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  // STEP 1: Set up Filter 1 → depends on Filter 2 (should succeed)
  const filterTabs = screen.getAllByRole('tab');
  await userEvent.click(filterTabs[0]); // Select first filter

  // Enable the dependencies option for Filter 1
  const dependenciesCheckbox = screen.getByRole('checkbox', { name: DEPENDENCIES_REGEX });
  await userEvent.click(dependenciesCheckbox);

  // Set Filter 1 to depend on Filter 2
  const dependencySelect = screen.getByRole('combobox', { name: /values dependent on/i });
  await userEvent.click(dependencySelect);
  const filter2Option = screen.getByText('country');
  await userEvent.click(filter2Option);

  // Save this configuration (should work as there's no cycle yet)
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

  // Verify the save was successful with correct dependency structure
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      filterConfig: expect.objectContaining({
        'NATIVE_FILTER-1': expect.objectContaining({
          dependsOn: ['NATIVE_FILTER-2'], // Filter 1 now depends on Filter 2
        }),
        'NATIVE_FILTER-2': expect.objectContaining({
          dependsOn: [], // Filter 2 has no dependencies
        }),
      }),
    }),
  );

  // Reset mock for second save attempt
  onSave.mockClear();

  // STEP 2: Simulate reopening the modal and trying to create reverse dependency
  // This reproduces the bug scenario: user reopens modal to edit Filter 2
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const filterTabs2 = screen.getAllByRole('tab');
  await userEvent.click(filterTabs2[1]); // Select second filter (Filter 2)

  // Try to set Filter 2 to depend on Filter 1 (creating A→B→A cycle)
  const dependenciesCheckbox2 = screen.getByRole('checkbox', { name: DEPENDENCIES_REGEX });
  await userEvent.click(dependenciesCheckbox2);

  const dependencySelect2 = screen.getByRole('combobox', { name: /values dependent on/i });
  await userEvent.click(dependencySelect2);
  const filter1Option = screen.getByText('state');
  await userEvent.click(filter1Option);

  // STEP 3: Attempt to save the cyclic configuration (should be blocked)
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  // Verify that save was prevented due to cyclic dependency detection
  await waitFor(() => {
    expect(onSave).not.toHaveBeenCalled();
  }, { timeout: 1000 });

  // Verify that user receives appropriate error feedback
  await waitFor(() => {
    expect(screen.getByText(/cyclic dependency detected/i)).toBeInTheDocument();
  }, { timeout: 1000 });

  // Verify that focus is moved to the problematic filter for user guidance
  await waitFor(() => {
    const activeTab = screen.getByRole('tab', { selected: true });
    expect(activeTab).toHaveTextContent('country'); // Should focus on Filter 2
  }, { timeout: 1000 });
});

test('detects immediate cyclic dependency and prevents setup', async () => {
  // Test case: Verify existing real-time validation still works
  // This ensures our fix doesn't break the immediate cycle detection
  
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']), // A depends on B
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  // Try to immediately set Filter 2 to depend on Filter 1 (immediate cycle)
  const filterTabs = screen.getAllByRole('tab');
  await userEvent.click(filterTabs[1]); // Select Filter 2

  // Enable dependencies for Filter 2
  const dependenciesCheckbox = screen.getByRole('checkbox', { name: DEPENDENCIES_REGEX });
  await userEvent.click(dependenciesCheckbox);

  // Attempt to select Filter 1 as dependency (creating immediate cycle)
  const dependencySelect = screen.getByRole('combobox', { name: /values dependent on/i });
  await userEvent.click(dependencySelect);
  const filter1Option = screen.getByText('state');
  await userEvent.click(filter1Option);

  // Verify immediate cycle detection (real-time validation)
  await waitFor(() => {
    expect(screen.getByText(/cyclic dependency detected/i)).toBeInTheDocument();
  }, { timeout: 1000 });

  // Verify save button is not functional when cycle exists
  const saveButton = screen.getByRole('button', { name: SAVE_REGEX });
  await userEvent.click(saveButton);
  
  await waitFor(() => {
    expect(onSave).not.toHaveBeenCalled();
  }, { timeout: 1000 });
});

test('handles complex multi-filter cyclic dependencies', async () => {
  // Test case: Verify detection of indirect cycles through multiple filters
  // Scenario: A→B→C, then try to add C→A (creating A→B→C→A cycle)
  
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']), // A→B
    buildNativeFilter('NATIVE_FILTER-2', 'country', ['NATIVE_FILTER-3']), // B→C  
    buildNativeFilter('NATIVE_FILTER-3', 'city', []), // C (no dependencies)
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  // Try to set Filter 3 (C) to depend on Filter 1 (A), creating A→B→C→A
  const filterTabs = screen.getAllByRole('tab');
  await userEvent.click(filterTabs[2]); // Select Filter 3 (city)

  const dependenciesCheckbox = screen.getByRole('checkbox', { name: DEPENDENCIES_REGEX });
  await userEvent.click(dependenciesCheckbox);

  const dependencySelect = screen.getByRole('combobox', { name: /values dependent on/i });
  await userEvent.click(dependencySelect);
  const filter1Option = screen.getByText('state');
  await userEvent.click(filter1Option);

  // Attempt to save the complex cycle
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  // Verify cycle detection works for complex scenarios
  await waitFor(() => {
    expect(onSave).not.toHaveBeenCalled();
  }, { timeout: 1000 });

  await waitFor(() => {
    expect(screen.getByText(/cyclic dependency detected/i)).toBeInTheDocument();
  }, { timeout: 1000 });
});