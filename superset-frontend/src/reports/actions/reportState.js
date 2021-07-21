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
import { addDangerToast } from '../../messageToasts/actions';

export const SET_REPORT = 'SET_REPORT';
export function setReport(report) {
  return { type: SET_REPORT, report };
}
export function fetchUISpecificReport(userId, creation_method, dashboardId) {
  const queryParams = rison.encode({
    filters: [
      {
        col: 'dashboard_id',
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
