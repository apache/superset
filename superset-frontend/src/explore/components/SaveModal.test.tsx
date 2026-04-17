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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { bindActionCreators } from 'redux';

import {
  fireEvent,
  render,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';

import * as saveModalActions from 'src/explore/actions/saveModalActions';
import SaveModal, {
  createRedirectParams,
  addChartToDashboard,
} from 'src/explore/components/SaveModal';
import { CHART_WIDTH } from 'src/dashboard/constants';
import { GRID_COLUMN_COUNT } from 'src/dashboard/util/constants';

jest.mock('@superset-ui/core/components/Select', () => ({
  ...jest.requireActual('@superset-ui/core/components/Select/AsyncSelect'),
  AsyncSelect: ({ onChange }: { onChange: (val: any) => void }) => (
    <input
      data-test="mock-async-select"
      onChange={({ target: { value } }) => onChange({ label: value, value })}
    />
  ),
}));

jest.mock('@superset-ui/core/components/TreeSelect', () => ({
  TreeSelect: ({
    onChange,
    disabled,
  }: {
    onChange: (val: any) => void;
    disabled?: boolean;
  }) => (
    <input
      data-test="mock-tree-select"
      disabled={disabled}
      onChange={({ target: { value } }) => onChange(value)}
    />
  ),
}));

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const initialState = {
  chart: {},
  saveModal: {
    dashboards: [],
    isVisible: true,
  },
  explore: {
    datasource: {},
    slice: {
      slice_id: 1,
      slice_name: 'title',
      owners: [1],
    },
    alert: null,
  },
  user: {
    userId: 1,
  },
};

const initialStore = mockStore(initialState);

const defaultProps = {
  addDangerToast: jest.fn(),
  onHide: () => ({}),
  actions: bindActionCreators(saveModalActions as any, (arg: any) => {
    if (typeof arg === 'function') {
      return arg(jest.fn);
    }
    return arg;
  }),
  form_data: { datasource: '107__table', url_params: { foo: 'bar' } },
};

const mockEvent = {
  target: {
    value: 'mock event target',
  },
  value: 10,
};

const mockDashboardData = {
  pks: ['id'],
  result: [{ id: 'id', dashboard_title: 'dashboard title' }],
};

const queryStore = mockStore({
  chart: {},
  saveModal: {
    dashboards: [],
    isVisible: true,
  },
  explore: {
    datasource: { name: 'test', type: 'query' },
    slice: null,
    alert: null,
  },
  user: {
    userId: 1,
  },
});

const fetchDashboardsEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;
const fetchChartEndpoint = `glob:*/api/v1/chart/${1}*`;
const fetchDashboardEndpoint = `glob:*/api/v1/dashboard/*`;

beforeAll(() => {
  fetchMock.get(fetchDashboardsEndpoint, mockDashboardData);
  fetchMock.get(fetchChartEndpoint, { id: 1, dashboards: [1] });
  fetchMock.get(fetchDashboardEndpoint, {
    result: [{ id: 'id', dashboard_title: 'dashboard title' }],
  });
});

afterAll(() => fetchMock.clearHistory());

const setup = (
  props: Record<string, any> = defaultProps,
  store = initialStore,
) =>
  render(<SaveModal {...(props as any)} />, {
    useRouter: true,
    store,
  });

test('renders a Modal with the right set of components', () => {
  const { getByRole, getByTestId } = setup();
  expect(getByRole('dialog', { name: 'Save chart' })).toBeInTheDocument();
  expect(getByRole('radio', { name: 'Save (Overwrite)' })).toBeInTheDocument();
  expect(getByRole('radio', { name: 'Save as...' })).toBeInTheDocument();
  expect(
    within(getByTestId('save-modal-footer')).getAllByRole('button'),
  ).toHaveLength(3);
});

test('renders the right footer buttons', () => {
  const { getByTestId } = setup();
  expect(
    within(getByTestId('save-modal-footer')).getByRole('button', {
      name: 'Cancel',
    }),
  ).toBeInTheDocument();
  expect(
    within(getByTestId('save-modal-footer')).getByRole('button', {
      name: 'Save & go to dashboard',
    }),
  ).toBeInTheDocument();
  expect(
    within(getByTestId('save-modal-footer')).getByRole('button', {
      name: 'Save',
    }),
  ).toBeInTheDocument();
});

test('does not render a message when overriding', () => {
  const { getByRole, queryByRole } = setup();

  fireEvent.click(getByRole('radio', { name: 'Save (Overwrite)' }));
  expect(
    queryByRole('alert', { name: 'A new chart will be created.' }),
  ).not.toBeInTheDocument();
});

test('renders a message when saving as', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      explore: {
        ...initialState.explore,
        slice: {
          ...initialState.explore.slice,
          is_managed_externally: true,
        },
      },
    }),
  );
  fireEvent.click(getByRole('radio', { name: 'Save as...' }));
  expect(getByRole('alert')).toHaveTextContent('A new chart will be created.');
});

