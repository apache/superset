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
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { addDangerToast, addSuccessToast } from '../../messageToasts/actions';

export const SET_REPORT = 'SET_REPORT';
export function setReport(report) {
  return { type: SET_REPORT, report };
}

export function fetchUISpecificReport(
  userId,
  filter_field,
  creation_method,
  dashboardId,
) {
  const queryParams = rison.encode({
    filters: [
      {
        col: filter_field,
        opr: 'eq',
        value: dashboardId,
      },
      {
        col: 'creation_method',
        opr: 'eq',
        value: creation_method,
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
        dispatch(setReport(json));
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
  if (dashboardInfo) {
    dispatch(
      fetchUISpecificReport(
        user.userId,
        'dashboard_id',
        'dashboards',
        dashboardInfo.id,
      ),
    );
  } else {
    const [chartArr] = Object.keys(charts);
    dispatch(
      fetchUISpecificReport(
        explore.user.userId,
        'chart_id',
        'charts',
        charts[chartArr].id,
      ),
    );
  }
};

export const ADD_REPORT = 'ADD_REPORT';

export const addReport = report => dispatch =>
  SupersetClient.post({
    endpoint: `/api/v1/report/`,
    jsonPayload: report,
  })
    .then(({ json }) => {
      dispatch({ type: ADD_REPORT, json });
      dispatch(addSuccessToast(t('The report has been created')));
    })
    .catch(async e => {
      const parsedError = await getClientErrorObject(e);
      const errorMessage = parsedError.message;
      const errorArr = Object.keys(errorMessage);
      const error = errorMessage[errorArr[0]];
      dispatch(
        addDangerToast(
          t('An error occurred while editing this report: %s', error),
        ),
      );
    });

export const EDIT_REPORT = 'EDIT_REPORT';

export function editReport(id, report) {
  return function (dispatch) {
    SupersetClient.put({
      endpoint: `/api/v1/report/${id}`,
      jsonPayload: report,
    })
      .then(({ json }) => {
        dispatch({ type: EDIT_REPORT, json });
      })
      .catch(() =>
        dispatch(
          addDangerToast(t('An error occurred while editing this report.')),
        ),
      );
  };
}

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

export function deleteActiveReport(report) {
  return function deleteActiveReportThunk(dispatch) {
    return SupersetClient.delete({
      endpoint: encodeURI(`/api/v1/report/${report.id}`),
    })
      .catch(() => {
        dispatch(addDangerToast(t('Your report could not be deleted')));
      })
      .finally(() => {
        dispatch(structureFetchAction);
        dispatch(addSuccessToast(t('Deleted: %s', report.name)));
      });
  };
}
