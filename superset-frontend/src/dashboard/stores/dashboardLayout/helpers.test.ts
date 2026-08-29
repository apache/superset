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

import type { DashboardLayout } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  withParentsUpdate,
  recursivelyDeleteChildren,
  flagUnsavedChanges,
} from './helpers';
import { makeLayoutItem as item } from './fixtures';
import { useDashboardStateStore } from '../dashboardState';

// helpers/flagUnsavedChanges touches the dashboardState store; load real zustand.
jest.unmock('zustand');

describe('recursivelyDeleteChildren', () => {
  test('removes the node, its descendants, and detaches it from its parent', () => {
    const layout: DashboardLayout = {
      GRID: item({ id: 'GRID', type: 'GRID', children: ['ROW'] }),
      ROW: item({ id: 'ROW', type: 'ROW', children: ['CHART'] }),
      CHART: item({ id: 'CHART', type: 'CHART' }),
    };
    recursivelyDeleteChildren('ROW', 'GRID', layout);

    expect(layout.ROW).toBeUndefined();
    expect(layout.CHART).toBeUndefined();
    expect(layout.GRID.children).toEqual([]);
  });

  test('is a no-op when the component is missing', () => {
    const layout: DashboardLayout = {
      GRID: item({ id: 'GRID', type: 'GRID', children: [] }),
    };
    expect(() =>
      recursivelyDeleteChildren('MISSING', 'GRID', layout),
    ).not.toThrow();
    expect(layout.GRID).toBeDefined();
  });
});

describe('withParentsUpdate', () => {
  test('populates each component parents list from the root', () => {
    const layout: DashboardLayout = {
      [DASHBOARD_ROOT_ID]: item({
        id: DASHBOARD_ROOT_ID,
        type: 'ROOT',
        children: ['GRID'],
      }),
      GRID: item({ id: 'GRID', type: 'GRID', children: ['CHART'] }),
      CHART: item({ id: 'CHART', type: 'CHART' }),
    };
    const result = withParentsUpdate(layout);

    // The deep child's parents chain is recomputed from the root down.
    expect(result.CHART.parents).toEqual([DASHBOARD_ROOT_ID, 'GRID']);
    expect(result).toBe(layout); // returns the same (mutated) reference
  });

  test('returns the layout unchanged when there is no root', () => {
    const layout: DashboardLayout = {
      ORPHAN: item({ id: 'ORPHAN', type: 'CHART' }),
    };
    expect(withParentsUpdate(layout)).toBe(layout);
    expect(layout.ORPHAN.parents).toBeUndefined();
  });
});

describe('flagUnsavedChanges', () => {
  test('sets hasUnsavedChanges to true on the dashboardState store', () => {
    useDashboardStateStore.setState({ hasUnsavedChanges: false });
    flagUnsavedChanges();
    expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
  });
});
