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
import { setControlValue } from 'src/explore/actions/exploreActions';
import {
  getChartDataRequest,
  handleChartDataResponse,
} from 'src/components/Chart/chartAction';
import { store } from 'src/views/store';
import { navigation } from '../navigation';
import { explore } from './index';

jest.mock('src/explore/actions/exploreActions', () => ({
  setControlValue: jest.fn((controlName, value, validationErrors, options) => ({
    type: 'MOCK_SET_FIELD_VALUE',
    controlName,
    value,
    validationErrors,
    programmatic: options?.programmatic ?? false,
  })),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
  handleChartDataResponse: jest.fn(),
}));

jest.mock('src/views/store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));

jest.mock('../navigation', () => ({
  navigation: { getPage: jest.fn() },
}));

const mockGetPage = navigation.getPage as jest.Mock;
const mockGetState = store.getState as jest.Mock;
const mockDispatch = store.dispatch as jest.Mock;
const mockGetChartDataRequest = getChartDataRequest as jest.Mock;
const mockHandleChartDataResponse = handleChartDataResponse as jest.Mock;

// Mirrors the current controls Explore would be querying with, matching the
// pre-normalization `form_data` slice used elsewhere in these tests.
const defaultControls = {
  datasource: { value: '1__table' },
  viz_type: { value: 'echarts_timeseries_bar' },
};

function activateExplore(overrides: Record<string, unknown> = {}) {
  mockGetPage.mockReturnValue('explore');
  mockGetState.mockReturnValue({
    explore: {
      slice: { slice_id: 55 },
      form_data: { datasource: '1__table', viz_type: 'echarts_timeseries_bar' },
      controls: defaultControls,
      ...overrides,
    },
    dataMask: {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPage.mockReturnValue('dashboard');
  mockGetState.mockReturnValue({ explore: {}, dataMask: {} });
  // By default, behave as if GLOBAL_ASYNC_QUERIES is disabled: pass the
  // result array straight through, as handleChartDataResponse itself does.
  mockHandleChartDataResponse.mockImplementation(
    (_response: unknown, json: { result: unknown[] }) => json.result,
  );
});

test('getChartId returns undefined when Explore is not the active surface', () => {
  expect(explore.getChartId()).toBeUndefined();
});

test('getChartId returns the loaded chart id when active', () => {
  activateExplore();
  expect(explore.getChartId()).toBe(55);
});

test('getChartId returns undefined when active but no chart is loaded', () => {
  activateExplore({ slice: undefined });
  expect(explore.getChartId()).toBeUndefined();
});

test('getControlValues returns {} when Explore is not the active surface', () => {
  expect(explore.getControlValues()).toEqual({});
});

test('getControlValues returns a copy of the current form_data', () => {
  const formData = { datasource: '1__table', viz_type: 'big_number' };
  activateExplore({ form_data: formData });
  const values = explore.getControlValues();
  expect(values).toEqual(formData);
  expect(values).not.toBe(formData);
});

test('getControlValue returns undefined when Explore is not the active surface', () => {
  expect(explore.getControlValue('viz_type')).toBeUndefined();
});

test("getControlValue returns a single control's current value", () => {
  activateExplore({
    form_data: { datasource: '1__table', viz_type: 'big_number' },
  });
  expect(explore.getControlValue('viz_type')).toBe('big_number');
  expect(explore.getControlValue('nonexistent')).toBeUndefined();
});

test('setControlValues throws when Explore is not the active surface', async () => {
  await expect(
    explore.setControlValues({ echart_options: '{}' }),
  ).rejects.toThrow('No chart is currently loaded in Explore');
});

test('setControlValues throws when active but no chart is loaded (no datasource)', async () => {
  activateExplore({ controls: {} });
  await expect(
    explore.setControlValues({ echart_options: '{}' }),
  ).rejects.toThrow('No chart is currently loaded in Explore');
});

test('setControlValues dispatches a programmatic setControlValue per entry', async () => {
  activateExplore();

  await explore.setControlValues({
    echart_options: '{ "title": "Revenue" }',
    row_limit: 100,
  });

  expect(setControlValue).toHaveBeenCalledWith(
    'echart_options',
    '{ "title": "Revenue" }',
    undefined,
    { programmatic: true },
  );
  expect(setControlValue).toHaveBeenCalledWith('row_limit', 100, undefined, {
    programmatic: true,
  });
  expect(mockDispatch).toHaveBeenCalledTimes(2);
});

test('getQuery throws when Explore is not the active surface', async () => {
  await expect(explore.getQuery()).rejects.toThrow(
    'No chart is currently loaded in Explore',
  );
});

test('getQuery builds form data from the current controls, not stale form_data', async () => {
  activateExplore({
    // A control the reducer's form_data hasn't caught up with yet (e.g.
    // filled in by a default or by mapStateToProps) should still be used.
    controls: { ...defaultControls, row_limit: { value: 100 } },
    form_data: { datasource: '1__table', viz_type: 'echarts_timeseries_bar' },
  });
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ query: 'SELECT 1' }] },
  });

  const sql = await explore.getQuery();

  expect(sql).toBe('SELECT 1');
  expect(mockGetChartDataRequest).toHaveBeenCalledWith({
    formData: {
      datasource: '1__table',
      viz_type: 'echarts_timeseries_bar',
      row_limit: 100,
    },
    resultFormat: 'json',
    resultType: 'query',
    ownState: undefined,
  });
});