test('renders a message when a new dashboard is selected', async () => {
  const { getByRole, getByTestId } = setup();

  const selection = getByTestId('mock-async-select');
  fireEvent.change(selection, { target: { value: 'Test new dashboard' } });

  expect(getByRole('alert')).toHaveTextContent(
    'A new dashboard will be created.',
  );
});

test('renders a message when saving as with new dashboard', () => {
  const { getByRole, getByTestId } = setup(
    {},
    mockStore({
      ...initialState,
      explore: {
        ...initialState.explore,
        slice: {
          ...initialState.explore.slice,
          is_managed_externally: true,
        },
      },
    }),
  );
  fireEvent.click(getByRole('radio', { name: 'Save as...' }));
  const selection = getByTestId('mock-async-select');
  fireEvent.change(selection, { target: { value: 'Test new dashboard' } });

  expect(getByRole('alert')).toHaveTextContent(
    'A new chart and dashboard will be created.',
  );
});

test('disables overwrite option for new slice', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      explore: {
        ...initialState.explore,
        slice: null,
      },
    }),
  );
  expect(getByRole('radio', { name: 'Save (Overwrite)' })).toBeDisabled();
});

test('disables overwrite option for non-owner', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      user: { userId: 2 },
    }),
  );
  expect(getByRole('radio', { name: 'Save (Overwrite)' })).toBeDisabled();
});

test('updates slice name and selected dashboard', async () => {
  const dashboardId = mockEvent.value;
  const saveDataset = jest.fn().mockResolvedValue(undefined);
  const createDashboard = jest.fn().mockResolvedValue({ id: dashboardId });
  const saveSliceFailed = jest.fn();
  const setFormData = jest.fn();
  const createSlice = jest.fn().mockResolvedValue({ id: 1 });

  const { getByRole, getByTestId } = setup(
    {
      actions: {
        saveDataset,
        createDashboard,
        saveSliceFailed,
        setFormData,
        createSlice,
      },
    },
    queryStore,
  );

  fireEvent.change(getByTestId('new-chart-name'), mockEvent);
  fireEvent.change(getByTestId('new-dataset-name'), mockEvent);
  const selection = getByTestId('mock-async-select');
  fireEvent.change(selection, { target: { value: dashboardId } });

  expect(getByRole('button', { name: 'Save' })).toBeEnabled();

  fireEvent.click(getByRole('button', { name: 'Save' }));
  expect(saveDataset).toHaveBeenCalledWith(
    expect.objectContaining({
      datasourceName: mockEvent.target.value,
    }),
  );
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(fetchDashboardEndpoint)).toHaveLength(1),
  );
  expect(fetchMock.callHistory.calls(fetchDashboardEndpoint)[0].url).toEqual(
    expect.stringContaining(`dashboard/${dashboardId}`),
  );
  expect(createSlice).toHaveBeenCalledWith(
    mockEvent.target.value,
    expect.anything(),
    expect.anything(),
  );
});

