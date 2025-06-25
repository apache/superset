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
import SaveModal, { PureSaveModal } from 'src/explore/components/SaveModal';

jest.mock('src/components', () => ({
  ...jest.requireActual('src/components'),
  AsyncSelect: ({ onChange }) => (
    <input
      data-test="mock-async-select"
      onChange={({ target: { value } }) => onChange({ label: value, value })}
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
  actions: bindActionCreators(saveModalActions, arg => {
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

afterAll(() => fetchMock.restore());

const setup = (props = defaultProps, store = initialStore) =>
  render(<SaveModal {...props} />, {
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
  const saveDataset = jest.fn().mockResolvedValue();
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
    expect(fetchMock.calls(fetchDashboardEndpoint)).toHaveLength(1),
  );
  expect(fetchMock.calls(fetchDashboardEndpoint)[0][0]).toEqual(
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

test('make sure slice_id in the URLSearchParams before the redirect', () => {
  const myProps = {
    ...defaultProps,
    slice: { slice_id: 1, slice_name: 'title', owners: [1] },
    actions: {
      setFormData: jest.fn(),
      updateSlice: jest.fn(() => Promise.resolve({ id: 1 })),
      getSliceDashboards: jest.fn(),
    },
    user: { userId: 1 },
    history: {
      replace: jest.fn(),
    },
    dispatch: jest.fn(),
  };

  const saveModal = new PureSaveModal(myProps);
  const result = saveModal.handleRedirect(
    'https://example.com/?name=John&age=30',
    { id: 1 },
  );
  expect(result.get('slice_id')).toEqual('1');
});
