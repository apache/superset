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
import { findTabsToRestore } from './findTabsToRestore';

const layout = {
  'TAB-A': { id: 'TAB-A', type: 'TAB', parents: ['ROOT_ID', 'TABS-1'] },
  'TAB-B': {
    id: 'TAB-B',
    type: 'TAB',
    parents: ['ROOT_ID', 'TABS-1', 'TAB-A', 'TABS-2'],
  },
  'TAB-C': {
    id: 'TAB-C',
    type: 'TAB',
    parents: ['ROOT_ID', 'TABS-1', 'TAB-A', 'TABS-2', 'TAB-B', 'TABS-3'],
  },
} as unknown as DashboardLayout;

test('restores multi-depth nested inactive tabs when navigating to an ancestor', () => {
  const { activeTabs } = findTabsToRestore(
    'TAB-A',
    undefined,
    { activeTabs: [], inactiveTabs: ['TAB-B', 'TAB-C'] },
    layout,
  );
  expect(activeTabs).toEqual(['TAB-A', 'TAB-B', 'TAB-C']);
});

test('deactivates the prior tab’s siblings when switching tabs', () => {
  const { activeTabs, inactiveTabs } = findTabsToRestore(
    'TAB-A',
    'TAB-B',
    { activeTabs: ['TAB-B'], inactiveTabs: [] },
    {
      'TAB-A': { id: 'TAB-A', type: 'TAB', parents: ['ROOT_ID', 'TABS-1'] },
      'TAB-B': { id: 'TAB-B', type: 'TAB', parents: ['ROOT_ID', 'TABS-1'] },
    } as unknown as DashboardLayout,
  );
  expect(activeTabs).toEqual(['TAB-A']);
  expect(inactiveTabs).toEqual([]);
});