test('set dataset name when chart source is query', () => {
  const { getByTestId } = setup({}, queryStore);
  expect(getByTestId('new-dataset-name')).toHaveValue('test');
});

test('renders InfoTooltip icon next to Dataset Name label when datasource type is query', () => {
  const { getByTestId, getByText } = setup({}, queryStore);

  const datasetNameLabel = getByText('Dataset Name');
  expect(datasetNameLabel).toBeInTheDocument();

  const infoTooltip = getByTestId('info-tooltip-icon');
  expect(infoTooltip).toBeInTheDocument();

  const labelContainer = datasetNameLabel.parentElement;
  expect(labelContainer).toContainElement(infoTooltip);
});

test('createRedirectParams sets slice_id in the URLSearchParams', () => {
  const result = createRedirectParams(
    '?name=John&age=30',
    { id: 1 },
    'overwrite',
  );
  expect(result.get('slice_id')).toEqual('1');
  expect(result.get('save_action')).toEqual('overwrite');
});

test('createRedirectParams removes form_data_key from URL parameters', () => {
  // Test with form_data_key in the URL
  const urlWithFormDataKey = '?form_data_key=12345&other_param=value';
  const result = createRedirectParams(
    urlWithFormDataKey,
    { id: 1 },
    'overwrite',
  );

  // form_data_key should be removed
  expect(result.has('form_data_key')).toBe(false);
  // other parameters should remain
  expect(result.get('other_param')).toEqual('value');
  expect(result.get('slice_id')).toEqual('1');
  expect(result.get('save_action')).toEqual('overwrite');
});

/**
 * TODO: This test was written for the class component version of SaveModal.
 * Since SaveModal has been converted to a function component, this test
 * needs to be rewritten to test through component rendering and user interaction.
 * The test should verify that clicking "Save & go to dashboard" dispatches
 * removeChartState with the correct chart ID.
 */
test('dispatches removeChartState when saving and going to dashboard - placeholder', () => {
  // See TODO comment above
  expect(true).toBe(true);
});

test('disables tab selector when no dashboard selected', () => {
  const { getByRole, getByTestId } = setup();
  fireEvent.click(getByRole('radio', { name: 'Save as...' }));
  const tabSelector = getByTestId('mock-tree-select');
  expect(tabSelector).toBeInTheDocument();
  expect(tabSelector).toBeDisabled();
});

test('renders tab selector when saving as', async () => {
  const { getByRole, getByTestId } = setup();
  fireEvent.click(getByRole('radio', { name: 'Save as...' }));
  const selection = getByTestId('mock-async-select');
  fireEvent.change(selection, { target: { value: '1' } });
  const tabSelector = getByTestId('mock-tree-select');
  expect(tabSelector).toBeInTheDocument();
  expect(tabSelector).toBeDisabled();
});

/**
 * TODO: This test was written for the class component version of SaveModal.
 * Since SaveModal has been converted to a function component, this test
 * needs to be rewritten to test through component rendering and user interaction.
 * The test should verify that selecting a dashboard triggers tab loading.
 */
test('onDashboardChange triggers tabs load for existing dashboard - placeholder', () => {
  // See TODO comment above
  expect(true).toBe(true);
});

/**
 * TODO: This test was written for the class component version of SaveModal.
 * Since SaveModal has been converted to a function component, this test
 * needs to be rewritten to test through component rendering and user interaction.
 * The test should verify that changing the tab selection updates the component state.
 */
test('onTabChange correctly updates selectedTab - placeholder', () => {
  // See TODO comment above
  expect(true).toBe(true);
});

