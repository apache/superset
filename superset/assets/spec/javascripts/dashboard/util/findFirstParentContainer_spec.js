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
import findFirstParentContainerId from '../../../../src/dashboard/util/findFirstParentContainer';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from '../../../../src/dashboard/util/constants';

describe('findFirstParentContainer', () => {
  const mockGridLayout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: {
      type: 'ROOT',
      id: 'ROOT_ID',
      children: ['GRID_ID'],
    },
    GRID_ID: {
      type: 'GRID',
      id: 'GRID_ID',
      children: ['ROW-Bk45URrlQ'],
    },
    'ROW-Bk45URrlQ': {
      type: 'ROW',
      id: 'ROW-Bk45URrlQ',
      children: ['CHART-ryxVc8RHlX'],
    },
    'CHART-ryxVc8RHlX': {
      type: 'CHART',
      id: 'CHART-ryxVc8RHlX',
      children: [],
    },
    HEADER_ID: {
      id: 'HEADER_ID',
      type: 'HEADER',
    },
  };
  const mockTabsLayout = {
    'CHART-S1gilYABe7': {
      children: [],
      id: 'CHART-S1gilYABe7',
      type: 'CHART',
    },
    'CHART-SJli5K0HlQ': {
      children: [],
      id: 'CHART-SJli5K0HlQ',
      type: 'CHART',
    },
    GRID_ID: {
      children: [],
      id: 'GRID_ID',
      type: 'GRID',
    },
    HEADER_ID: {
      id: 'HEADER_ID',
      type: 'HEADER',
    },
    ROOT_ID: {
      children: ['TABS-SkgJ5t0Bem'],
      id: 'ROOT_ID',
      type: 'ROOT',
    },
    'ROW-S1B8-JLgX': {
      children: ['CHART-SJli5K0HlQ'],
      id: 'ROW-S1B8-JLgX',
      type: 'ROW',
    },
    'ROW-S1bUb1Ilm': {
      children: ['CHART-S1gilYABe7'],
      id: 'ROW-S1bUb1Ilm',
      type: 'ROW',
    },
    'TABS-ByeLSWyLe7': {
      children: ['TAB-BJbLSZ1UeQ'],
      id: 'TABS-ByeLSWyLe7',
      type: 'TABS',
    },
    'TABS-SkgJ5t0Bem': {
      children: ['TAB-HkWJcFCHxQ', 'TAB-ByDBbkLlQ'],
      id: 'TABS-SkgJ5t0Bem',
      meta: {},
      type: 'TABS',
    },
    'TAB-BJbLSZ1UeQ': {
      children: ['ROW-S1bUb1Ilm'],
      id: 'TAB-BJbLSZ1UeQ',
      type: 'TAB',
    },
    'TAB-ByDBbkLlQ': {
      children: ['ROW-S1B8-JLgX'],
      id: 'TAB-ByDBbkLlQ',
      type: 'TAB',
    },
    'TAB-HkWJcFCHxQ': {
      children: ['TABS-ByeLSWyLe7'],
      id: 'TAB-HkWJcFCHxQ',
      type: 'TAB',
    },
    DASHBOARD_VERSION_KEY: 'v2',
  };

  it('should return grid root', () => {
    expect(findFirstParentContainerId(mockGridLayout)).toBe(DASHBOARD_GRID_ID);
  });

  it('should return first tab', () => {
    const tabsId = mockTabsLayout[DASHBOARD_ROOT_ID].children[0];
    const firstTabId = mockTabsLayout[tabsId].children[0];
    expect(findFirstParentContainerId(mockTabsLayout)).toBe(firstTabId);
  });
});
