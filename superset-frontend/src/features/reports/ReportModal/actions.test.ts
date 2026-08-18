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
import fetchMock from 'fetch-mock';
import {
  addReport,
  editReport,
  deleteActiveReport,
  fetchUISpecificReport,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
  SET_REPORT,
} from './actions';

const REPORT_ENDPOINT = 'glob:*/api/v1/report/*';
const REPORT_POST_ENDPOINT = 'glob:*/api/v1/report/';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('addReport dispatches ADD_REPORT and success toast on success', async () => {
  const jsonResponse = { id: 1, result: { name: 'New Report' } };
  fetchMock.post(REPORT_POST_ENDPOINT, jsonResponse);
  const dispatch = jest.fn();

  await addReport({ name: 'New Report' })(dispatch);

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).toContain(ADD_REPORT);
  expect(types).toContain('ADD_TOAST');
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('SUCCESS_TOAST');
});

test('addReport dispatches danger toast on failure and rejects', async () => {
  fetchMock.post(REPORT_POST_ENDPOINT, 500);
  const dispatch = jest.fn();

  await expect(
    addReport({ name: 'Bad Report' })(dispatch),
  ).rejects.toBeDefined();

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).not.toContain(ADD_REPORT);
  expect(types).toContain('ADD_TOAST');
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('DANGER_TOAST');
});

test('editReport dispatches EDIT_REPORT and success toast on success', async () => {
  const jsonResponse = { id: 5, result: { name: 'Updated Report' } };
  fetchMock.put(REPORT_ENDPOINT, jsonResponse);
  const dispatch = jest.fn();

  await editReport(5, { name: 'Updated Report' })(dispatch);

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).toContain(EDIT_REPORT);
  expect(types).toContain('ADD_TOAST');
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('SUCCESS_TOAST');
});

test('editReport dispatches danger toast on failure and rejects', async () => {
  fetchMock.put(REPORT_ENDPOINT, 500);
  const dispatch = jest.fn();

  await expect(
    editReport(5, { name: 'Bad Update' })(dispatch),
  ).rejects.toBeDefined();

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).not.toContain(EDIT_REPORT);
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('DANGER_TOAST');
});

test('deleteActiveReport dispatches DELETE_REPORT and success toast on success', async () => {
  fetchMock.delete(REPORT_ENDPOINT, {});
  const dispatch = jest.fn();
  const report = {
    id: 10,
    name: 'To Delete',
    creation_method: 'dashboards',
    dashboard: 1,
  };

  await deleteActiveReport(report)(dispatch);

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).toContain(DELETE_REPORT);
  expect(types).toContain('ADD_TOAST');
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('SUCCESS_TOAST');
});

test('deleteActiveReport dispatches danger toast on failure', async () => {
  fetchMock.delete(REPORT_ENDPOINT, 500);
  const dispatch = jest.fn();
  const report = { id: 10, name: 'To Delete' };

  await deleteActiveReport(report)(dispatch);

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).not.toContain(DELETE_REPORT);
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('DANGER_TOAST');
});

test('fetchUISpecificReport dispatches SET_REPORT on success', async () => {
  const jsonResponse = { result: [{ id: 1, name: 'Dashboard Report' }] };
  fetchMock.get('glob:*/api/v1/report/?q=*', jsonResponse);
  const dispatch = jest.fn();

  await fetchUISpecificReport({
    userId: 1,
    filterField: 'dashboard_id',
    creationMethod: 'dashboards',
    resourceId: 42,
  })(dispatch);

  const setAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === SET_REPORT,
  )?.[0];
  expect(setAction).toBeDefined();
  expect(setAction.resourceId).toBe(42);
  expect(setAction.creationMethod).toBe('dashboards');
  expect(setAction.filterField).toBe('dashboard_id');
});

test('fetchUISpecificReport dispatches danger toast on failure', async () => {
  fetchMock.get('glob:*/api/v1/report/?q=*', 500);
  const dispatch = jest.fn();

  await fetchUISpecificReport({
    userId: 1,
    filterField: 'chart_id',
    creationMethod: 'charts',
    resourceId: 10,
  })(dispatch);

  const types = dispatch.mock.calls.map(([action]: any) => action.type);
  expect(types).not.toContain(SET_REPORT);
  expect(types).toContain('ADD_TOAST');
  const toastAction = dispatch.mock.calls.find(
    ([a]: any) => a.type === 'ADD_TOAST',
  )?.[0];
  expect(toastAction.payload.toastType).toBe('DANGER_TOAST');
});
