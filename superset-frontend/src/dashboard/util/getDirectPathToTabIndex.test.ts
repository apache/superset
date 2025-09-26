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
import getDirectPathToTabIndex from './getDirectPathToTabIndex';

describe('getDirectPathToTabIndex', () => {
  it('builds path using parents, id, and child at index', () => {
    const tabs = {
      id: 'TABS_ID',
      parents: ['ROOT', 'ROW_1'],
      children: ['TAB_A', 'TAB_B', 'TAB_C'],
    };
    expect(getDirectPathToTabIndex(tabs, 1)).toEqual([
      'ROOT',
      'ROW_1',
      'TABS_ID',
      'TAB_B',
    ]);
  });

  it('handles missing parents', () => {
    const tabs = {
      id: 'TABS_ID',
      children: ['TAB_A'],
    };
    expect(getDirectPathToTabIndex(tabs, 0)).toEqual(['TABS_ID', 'TAB_A']);
  });
});