test('getQuery includes the chart’s current ownState (e.g. table pagination)', async () => {
  activateExplore();
  mockGetState.mockReturnValue({
    explore: {
      slice: { slice_id: 55 },
      controls: defaultControls,
    },
    dataMask: { 55: { ownState: { currentPage: 2 } } },
  });
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ query: 'SELECT 1' }] },
  });

  await explore.getQuery();

  expect(mockGetChartDataRequest).toHaveBeenCalledWith(
    expect.objectContaining({ ownState: { currentPage: 2 } }),
  );
});

test('getQuery awaits an async job envelope instead of reading it as the result', async () => {
  activateExplore();
  // Simulates GLOBAL_ASYNC_QUERIES returning a 202 job envelope rather than
  // the actual result array.
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 202 },
    json: { result: [{ job_id: 'abc', channel_id: 'def' }] },
  });
  mockHandleChartDataResponse.mockResolvedValue([{ query: 'SELECT 1' }]);

  const sql = await explore.getQuery();

  expect(sql).toBe('SELECT 1');
  expect(mockHandleChartDataResponse).toHaveBeenCalledWith(
    { status: 202 },
    { result: [{ job_id: 'abc', channel_id: 'def' }] },
  );
});

test('getQuery throws when the result has an error', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ error: 'boom' }] },
  });

  await expect(explore.getQuery()).rejects.toThrow('boom');
});

test('getQuery throws a fallback message when no result comes back', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [] },
  });

  await expect(explore.getQuery()).rejects.toThrow(
    'Failed to retrieve the query',
  );
});

test('getChartData throws when Explore is not the active surface', async () => {
  await expect(explore.getChartData()).rejects.toThrow(
    'No chart is currently loaded in Explore',
  );
});

test('getChartData requests a full result and returns columns/rows', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: {
      result: [
        {
          colnames: ['region', 'sales'],
          data: [{ region: 'US', sales: 100 }],
        },
      ],
    },
  });

  const data = await explore.getChartData();

  expect(data).toEqual({
    columns: ['region', 'sales'],
    rows: [{ region: 'US', sales: 100 }],
  });
  expect(mockGetChartDataRequest).toHaveBeenCalledWith({
    formData: { datasource: '1__table', viz_type: 'echarts_timeseries_bar' },
    resultFormat: 'json',
    resultType: 'full',
    ownState: undefined,
  });
});

test('getChartData includes the chart’s current ownState (e.g. table pagination)', async () => {
  activateExplore();
  mockGetState.mockReturnValue({
    explore: {
      slice: { slice_id: 55 },
      controls: defaultControls,
    },
    dataMask: { 55: { ownState: { currentPage: 2 } } },
  });
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ colnames: [], data: [] }] },
  });

  await explore.getChartData();

  expect(mockGetChartDataRequest).toHaveBeenCalledWith(
    expect.objectContaining({ ownState: { currentPage: 2 } }),
  );
});

test('getChartData awaits an async job envelope instead of reading it as the result', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 202 },
    json: { result: [{ job_id: 'abc', channel_id: 'def' }] },
  });
  mockHandleChartDataResponse.mockResolvedValue([
    { colnames: ['region'], data: [{ region: 'US' }] },
  ]);

  const data = await explore.getChartData();

  expect(data).toEqual({ columns: ['region'], rows: [{ region: 'US' }] });
});

test('getChartData defaults columns and rows to [] when the result omits them', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{}] },
  });

  expect(await explore.getChartData()).toEqual({ columns: [], rows: [] });
});

test('getChartData throws when the result has an error', async () => {
  activateExplore();
  mockGetChartDataRequest.mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ error: 'boom' }] },
  });

  await expect(explore.getChartData()).rejects.toThrow('boom');
});
