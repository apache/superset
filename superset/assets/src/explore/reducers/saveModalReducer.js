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
import * as actions from '../actions/saveModalActions';

export default function saveModalReducer(state = {}, action) {
  const actionHandlers = {
    [actions.FETCH_DASHBOARDS_SUCCEEDED]() {
      return Object.assign({}, state, { dashboards: action.choices });
    },
    [actions.FETCH_DASHBOARDS_FAILED]() {
      return Object.assign({}, state, {
        saveModalAlert: `fetching dashboards failed for ${action.userId}`,
      });
    },
    [actions.SAVE_SLICE_FAILED]() {
      return Object.assign({}, state, {
        saveModalAlert: 'Failed to save slice',
      });
    },
    [actions.SAVE_SLICE_SUCCESS](data) {
      return Object.assign({}, state, { data });
    },
    [actions.REMOVE_SAVE_MODAL_ALERT]() {
      return Object.assign({}, state, { saveModalAlert: null });
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
