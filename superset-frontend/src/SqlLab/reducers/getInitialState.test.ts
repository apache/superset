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

import getInitialState from './getInitialState';

const apiData = {
  defaultDbId: 1,
  common: {
    conf: {
      DEFAULT_SQLLAB_LIMIT: 1,
    },
  },
  active_tab: null,
  tab_state_ids: [],
  databases: [],
  queries: [],
  requested_query: null,
  user: {
    userId: 1,
    username: 'some name',
  },
};
const apiDataWithTabState = {
  ...apiData,
  tab_state_ids: [{ id: 1 }],
  active_tab: { id: 1, table_schemas: [] },
};
describe('getInitialState', () => {
  it('should output the user that is passed in', () => {
    expect(getInitialState(apiData).sqlLab.user.userId).toEqual(1);
  });
  it('should return undefined instead of null for templateParams', () => {
    expect(
      getInitialState(apiDataWithTabState).sqlLab.queryEditors[0]
        .templateParams,
    ).toBeUndefined();
  });
});
