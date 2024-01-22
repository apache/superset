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
import { t, SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import {
  addDangerToast,
  addSuccessToast,
} from 'src/components/MessageToasts/actions';
import { isEmpty } from 'lodash';

export const SET_REPORT = 'SET_REPORT';
export function setReport(report, resourceId, creationMethod, filterField) {
  return { type: SET_REPORT, report, resourceId, creationMethod, filterField };
}

export function fetchUISpecificReport({
  userId,
  filterField,
  creationMethod,
  resourceId,
}) {
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
  return function fetchUISpecificReportThunk(dispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/report/?q=${queryParams}`,
    })
      .then(({ json }) => {
        dispatch(setReport(json, resourceId, creationMethod, filterField));
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

const structureFetchAction = (dispatch, getState) => {
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
  } else {
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

export const ADD_REPORT = 'ADD_REPORT';

export const addReport = report => dispatch =>
  SupersetClient.post({
    endpoint: `/api/v1/report/`,
    jsonPayload: report,
  }).then(({ json }) => {
    dispatch({ type: ADD_REPORT, json });
    dispatch(addSuccessToast(t('The report has been created')));
  });

export const EDIT_REPORT = 'EDIT_REPORT';

export const editReport = (id, report) => dispatch =>
  SupersetClient.put({
    endpoint: `/api/v1/report/${id}`,
    jsonPayload: report,
  }).then(({ json }) => {
    dispatch({ type: EDIT_REPORT, json });
    dispatch(addSuccessToast(t('Report updated')));
  });

export function toggleActive(report, isActive) {
  return function toggleActiveThunk(dispatch) {
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

export const DELETE_REPORT = 'DELETE_REPORT';

export function deleteActiveReport(report) {
  return function deleteActiveReportThunk(dispatch) {
    return SupersetClient.delete({
      endpoint: encodeURI(`/api/v1/report/${report.id}`),
    })
      .catch(() => {
        dispatch(addDangerToast(t('Your report could not be deleted')));
      })
      .finally(() => {
        dispatch({ type: DELETE_REPORT, report });
        dispatch(addSuccessToast(t('Deleted: %s', report.name)));
      });
  };
}