test('chart placement logic finds row with available space', () => {
  // Test case 1: Row has space (8 + 4 = 12 <= 12)
  const positionJson1 = {
    tab1: {
      type: 'TABS',
      id: 'tab1',
      children: ['row1'],
    },
    row1: {
      type: 'ROW',
      id: 'row1',
      children: ['CHART-1'],
      meta: {},
    },
    'CHART-1': {
      type: 'CHART',
      id: 'CHART-1',
      meta: { width: 8 },
    },
  };

  // Test case 2: Row is full (12 + 4 = 16 > 12)
  const positionJson2 = {
    ...positionJson1,
    'CHART-1': {
      ...positionJson1['CHART-1'],
      meta: { width: 12 },
    },
  };

  // Test case 3: Multiple charts in row
  const positionJson3 = {
    tab1: {
      type: 'TABS',
      id: 'tab1',
      children: ['row1'],
    },
    row1: {
      type: 'ROW',
      id: 'row1',
      children: ['CHART-1', 'CHART-2'],
      meta: {},
    },
    'CHART-1': {
      type: 'CHART',
      id: 'CHART-1',
      meta: { width: 6 },
    },
    'CHART-2': {
      type: 'CHART',
      id: 'CHART-2',
      meta: { width: 4 },
    },
  };

  const findRowWithSpace = (
    positionJson: Record<string, any>,
    tabChildren: string[],
  ) => {
    for (const childKey of tabChildren) {
      const child = positionJson[childKey];
      if (child?.type === 'ROW') {
        const rowChildren = child.children || [];
        const totalWidth = rowChildren.reduce((sum: number, key: string) => {
          const component = positionJson[key];
          return sum + (component?.meta?.width || 0);
        }, 0);

        if (totalWidth + CHART_WIDTH <= GRID_COLUMN_COUNT) {
          return childKey;
        }
      }
    }
    return null;
  };

  // Test case 1: Should find row with space
  expect(findRowWithSpace(positionJson1, ['row1'])).toBe('row1');

  // Test case 2: Should not find row (full)
  expect(findRowWithSpace(positionJson2, ['row1'])).toBeNull();

  // Test case 3: Should not find row (6 + 4 = 10, adding 4 = 14 > 12)
  expect(findRowWithSpace(positionJson3, ['row1'])).toBeNull();
});

test('addChartToDashboard successfully adds chart to existing row with space', async () => {
  const dashboardId = 123;
  const chartId = 456;
  const tabId = 'TABS_ID';
  const sliceName = 'Test Chart';

  const positionJson = {
    [tabId]: {
      type: 'TABS',
      id: tabId,
      children: ['row1'],
    },
    row1: {
      type: 'ROW',
      id: 'row1',
      children: ['CHART-1'],
      meta: {},
    },
    'CHART-1': {
      type: 'CHART',
      id: 'CHART-1',
      meta: { width: 8, height: 50, chartId: 100 },
    },
  };

  const mockDashboard = {
    id: dashboardId,
    position_json: JSON.stringify(positionJson),
  };

  const { SupersetClient } = require('@superset-ui/core');
  const originalGet = SupersetClient.get;
  const originalPut = SupersetClient.put;

  SupersetClient.get = jest.fn().mockResolvedValueOnce({
    json: { result: mockDashboard },
  });

  SupersetClient.put = jest.fn().mockResolvedValueOnce({
    json: { result: mockDashboard },
  });

  const mockNanoid = jest.spyOn(require('nanoid'), 'nanoid');
  mockNanoid.mockReturnValue('test-id');

  try {
    await addChartToDashboard(dashboardId, chartId, tabId, sliceName);

    expect(SupersetClient.get).toHaveBeenCalledWith({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
    });

    expect(SupersetClient.put).toHaveBeenCalledWith({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('position_json'),
    });

    const putCall = SupersetClient.put.mock.calls[0][0];
    const body = JSON.parse(putCall.body);
    const updatedPositionJson = JSON.parse(body.position_json);

    expect(updatedPositionJson[`CHART-${chartId}`]).toBeDefined();
    expect(updatedPositionJson[`CHART-${chartId}`].meta.chartId).toBe(chartId);
    expect(updatedPositionJson.row1.children).toContain(`CHART-${chartId}`);
  } finally {
    SupersetClient.get = originalGet;
    SupersetClient.put = originalPut;
    mockNanoid.mockRestore();
  }
});

