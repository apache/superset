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
import { SET_DATASOURCE } from '../actions/datasources';
import { HYDRATE_DASHBOARD } from '../actions/hydrate';

export default function datasourceReducer(datasources = {}, action) {
  const actionHandlers = {
    [HYDRATE_DASHBOARD]() {
      return action.data.datasources;
    },
    [SET_DATASOURCE]() {
      return action.datasource;
    },
  };

  if (action.type in actionHandlers) {
    if (action.key) {
      return {
        ...datasources,
        [action.key]: actionHandlers[action.type](
          datasources[action.key],
          action,
        ),
      };
    }
    return actionHandlers[action.type]();
  }
  return datasources;
}
