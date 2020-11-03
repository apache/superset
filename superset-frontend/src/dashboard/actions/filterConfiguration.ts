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

import { SupersetClient } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { Filter } from '../components/filterConfig/types';
import { dashboardInfoChanged } from './dashboardInfo';

export const CREATE_FILTER_BEGIN = 'CREATE_FILTER';
export const CREATE_FILTER_COMPLETE = 'CREATE_FILTER_COMPLETE';
export const CREATE_FILTER_FAIL = 'CREATE_FILTER_FAIL';

const updateDashboard = (filter: Filter, id: string, metadata: any) => {
  console.log(
    JSON.stringify({
      ...metadata,
      filter_configuration: [...(metadata.filter_configuration || []), filter],
    }),
  );
  return SupersetClient.put({
    endpoint: `/api/v1/dashboard/${id}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json_metadata: JSON.stringify({
        ...metadata,
        filter_configuration: [
          ...(metadata.filter_configuration || []),
          filter,
        ],
      }),
    }),
  });
};

export const createFilter = (filter: Filter) => async (
  dispatch: Dispatch,
  getState: () => any,
) => {
  // start
  dispatch({
    type: CREATE_FILTER_BEGIN,
    filter,
  });
  // make api request
  const { id, metadata } = getState().dashboardInfo;
  const response = await updateDashboard(filter, id, metadata);
  dispatch(
    dashboardInfoChanged({
      metadata: JSON.parse(response.json.result.json_metadata),
    }),
  );
};

export const EDIT_FILTER = 'EDIT_FILTER';
export const editFilter = (filter: Filter) => ({
  type: EDIT_FILTER,
  filter,
});
