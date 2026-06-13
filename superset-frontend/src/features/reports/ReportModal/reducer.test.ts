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
import reportsReducer, { ReportsState } from './reducer';
import {
  SET_REPORT,
  ADD_REPORT,
  EDIT_REPORT,
  DELETE_REPORT,
  SetReportAction,
  AddReportAction,
  EditReportAction,
  DeleteReportAction,
} from './actions';
import { ReportObject } from 'src/features/reports/types';

const makeReport = (overrides: Partial<ReportObject> = {}): ReportObject => ({
  active: true,
  crontab: '0 12 * * 1',
  name: 'Test Report',
  owners: [1],
  recipients: [
    {
      recipient_config_json: { target: 'a@b.com', ccTarget: '', bccTarget: '' },
      type: 'Email',
    },
  ],
  report_format: 'PNG',
  timezone: 'UTC',
  type: 'Report',
  validator_config_json: null,
  validator_type: '',
  working_timeout: 3600,
  log_retention: 90,
  creation_method: 'dashboards',
  force_screenshot: false,
  ...overrides,
});

test('SET_REPORT stores report keyed by resourceId under creationMethod', () => {
  const report = makeReport({ id: 5, dashboard: 10 });
  const action: SetReportAction = {
    type: SET_REPORT,
    report: { result: [report] },
    resourceId: 10,
    creationMethod: 'dashboards',
    filterField: 'dashboard_id',
  };

  const result = reportsReducer({}, action);

  expect(result.dashboards?.[10]).toEqual(report);
});

test('SET_REPORT removes entry when API returns empty result', () => {
  const initial: ReportsState = {
    dashboards: { 10: makeReport({ id: 5, dashboard: 10 }) },
  };
  const action: SetReportAction = {
    type: SET_REPORT,
    report: { result: [] },
    resourceId: 10,
    creationMethod: 'dashboards',
    filterField: 'dashboard_id',
  };

  const result = reportsReducer(initial, action);

  expect(result.dashboards?.[10]).toBeUndefined();
});

test('SET_REPORT uses chart property when filterField is chart_id', () => {
  const report = makeReport({
    id: 7,
    chart: 42,
    creation_method: 'charts',
  });
  const action: SetReportAction = {
    type: SET_REPORT,
    report: { result: [report] },
    resourceId: 42,
    creationMethod: 'charts',
    filterField: 'chart_id',
  };

  const result = reportsReducer({}, action);

  expect(result.charts?.[42]).toEqual(report);
});

test('ADD_REPORT keys dashboard report by dashboard id', () => {
  const action: AddReportAction = {
    type: ADD_REPORT,
    json: {
      id: 1,
      result: { dashboard: 10, creation_method: 'dashboards' },
    },
  };

  const result = reportsReducer({}, action);

  expect(result.dashboards?.[10]).toMatchObject({ id: 1, dashboard: 10 });
});

test('ADD_REPORT keys alerts_reports report by report id', () => {
  const action: AddReportAction = {
    type: ADD_REPORT,
    json: {
      id: 99,
      result: { creation_method: 'alerts_reports' },
    },
  };

  const result = reportsReducer({}, action);

  expect(result.alerts_reports?.[99]).toMatchObject({ id: 99 });
});

test('ADD_REPORT returns unchanged state when key is undefined', () => {
  const initial: ReportsState = { dashboards: {} };
  const action: AddReportAction = {
    type: ADD_REPORT,
    json: {
      id: 1,
      result: { creation_method: 'dashboards' },
      // no dashboard or chart field → key is undefined
    },
  };

  const result = reportsReducer(initial, action);

  expect(result).toBe(initial);
});

test('EDIT_REPORT replaces existing report at same key', () => {
  const initial: ReportsState = {
    dashboards: {
      10: makeReport({ id: 1, dashboard: 10, name: 'Old Name' }),
    },
  };
  const action: EditReportAction = {
    type: EDIT_REPORT,
    json: {
      id: 1,
      result: {
        dashboard: 10,
        creation_method: 'dashboards',
        name: 'New Name',
      },
    },
  };

  const result = reportsReducer(initial, action);

  expect(result.dashboards?.[10]?.name).toBe('New Name');
});

test('DELETE_REPORT removes report from state', () => {
  const report = makeReport({
    id: 5,
    dashboard: 10,
    creation_method: 'dashboards',
  });
  const initial: ReportsState = { dashboards: { 10: report } };
  const action: DeleteReportAction = {
    type: DELETE_REPORT,
    report: {
      id: 5,
      dashboard: 10,
      creation_method: 'dashboards',
    },
  };

  const result = reportsReducer(initial, action);

  expect(result.dashboards?.[10]).toBeUndefined();
});

test('DELETE_REPORT for alerts_reports keys by report id', () => {
  const report = makeReport({ id: 99, creation_method: 'alerts_reports' });
  const initial: ReportsState = { alerts_reports: { 99: report } };
  const action: DeleteReportAction = {
    type: DELETE_REPORT,
    report: { id: 99, creation_method: 'alerts_reports' },
  };

  const result = reportsReducer(initial, action);

  expect(result.alerts_reports?.[99]).toBeUndefined();
});

test('unknown action type returns state unchanged', () => {
  const initial: ReportsState = { dashboards: { 1: makeReport({ id: 1 }) } };
  const action = { type: 'UNKNOWN_ACTION' } as any;

  const result = reportsReducer(initial, action);

  expect(result).toBe(initial);
});
