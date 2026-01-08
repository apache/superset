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
  within,
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
  dashboardLayout: {
    present: {},
    past: [],
    future: [],
  },
});

const noTemporalColumnsState = () => {
  const state = defaultState();
  return {
    ...state,
    datasources: {
      ...state.datasources,
      [datasourceId]: {
        ...state.datasources[datasourceId],
        column_types: [0, 1],
      },
    },
  };
};

const bigIntChartDataState = () => {
  const state = defaultState();
  return {
    ...state,
    charts: {
      ...state.charts,
      999: {
        queriesResponse: [
          {
            status: 'success',
            data: [
              { name: 'Abigail', count: 228 },
              { name: 'Aaron', count: 123012930123123n },
              { name: 'Adam', count: 454 },
            ],
            applied_filters: [{ column: 'name' }],
          },
        ],
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

function setupFetchMocks() {
  fetchMock.get(`glob:*/api/v1/dataset/${id}`, datasetResult(id));
  // Mock dataset 1 for buildNativeFilter fixtures which use datasetId: 1
  fetchMock.get('glob:*/api/v1/dataset/1', datasetResult(1));
  // Mock the dataset list endpoint for the dataset selector dropdown
  // Uses id from mockDatasource (7) to match fixture data
  fetchMock.get('glob:*/api/v1/dataset/?*', {
    result: [
      {
        id,
        table_name: 'birth_names',
        database: { database_name: 'examples' },
        schema: 'public',
      },
    ],
    count: 1,
  });

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
}

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
const PRE_FILTER_REQUIRED_REGEX = /^pre-filter is required$/i;

const props: FiltersConfigModalProps = {
  isOpen: true,
  createNewOnOpen: true,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

beforeAll(() => {
  new MainPreset().register();
});

beforeEach(() => {
  setupFetchMocks();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  fetchMock.restore();
});

function defaultRender(
  initialState: ReturnType<typeof defaultState> = defaultState(),
  modalProps: FiltersConfigModalProps = props,
) {
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

  await userEvent.click(screen.getByText(VALUE_REGEX));

  const numericalRangeOption = await screen.findByText(NUMERICAL_RANGE_REGEX);
  await userEvent.click(numericalRangeOption);

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

  await userEvent.click(screen.getByText(VALUE_REGEX));

  const timeRangeOption = await screen.findByText(TIME_RANGE_REGEX);
  await userEvent.click(timeRangeOption);

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(DATASET_REGEX)).not.toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time column filter type', async () => {
  defaultRender();

  await userEvent.click(screen.getByText(VALUE_REGEX));

  const timeColumnOption = await screen.findByText(TIME_COLUMN_REGEX);
  await userEvent.click(timeColumnOption);

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time grain filter type', async () => {
  defaultRender();

  await userEvent.click(screen.getByText(VALUE_REGEX));

  const timeGrainOption = await screen.findByText(TIME_GRAIN_REGEX);
  await userEvent.click(timeGrainOption);

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('render time filter types as disabled if there are no temporal columns in the dataset', async () => {
  defaultRender(noTemporalColumnsState());

  await userEvent.click(screen.getByText(VALUE_REGEX));

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
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  expect(
    await screen.findByText(NAME_REQUIRED_REGEX, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
});

test('validates the column', async () => {
  defaultRender();
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  expect(
    await screen.findByText(COLUMN_REQUIRED_REGEX, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
});

// This test validates the "default value" field validation.
//
// LIMITATION: Does not exercise the full dataset/column selection flow.
// With createNewOnOpen: true, the modal renders in a state where form fields
// are visible but selecting dataset/column through async selects requires
// complex setup that proved unreliable (see PROJECT.md Investigation section).
//
// What this test covers:
// - Default value checkbox can be enabled
// - Validation error appears when default value is enabled without a value
//
// What would require integration/E2E testing:
// - Full flow: open modal → select dataset → select column → enable default value → validate
// - This flow is better tested with Playwright where the full component lifecycle is available
//
// The core validation logic is still covered - this guards against regressions where
// the "Please choose a valid value" error fails to appear when default value is enabled.
test('validates the default value', async () => {
  defaultRender();
  // Wait for the default value checkbox to appear
  const defaultValueCheckbox = await screen.findByRole('checkbox', {
    name: DEFAULT_VALUE_REGEX,
  });
  // Verify default value error is NOT present before enabling checkbox
  expect(screen.queryByText(/choose.*valid value/i)).not.toBeInTheDocument();
  // Enable default value checkbox without setting a value
  await userEvent.click(defaultValueCheckbox);
  // Try to save - should show validation error
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  // Verify validation error appears (actual message is "Please choose a valid value")
  expect(await screen.findByText(/choose.*valid value/i)).toBeInTheDocument();
}, 50000);

test('validates the pre-filter value', async () => {
  // Use real timers to avoid userEvent + fake timers compatibility issues
  defaultRender();

  await userEvent.click(screen.getByText(FILTER_SETTINGS_REGEX));
  await userEvent.click(getCheckbox(PRE_FILTER_REGEX));

  // Wait for validation error to appear
  await waitFor(
    () => {
      const errorMessages = screen.getAllByText(PRE_FILTER_REQUIRED_REGEX);
      expect(errorMessages.length).toBeGreaterThan(0);
    },
    { timeout: 10000 },
  );
}, 50000); // Slow-running test, increase timeout to 50 seconds.

test('filters are draggable', async () => {
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };
  defaultRender(state, { ...props, createNewOnOpen: false });
  const filterContainer = screen.getByTestId('filter-title-container');
  const draggables = within(filterContainer).getAllByRole('tab');
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
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });
  const filterContainer = screen.getByTestId('filter-title-container');
  const filterTabs = within(filterContainer).getAllByRole('tab');
  const deleteIcon = filterTabs[2].querySelector('[data-icon="delete"]');
  fireEvent.click(deleteIcon!);

  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        filterChanges: expect.objectContaining({
          deleted: expect.arrayContaining(['NATIVE_FILTER-3']),
          modified: expect.arrayContaining([]),
          reordered: expect.arrayContaining([]),
        }),
      }),
    ),
  );
}, 30000); // Increase timeout to 30 seconds for slow async operations

test('deletes a filter including dependencies', async () => {
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };
  const onSave = jest.fn();
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });
  const filterContainer = screen.getByTestId('filter-title-container');
  const filterTabs = within(filterContainer).getAllByRole('tab');
  const deleteIcon = filterTabs[1].querySelector('[data-icon="delete"]');
  fireEvent.click(deleteIcon!);
  userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        filterChanges: expect.objectContaining({
          deleted: ['NATIVE_FILTER-2'],
          modified: expect.arrayContaining([
            expect.objectContaining({
              id: 'NATIVE_FILTER-1',
            }),
          ]),
          reordered: [],
        }),
      }),
    ),
  );
}, 30000);

