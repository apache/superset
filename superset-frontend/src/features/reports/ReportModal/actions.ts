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
/* eslint camelcase: 0 */
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/ui';
import rison from 'rison';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { isEmpty } from 'lodash';
import { Dispatch, AnyAction } from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ReportObject, ReportCreationMethod } from 'src/features/reports/types';
import { DashboardInfo, ChartsState } from 'src/dashboard/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { ExplorePageState } from 'src/explore/types';

// Type definitions for report-related state
interface ReportApiResponse {
  result?: ReportObject[];
}

interface ReportApiJsonResponse {
  result: Partial<ReportObject>;
  id: number;
}

interface ReportRootState {
  user: UserWithPermissionsAndRoles;
  dashboardInfo: DashboardInfo;
  charts: ChartsState;
  explore: ExplorePageState['explore'] & {
    user?: UserWithPermissionsAndRoles;
  };
}

type ReportFilterField = 'dashboard_id' | 'chart_id';

export const SET_REPORT = 'SET_REPORT' as const;

export interface SetReportAction {
  type: typeof SET_REPORT;
  report: ReportApiResponse;
  resourceId: number;
  creationMethod: ReportCreationMethod;
  filterField: ReportFilterField;
}

export function setReport(
  report: ReportApiResponse,
  resourceId: number,
  creationMethod: ReportCreationMethod,
  filterField: ReportFilterField,
): SetReportAction {
  return { type: SET_REPORT, report, resourceId, creationMethod, filterField };
}

interface FetchUISpecificReportParams {
  userId: number | undefined;
  filterField: ReportFilterField;
  creationMethod: ReportCreationMethod;
  resourceId: number;
}

export function fetchUISpecificReport({
  userId,
  filterField,
  creationMethod,
  resourceId,
}: FetchUISpecificReportParams) {
  const queryParams = rison.encode({
    filters: [
      {
        col: filterField,
        opr: 'eq',
        value: resourceId,
      },
      {
        col: 'creation_method',
        opr: 'eq',
        value: creationMethod,
      },
      {
        col: 'created_by',
        opr: 'rel_o_m',
        value: userId,
      },
    ],
  });
  return function fetchUISpecificReportThunk(dispatch: Dispatch<AnyAction>) {
    return SupersetClient.get({
      endpoint: `/api/v1/report/?q=${queryParams}`,
    })
      .then(({ json }) => {
        dispatch(
          setReport(
            json as ReportApiResponse,
            resourceId,
            creationMethod,
            filterField,
          ),
        );
      })
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'There was an issue fetching reports attached to this dashboard.',
            ),
          ),
        ),
      );
  };
}

const structureFetchAction = (
  dispatch: ThunkDispatch<ReportRootState, unknown, AnyAction>,
  getState: () => ReportRootState,
) => {
  const state = getState();
  const { user, dashboardInfo, charts, explore } = state;
  if (!isEmpty(dashboardInfo)) {
    dispatch(
      fetchUISpecificReport({
        userId: user.userId,
        filterField: 'dashboard_id',
        creationMethod: 'dashboards',
        resourceId: dashboardInfo.id,
      }),
    );
  } else if (!isEmpty(charts)) {
    const [chartArr] = Object.keys(charts);
    dispatch(
      fetchUISpecificReport({
        userId: explore.user?.userId || user?.userId,
        filterField: 'chart_id',
        creationMethod: 'charts',
        resourceId: charts[chartArr].id,
      }),
    );
  }
};

export const ADD_REPORT = 'ADD_REPORT' as const;

export interface AddReportAction {
  type: typeof ADD_REPORT;
  json: ReportApiJsonResponse;
}

export const addReport =
  (report: Partial<ReportObject>) => (dispatch: Dispatch<AnyAction>) =>
    SupersetClient.post({
      endpoint: `/api/v1/report/`,
      jsonPayload: report,
    })
      .then(({ json }) => {
        dispatch({ type: ADD_REPORT, json } as AddReportAction);
        dispatch(addSuccessToast(t('The report has been created')));
      })
      .catch(() => {
        dispatch(addDangerToast(t('Failed to create report')));
      });

export const EDIT_REPORT = 'EDIT_REPORT' as const;

export interface EditReportAction {
  type: typeof EDIT_REPORT;
  json: ReportApiJsonResponse;
}

export const editReport =
  (id: number, report: Partial<ReportObject>) =>
  (dispatch: Dispatch<AnyAction>) =>
    SupersetClient.put({
      endpoint: `/api/v1/report/${id}`,
      jsonPayload: report,
    })
      .then(({ json }) => {
        dispatch({ type: EDIT_REPORT, json } as EditReportAction);
        dispatch(addSuccessToast(t('Report updated')));
      })
      .catch(() => {
        dispatch(addDangerToast(t('Failed to update report')));
      });

export function toggleActive(report: ReportObject, isActive: boolean) {
  return function toggleActiveThunk(
    dispatch: ThunkDispatch<ReportRootState, unknown, AnyAction>,
  ) {
    return SupersetClient.put({
      endpoint: encodeURI(`/api/v1/report/${report.id}`),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: isActive,
      }),
    })
      .catch(() => {
        dispatch(
          addDangerToast(
            t('We were unable to active or deactivate this report.'),
          ),
        );
      })
      .finally(() => {
        dispatch(structureFetchAction);
      });
  };
}

export const DELETE_REPORT = 'DELETE_REPORT' as const;

export interface DeleteReportAction {
  type: typeof DELETE_REPORT;
  report: ReportObject;
}

export function deleteActiveReport(report: ReportObject) {
  return function deleteActiveReportThunk(dispatch: Dispatch<AnyAction>) {
    return SupersetClient.delete({
      endpoint: encodeURI(`/api/v1/report/${report.id}`),
    })
      .then(() => {
        dispatch({ type: DELETE_REPORT, report } as DeleteReportAction);
        dispatch(addSuccessToast(t('Deleted: %s', report.name)));
      })
      .catch(() => {
        dispatch(addDangerToast(t('Your report could not be deleted')));
      });
  };
}

export type ReportAction =
  | SetReportAction
  | AddReportAction
  | EditReportAction
  | DeleteReportAction;
