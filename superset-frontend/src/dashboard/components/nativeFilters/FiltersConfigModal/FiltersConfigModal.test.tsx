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

const SECOND_DATASET_ID = id + 1;
const SECOND_DATASET_NAME = 'users';
const SECOND_DATASET_COLUMN = 'Column B';

const datasetResult = (
  datasetId: number,
  {
    tableName = 'birth_names',
    columnName = 'Column A',
    databaseName = 'main',
  }: { tableName?: string; columnName?: string; databaseName?: string } = {},
) => ({
  description_columns: {},
  id: datasetId,
  label_columns: {
    columns: 'Columns',
    table_name: 'Table Name',
  },
  result: {
    metrics: [],
    columns: [
      {
        column_name: columnName,
        id: datasetId,
      },
    ],
    table_name: tableName,
    id: datasetId,
    database: {
      database_name: databaseName,
    },
  },
  show_columns: ['id', 'table_name'],
});

fetchMock.get('glob:*/api/v1/dataset/1*', datasetResult(1));
fetchMock.get(`glob:*/api/v1/dataset/${id}*`, datasetResult(id));
fetchMock.get(
  `glob:*/api/v1/dataset/${SECOND_DATASET_ID}*`,
  datasetResult(SECOND_DATASET_ID, {
    tableName: SECOND_DATASET_NAME,
    columnName: SECOND_DATASET_COLUMN,
  }),
);

// Mock dataset list endpoint for AsyncSelect dropdown
fetchMock.get('glob:*/api/v1/dataset/?*', {
  count: 2,
  result: [
    {
      id, // Use numeric id (7), not datasourceId ("7__table")
      table_name: 'birth_names',
      database: { database_name: 'main' },
      schema: 'public',
    },
    {
      id: SECOND_DATASET_ID,
      table_name: SECOND_DATASET_NAME,
      database: { database_name: 'main' },
      schema: 'analytics',
    },
  ],
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

const FILTER_TYPE_REGEX = /^filter type$/i;
const FILTER_NAME_REGEX = /^filter name$/i;
const DATASET_REGEX = /^dataset$/i;
const COLUMN_REGEX = /^column$/i;
const VALUE_REGEX = /^value$/i;
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

const getOpenDropdown = () =>
  document.querySelector(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  ) as HTMLElement | null;

const findDropdownOption = (text: string) =>
  waitFor(() => {
    const dropdown = getOpenDropdown();
    if (!dropdown) {
      throw new Error('Dropdown not visible');
    }
    return within(dropdown).getByText(text);
  });

const getSelectTrigger = (label: string) => {
  const byAria = screen.queryByLabelText(label) as HTMLElement | null;
  if (byAria) {
    return byAria;
  }
  const byDataTest = document.querySelector(
    `[data-test="${label}"]`,
  ) as HTMLElement | null;
  if (byDataTest) {
    return byDataTest;
  }
  const labelNode = screen.queryByText(new RegExp(`^${label}$`, 'i'));
  if (labelNode) {
    const container =
      labelNode.closest('.ant-form-item') ??
      labelNode.parentElement?.parentElement ??
      labelNode.parentElement ??
      undefined;
    const select = container?.querySelector(
      '.ant-select-selector',
    ) as HTMLElement | null;
    if (select) {
      return select;
    }
  }
  return null;
};

const selectOption = async (label: string, optionText: string) => {
  const trigger = getSelectTrigger(label);
  if (!trigger) {
    const availableDataTests = Array.from(
      document.querySelectorAll('[data-test]'),
    ).map(node => (node as HTMLElement).getAttribute('data-test'));
    const matchingLabels = screen
      .queryAllByText(new RegExp(label, 'i'))
      .map(node => node.textContent);
    throw new Error(
      `Unable to find select trigger for ${label}. Matched label texts: [${matchingLabels.join(
        ', ',
      )}]. Available data-test attributes: ${availableDataTests.join(', ')}`,
    );
  }
  await userEvent.click(trigger);
  const option = await findDropdownOption(optionText);
  await userEvent.click(option);
};

const selectDatasetOption = async (optionText: string) =>
  selectOption('Dataset', optionText);

const selectColumnOption = async (optionText: string) =>
  selectOption('Column', optionText);

// Helper to wait for all loading states to complete
const waitForFormStability = async (timeout = 5000) => {
  await waitFor(
    () => {
      expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    },
    { timeout },
  );
};

// Helper to open Filter Settings accordion panel
const openFilterSettings = async () => {
  const settingsHeader = screen.getByText(FILTER_SETTINGS_REGEX);
  await userEvent.click(settingsHeader);
  // Wait for panel to expand and content to be visible
  await waitFor(() => {
    // Check for an element that should be in the expanded panel
    expect(getCheckbox(MULTIPLE_REGEX)).toBeInTheDocument();
  });
};

// Helper to select a filter type from the dropdown
const selectFilterType = async (filterTypeName: string) => {
  const filterTypeButton = screen.getByText(VALUE_REGEX);
  await userEvent.click(filterTypeButton);

  const option = await screen.findByText(filterTypeName);
  await userEvent.click(option);

  // Wait for form to re-render with new filter type
  await waitForFormStability();
};

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

// Set timeout for all tests in this file to prevent CI timeouts
jest.setTimeout(60000);

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

  await selectFilterType('Numerical range');

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.getByText(COLUMN_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_REQUIRED_REGEX)).toBeInTheDocument();

  // Open Filter Settings accordion to access checkboxes
  await openFilterSettings();

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

  await selectFilterType('Time range');

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(DATASET_REGEX)).not.toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  // Open Filter Settings accordion to access checkboxes
  await openFilterSettings();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time column filter type', async () => {
  defaultRender();

  await selectFilterType('Time column');

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  // Open Filter Settings accordion to access checkboxes
  await openFilterSettings();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('renders a time grain filter type', async () => {
  defaultRender();

  await selectFilterType('Time grain');

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME_REGEX)).toBeInTheDocument();
  expect(screen.getByText(DATASET_REGEX)).toBeInTheDocument();
  expect(screen.queryByText(COLUMN_REGEX)).not.toBeInTheDocument();

  // Open Filter Settings accordion to access checkboxes
  await openFilterSettings();

  expect(getCheckbox(DEFAULT_VALUE_REGEX)).not.toBeChecked();
});

