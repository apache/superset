/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
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
import updateComponentParentsList from 'src/dashboard/util/updateComponentParentsList';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  dashboardLayout,
  dashboardLayoutWithTabs,
} from '../fixtures/mockDashboardLayout';

describe('updateComponentParentsList', () => {
  const emptyLayout = {
    DASHBOARD_VERSION_KEY: 'v2',
    GRID_ID: {
      children: [],
      id: 'GRID_ID',
      type: 'GRID',
    },
    ROOT_ID: {
      children: ['GRID_ID'],
      id: 'ROOT_ID',
      type: 'ROOT',
    },
  };
  const gridLayout = {
    ...dashboardLayout.present,
  };
  const tabsLayout = {
    ...dashboardLayoutWithTabs.present,
  };

  it('should handle empty layout', () => {
    const nextState = {
      ...emptyLayout,
    };

    updateComponentParentsList({
      currentComponent: nextState[DASHBOARD_ROOT_ID],
      layout: nextState,
    });

    expect(nextState.GRID_ID.parents).toEqual(['ROOT_ID']);
  });

  it('should handle grid layout', () => {
    const nextState = {
      ...gridLayout,
    };

    updateComponentParentsList({
      currentComponent: nextState[DASHBOARD_ROOT_ID],
      layout: nextState,
    });

    expect(nextState.GRID_ID.parents).toEqual(['ROOT_ID']);
    expect(nextState.CHART_ID.parents).toEqual([
      'ROOT_ID',
      'GRID_ID',
      'ROW_ID',
      'COLUMN_ID',
    ]);
  });

  it('should handle root level tabs', () => {
    const nextState = {
      ...tabsLayout,
    };

    updateComponentParentsList({
      currentComponent: nextState[DASHBOARD_ROOT_ID],
      layout: nextState,
    });

    expect(nextState.GRID_ID.parents).toEqual(['ROOT_ID']);
    expect(nextState.CHART_ID2.parents).toEqual([
      'ROOT_ID',
      'TABS_ID',
      'TAB_ID2',
      'ROW_ID2',
    ]);
  });
});