test('reorders filters via drag and drop', async () => {
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];

  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };

  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const filterContainer = screen.getByTestId('filter-title-container');
  const draggableFilters = within(filterContainer).getAllByRole('tab');

  fireEvent.dragStart(draggableFilters[0]);
  fireEvent.dragOver(draggableFilters[2]);
  fireEvent.drop(draggableFilters[2]);
  fireEvent.dragEnd(draggableFilters[0]);

  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        filterChanges: expect.objectContaining({
          deleted: [],
          modified: [],
          reordered: expect.arrayContaining([
            'NATIVE_FILTER-2',
            'NATIVE_FILTER-3',
            'NATIVE_FILTER-1',
          ]),
        }),
      }),
    ),
  );
});

test('rearranges three filters and deletes one of them', async () => {
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', []),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];

  const state = {
    ...defaultState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };

  const onSave = jest.fn();

  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
    onSave,
  });

  const filterContainer = screen.getByTestId('filter-title-container');
  const draggableFilters = within(filterContainer).getAllByRole('tab');
  const deleteIcon = draggableFilters[1].querySelector('[data-icon="delete"]');
  fireEvent.click(deleteIcon!);

  fireEvent.dragStart(draggableFilters[0]);
  fireEvent.dragOver(draggableFilters[2]);
  fireEvent.drop(draggableFilters[2]);
  fireEvent.dragEnd(draggableFilters[0]);

  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        filterChanges: expect.objectContaining({
          modified: [],
          deleted: ['NATIVE_FILTER-2'],
          reordered: expect.arrayContaining([
            'NATIVE_FILTER-2',
            'NATIVE_FILTER-3',
            'NATIVE_FILTER-1',
          ]),
        }),
      }),
    ),
  );
});

test('modifies the name of a filter', async () => {
  jest.useFakeTimers();
  try {
    const nativeFilterConfig = [
      buildNativeFilter('NATIVE_FILTER-1', 'state', []),
      buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    ];

    const state = {
      ...defaultState(),
      dashboardInfo: {
        metadata: {
          native_filter_configuration: nativeFilterConfig,
        },
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

    await userEvent.clear(filterNameInput);
    await userEvent.type(filterNameInput, 'New Filter Name');

    jest.runAllTimers();

    await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          filterChanges: expect.objectContaining({
            modified: expect.arrayContaining([
              expect.objectContaining({ name: 'New Filter Name' }),
            ]),
          }),
        }),
      ),
    );
  } finally {
    jest.useRealTimers();
  }
});

test('renders a filter with a chart containing BigInt values', async () => {
  const nativeFilterConfig = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...bigIntChartDataState(),
    dashboardInfo: {
      metadata: {
        native_filter_configuration: nativeFilterConfig,
      },
    },
    dashboardLayout,
  };
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
  });

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
});
