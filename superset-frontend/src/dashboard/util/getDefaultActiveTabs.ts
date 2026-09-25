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
import { DashboardLayout } from '../types';
import { TABS_TYPE } from './componentTypes';
import { DASHBOARD_ROOT_ID } from './constants';

// Default active-tab path a freshly-rendered dashboard shows: ROOT → first
// TABS → first TAB, recursing into nested TABS. Empty for non-tabbed layouts
// and for layouts whose top-level TABS is not the first ROOT child (e.g. TABS
// nested under GRID), matching the live Tabs component's default selection.
export default function getDefaultActiveTabs(
  layout: DashboardLayout,
): string[] {
  const root = layout?.[DASHBOARD_ROOT_ID];
  const top = root?.children?.length ? layout[root.children[0]] : undefined;
  if (top?.type !== TABS_TYPE || !top.children?.length) return [];

  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [top.children[0]];
  while (queue.length) {
    const tabId = queue.shift() as string;
    if (visited.has(tabId)) continue;
    visited.add(tabId);
    result.push(tabId);
    layout[tabId]?.children?.forEach(childId => {
      const child = layout[childId];
      if (
        child?.type === TABS_TYPE &&
        child.children?.length &&
        !visited.has(child.children[0])
      ) {
        queue.push(child.children[0]);
      }
    });
  }
  return result;
}