test('render time filter types as disabled if there are no temporal columns in the dataset', async () => {
  defaultRender(noTemporalColumnsState());

  // Open filter type dropdown
  const filterTypeButton = screen.getByText(VALUE_REGEX);
  await userEvent.click(filterTypeButton);

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
  expect(await screen.findByText(NAME_REQUIRED_REGEX)).toBeInTheDocument();
});

test('validates the column', async () => {
  defaultRender();
  await userEvent.click(screen.getByRole('button', { name: SAVE_REGEX }));
  expect(await screen.findByText(COLUMN_REQUIRED_REGEX)).toBeInTheDocument();
});

test('validates the default value', async () => {
  defaultRender();

  // Wait for form to render and stabilize
  expect(await screen.findByText(DATASET_REGEX)).toBeInTheDocument();
  await waitForFormStability();

  // Select dataset and column
  await selectDatasetOption('birth_names');
  await waitForFormStability();

  await selectColumnOption('Column A');
  await waitForFormStability();

  // Open Filter Settings to access Default Value checkbox
  await openFilterSettings();

  // Enable "Filter has default value" checkbox
  await userEvent.click(getCheckbox(DEFAULT_VALUE_REGEX));

  // Wait for "fill required fields" message to clear
  await waitFor(() => {
    expect(
      screen.queryByText(FILL_REQUIRED_FIELDS_REGEX),
    ).not.toBeInTheDocument();
  });

  // Should show "default value is required" validation error
  expect(
    await screen.findByText(DEFAULT_VALUE_REQUIRED_REGEX),
  ).toBeInTheDocument();
});

test('validates the pre-filter value', async () => {
  jest.useFakeTimers();
  try {
    defaultRender();

    userEvent.click(screen.getByText(FILTER_SETTINGS_REGEX));
    userEvent.click(getCheckbox(PRE_FILTER_REGEX));

    jest.runAllTimers();
  } finally {
    jest.useRealTimers();
  }

  jest.runOnlyPendingTimers();
  jest.useRealTimers();

  // Wait for validation to complete after timer switch
  await waitFor(
    () => {
      expect(screen.getByText(PRE_FILTER_REQUIRED_REGEX)).toBeInTheDocument();
    },
    { timeout: 15000 },
  );
}, 50000); // Slow-running test, increase timeout to 50 seconds.

test("doesn't render time range pre-filter if there are no temporal columns in datasource", async () => {
  defaultRender(noTemporalColumnsState());

  // Wait for form to render
  expect(await screen.findByText(DATASET_REGEX)).toBeInTheDocument();
  await waitForFormStability();

  // Select dataset that has no temporal columns
  await selectDatasetOption('birth_names');
  await waitForFormStability();

  // Open Filter Settings accordion
  await openFilterSettings();

  // Enable pre-filter
  await userEvent.click(getCheckbox(PRE_FILTER_REGEX));

  // Wait for pre-filter options to potentially render
  await waitFor(() => {
    // Time range pre-filter should NOT be available for datasets without temporal columns
    expect(
      screen.queryByText(TIME_RANGE_PREFILTER_REGEX),
    ).not.toBeInTheDocument();
  });
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

test('renders a filter with a chart containing BigInt values', async () => {
  const nativeFilterState = [
    buildNativeFilter('NATIVE_FILTER-1', 'state', ['NATIVE_FILTER-2']),
    buildNativeFilter('NATIVE_FILTER-2', 'country', []),
    buildNativeFilter('NATIVE_FILTER-3', 'product', []),
  ];
  const state = {
    ...bigIntChartDataState(),
    dashboardInfo: {
      metadata: { native_filter_configuration: nativeFilterState },
    },
    dashboardLayout,
  };
  defaultRender(state, {
    ...props,
    createNewOnOpen: false,
  });

  expect(screen.getByText(FILTER_TYPE_REGEX)).toBeInTheDocument();
});
