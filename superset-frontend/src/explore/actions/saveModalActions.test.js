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

import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import { ADD_TOAST } from 'src/components/MessageToasts/actions';
import {
  createDashboard,
  createSlice,
  fetchDashboards,
  FETCH_DASHBOARDS_FAILED,
  FETCH_DASHBOARDS_SUCCEEDED,
  getDashboard,
  getSliceDashboards,
  SAVE_SLICE_FAILED,
  SAVE_SLICE_SUCCESS,
  updateSlice,
  getSlicePayload,
} from './saveModalActions';

/**
 * Tests fetchDashboards action
 */

const userId = 1;
const fetchDashboardsEndpoint = `glob:*/dashboardasync/api/read?_flt_0_owners=${1}`;
const mockDashboardData = {
  pks: ['id'],
  result: [{ id: 'id', dashboard_title: 'dashboard title' }],
};

test('fetchDashboards handles success', async () => {
  fetchMock.reset();
  fetchMock.get(fetchDashboardsEndpoint, mockDashboardData);
  const dispatch = sinon.spy();
  await fetchDashboards(userId)(dispatch);
  expect(fetchMock.calls(fetchDashboardsEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(FETCH_DASHBOARDS_SUCCEEDED);
});

test('fetchDashboards handles failure', async () => {
  fetchMock.reset();
  fetchMock.get(fetchDashboardsEndpoint, { throws: 'error' });
  const dispatch = sinon.spy();
  await fetchDashboards(userId)(dispatch);
  expect(fetchMock.calls(fetchDashboardsEndpoint)).toHaveLength(4); // 3 retries
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(FETCH_DASHBOARDS_FAILED);
});

const sliceId = 10;
const sliceName = 'New chart';
const vizType = 'sample_viz_type';
const datasourceId = 11;
const datasourceType = 'sample_datasource_type';
const dashboards = [12, 13];
const queryContext = { sampleKey: 'sampleValue' };
const formData = {
  viz_type: vizType,
  datasource: `${datasourceId}__${datasourceType}`,
  dashboards,
};
const mockExploreState = { explore: { form_data: formData } };

const sliceResponsePayload = {
  id: 10,
};

const sampleError = new Error('sampleError');

jest.mock('../exploreUtils', () => ({
  buildV1ChartDataPayload: jest.fn(() => queryContext),
}));

/**
 * Tests updateSlice action
 */

const updateSliceEndpoint = `glob:*/api/v1/chart/${sliceId}`;
test('updateSlice handles success', async () => {
  fetchMock.reset();
  fetchMock.put(updateSliceEndpoint, sliceResponsePayload);
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  const slice = await updateSlice(
    { slice_id: sliceId },
    sliceName,
    [],
  )(dispatch, getState);

  expect(fetchMock.calls(updateSliceEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(2);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_SUCCESS);
  expect(dispatch.getCall(1).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(1).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(1).args[0].payload.text).toBe(
    'Chart [New chart] has been overwritten',
  );

  expect(slice).toEqual(sliceResponsePayload);
});

test('updateSlice handles failure', async () => {
  fetchMock.reset();
  fetchMock.put(updateSliceEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  let caughtError;
  try {
    await updateSlice({ slice_id: sliceId }, sliceName, [])(dispatch, getState);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(updateSliceEndpoint)).toHaveLength(4);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_FAILED);
});

/**
 * Tests createSlice action
 */

const createSliceEndpoint = `glob:*/api/v1/chart/`;
test('createSlice handles success', async () => {
  fetchMock.reset();
  fetchMock.post(createSliceEndpoint, sliceResponsePayload);
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  const slice = await createSlice(sliceName, [])(dispatch, getState);
  expect(fetchMock.calls(createSliceEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(2);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_SUCCESS);
  expect(dispatch.getCall(1).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(1).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(1).args[0].payload.text).toBe(
    'Chart [New chart] has been saved',
  );

  expect(slice).toEqual(sliceResponsePayload);
});

test('createSlice handles failure', async () => {
  fetchMock.reset();
  fetchMock.post(createSliceEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  let caughtError;
  try {
    await createSlice(sliceName, [])(dispatch, getState);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(createSliceEndpoint)).toHaveLength(4);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_FAILED);
});

const dashboardId = 14;
const dashboardName = 'New dashboard';
const dashboardResponsePayload = {
  id: 14,
};

/**
 * Tests createDashboard action
 */

const createDashboardEndpoint = `glob:*/api/v1/dashboard/`;
test('createDashboard handles success', async () => {
  fetchMock.reset();
  fetchMock.post(createDashboardEndpoint, dashboardResponsePayload);
  const dispatch = sinon.spy();
  const dashboard = await createDashboard(dashboardName)(dispatch);
  expect(fetchMock.calls(createDashboardEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(0);
  expect(dashboard).toEqual(dashboardResponsePayload);
});

test('createDashboard handles failure', async () => {
  fetchMock.reset();
  fetchMock.post(createDashboardEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();
  let caughtError;
  try {
    await createDashboard(dashboardName)(dispatch);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(createDashboardEndpoint)).toHaveLength(4);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_FAILED);
});

/**
 * Tests getDashboard action
 */

const getDashboardEndpoint = `glob:*/api/v1/dashboard/${dashboardId}`;
test('getDashboard handles success', async () => {
  fetchMock.reset();
  fetchMock.get(getDashboardEndpoint, dashboardResponsePayload);
  const dispatch = sinon.spy();
  const dashboard = await getDashboard(dashboardId)(dispatch);
  expect(fetchMock.calls(getDashboardEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(0);
  expect(dashboard).toEqual(dashboardResponsePayload);
});

test('getDashboard handles failure', async () => {
  fetchMock.reset();
  fetchMock.get(getDashboardEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();
  let caughtError;
  try {
    await getDashboard(dashboardId)(dispatch);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(getDashboardEndpoint)).toHaveLength(4);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_FAILED);
});

test('updateSlice with add to new dashboard handles success', async () => {
  fetchMock.reset();
  fetchMock.put(updateSliceEndpoint, sliceResponsePayload);
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  const slice = await updateSlice({ slice_id: sliceId }, sliceName, [], {
    new: true,
    title: dashboardName,
  })(dispatch, getState);

  expect(fetchMock.calls(updateSliceEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(3);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_SUCCESS);
  expect(dispatch.getCall(1).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(1).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(1).args[0].payload.text).toBe(
    'Chart [New chart] has been overwritten',
  );
  expect(dispatch.getCall(2).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(2).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(2).args[0].payload.text).toBe(
    'Dashboard [New dashboard] just got created and chart [New chart] was added to it',
  );

  expect(slice).toEqual(sliceResponsePayload);
});

test('updateSlice with add to existing dashboard handles success', async () => {
  fetchMock.reset();
  fetchMock.put(updateSliceEndpoint, sliceResponsePayload);
  const dispatch = sinon.spy();
  const getState = sinon.spy(() => mockExploreState);
  const slice = await updateSlice({ slice_id: sliceId }, sliceName, [], {
    new: false,
    title: dashboardName,
  })(dispatch, getState);

  expect(fetchMock.calls(updateSliceEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(3);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_SUCCESS);
  expect(dispatch.getCall(1).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(1).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(1).args[0].payload.text).toBe(
    'Chart [New chart] has been overwritten',
  );
  expect(dispatch.getCall(2).args[0].type).toBe(ADD_TOAST);
  expect(dispatch.getCall(2).args[0].payload.toastType).toBe('SUCCESS_TOAST');
  expect(dispatch.getCall(2).args[0].payload.text).toBe(
    'Chart [New chart] was added to dashboard [New dashboard]',
  );

  expect(slice).toEqual(sliceResponsePayload);
});

const slice = { slice_id: 10 };
const dashboardSlicesResponsePayload = {
  result: {
    dashboards: [{ id: 21 }, { id: 22 }, { id: 23 }],
  },
};

const getDashboardSlicesReturnValue = [21, 22, 23];

/**
 * Tests getSliceDashboards action
 */

const getSliceDashboardsEndpoint = `glob:*/api/v1/chart/${sliceId}?q=(columns:!(dashboards.id))`;
test('getSliceDashboards with slice handles success', async () => {
  fetchMock.reset();
  fetchMock.get(getSliceDashboardsEndpoint, dashboardSlicesResponsePayload);
  const dispatch = sinon.spy();
  const sliceDashboards = await getSliceDashboards(slice)(dispatch);
  expect(fetchMock.calls(getSliceDashboardsEndpoint)).toHaveLength(1);
  expect(dispatch.callCount).toBe(0);
  expect(sliceDashboards).toEqual(getDashboardSlicesReturnValue);
});

test('getSliceDashboards with slice handles failure', async () => {
  fetchMock.reset();
  fetchMock.get(getSliceDashboardsEndpoint, { throws: sampleError });
  const dispatch = sinon.spy();
  let caughtError;
  try {
    await getSliceDashboards(slice)(dispatch);
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toEqual(sampleError);
  expect(fetchMock.calls(getSliceDashboardsEndpoint)).toHaveLength(4);
  expect(dispatch.callCount).toBe(1);
  expect(dispatch.getCall(0).args[0].type).toBe(SAVE_SLICE_FAILED);
});

describe('getSlicePayload', () => {
  const sliceName = 'Test Slice';
  const formDataWithNativeFilters = {
    datasource: '22__table',
    viz_type: 'pie',
    adhoc_filters: [],
  };
  const dashboards = [5];
  const owners = [1];
  const formDataFromSlice = {
    datasource: '22__table',
    viz_type: 'pie',
    adhoc_filters: [
      {
        clause: 'WHERE',
        subject: 'year',
        operator: 'TEMPORAL_RANGE',
        comparator: 'No filter',
        expressionType: 'SIMPLE',
      },
    ],
  };

  test('should return the correct payload when no adhoc_filters are present in formDataWithNativeFilters', () => {
    const result = getSlicePayload(
      sliceName,
      formDataWithNativeFilters,
      dashboards,
      owners,
      formDataFromSlice,
    );
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('slice_name', sliceName);
    expect(result).toHaveProperty(
      'viz_type',
      formDataWithNativeFilters.viz_type,
    );
    expect(result).toHaveProperty('datasource_id', 22);
    expect(result).toHaveProperty('datasource_type', 'table');
    expect(result).toHaveProperty('dashboards', dashboards);
    expect(result).toHaveProperty('owners', owners);
    expect(result).toHaveProperty('query_context');
    expect(JSON.parse(result.params).adhoc_filters).toEqual(
      formDataFromSlice.adhoc_filters,
    );
  });

  test('should return the correct payload when adhoc_filters are present in formDataWithNativeFilters', () => {
    const formDataWithAdhocFilters = {
      ...formDataWithNativeFilters,
      adhoc_filters: [
        {
          clause: 'WHERE',
          subject: 'year',
          operator: 'TEMPORAL_RANGE',
          comparator: 'No filter',
          expressionType: 'SIMPLE',
        },
      ],
    };
    const result = getSlicePayload(
      sliceName,
      formDataWithAdhocFilters,
      dashboards,
      owners,
      formDataFromSlice,
    );
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('slice_name', sliceName);
    expect(result).toHaveProperty(
      'viz_type',
      formDataWithAdhocFilters.viz_type,
    );
    expect(result).toHaveProperty('datasource_id', 22);
    expect(result).toHaveProperty('datasource_type', 'table');
    expect(result).toHaveProperty('dashboards', dashboards);
    expect(result).toHaveProperty('owners', owners);
    expect(result).toHaveProperty('query_context');
    expect(JSON.parse(result.params).adhoc_filters).toEqual(
      formDataWithAdhocFilters.adhoc_filters,
    );
  });

  test('should return the correct payload when formDataWithNativeFilters has a filter with isExtra set to true', () => {
    const formDataWithAdhocFiltersWithExtra = {
      ...formDataWithNativeFilters,
      adhoc_filters: [
        {
          clause: 'WHERE',
          subject: 'year',
          operator: 'TEMPORAL_RANGE',
          comparator: 'No filter',
          expressionType: 'SIMPLE',
          isExtra: true,
        },
      ],
    };
    const result = getSlicePayload(
      sliceName,
      formDataWithAdhocFiltersWithExtra,
      dashboards,
      owners,
      formDataFromSlice,
    );
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('slice_name', sliceName);
    expect(result).toHaveProperty(
      'viz_type',
      formDataWithAdhocFiltersWithExtra.viz_type,
    );
    expect(result).toHaveProperty('datasource_id', 22);
    expect(result).toHaveProperty('datasource_type', 'table');
    expect(result).toHaveProperty('dashboards', dashboards);
    expect(result).toHaveProperty('owners', owners);
    expect(result).toHaveProperty('query_context');
    expect(JSON.parse(result.params).adhoc_filters).toEqual(
      formDataFromSlice.adhoc_filters,
    );
  });
});