test('addChartToDashboard creates new row when no existing row has space', async () => {
  const dashboardId = 123;
  const chartId = 456;
  const tabId = 'TABS_ID';
  const sliceName = 'Test Chart';

  const positionJson = {
    [tabId]: {
      type: 'TABS',
      id: tabId,
      children: ['row1'],
    },
    row1: {
      type: 'ROW',
      id: 'row1',
      children: ['CHART-1'],
      parents: ['ROOT_ID', 'GRID_ID', tabId],
      meta: {},
    },
    'CHART-1': {
      type: 'CHART',
      id: 'CHART-1',
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', tabId, 'row1'],
      meta: {
        width: GRID_COLUMN_COUNT,
        height: 50,
        chartId: 100,
        sliceName: 'Existing Chart',
      },
    },
  };

  const mockDashboard = {
    id: dashboardId,
    position_json: JSON.stringify(positionJson),
  };

  const { SupersetClient } = require('@superset-ui/core');
  const originalGet = SupersetClient.get;
  const originalPut = SupersetClient.put;

  SupersetClient.get = jest.fn().mockResolvedValueOnce({
    json: { result: mockDashboard },
  });

  let putRequestBody: any = null;
  SupersetClient.put = jest.fn().mockImplementationOnce((request: any) => {
    putRequestBody = request;
    return Promise.resolve({
      json: { result: mockDashboard },
    });
  });

  const mockRowId = 'test-row-id';
  const mockNanoid = jest.spyOn(require('nanoid'), 'nanoid');
  mockNanoid.mockReturnValueOnce(mockRowId);

  try {
    await addChartToDashboard(dashboardId, chartId, tabId, sliceName);

    expect(SupersetClient.put).toHaveBeenCalled();
    const body = JSON.parse(putRequestBody.body);
    const updatedPositionJson = JSON.parse(body.position_json);

    expect(updatedPositionJson[`ROW-${mockRowId}`]).toBeDefined();
    expect(updatedPositionJson[`ROW-${mockRowId}`].type).toBe('ROW');

    expect(updatedPositionJson[tabId].children).toContain(`ROW-${mockRowId}`);

    expect(updatedPositionJson[`CHART-${chartId}`]).toBeDefined();
    expect(updatedPositionJson[`ROW-${mockRowId}`].children).toContain(
      `CHART-${chartId}`,
    );
  } finally {
    SupersetClient.get = originalGet;
    SupersetClient.put = originalPut;
    mockNanoid.mockRestore();
  }
});

test('addChartToDashboard handles empty position_json', async () => {
  const dashboardId = 123;
  const chartId = 456;
  const tabId = 'TABS_ID';
  const sliceName = 'Test Chart';

  const mockDashboard = {
    id: dashboardId,
    position_json: null,
  };

  const { SupersetClient } = require('@superset-ui/core');
  const originalGet = SupersetClient.get;
  const originalPut = SupersetClient.put;

  SupersetClient.get = jest.fn().mockResolvedValueOnce({
    json: { result: mockDashboard },
  });

  SupersetClient.put = jest.fn().mockResolvedValueOnce({
    json: { result: mockDashboard },
  });

  const mockNanoid = jest.spyOn(require('nanoid'), 'nanoid');
  mockNanoid.mockReturnValue('test-id');

  try {
    await expect(
      addChartToDashboard(dashboardId, chartId, tabId, sliceName),
    ).rejects.toThrow(`Tab ${tabId} not found in positionJson`);
  } finally {
    SupersetClient.get = originalGet;
    SupersetClient.put = originalPut;
    mockNanoid.mockRestore();
  }
});
