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
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
} from './constants';

// HEADER_ID is dashboard metadata rather than a rendered child, GRID_ID is
// retained empty and detached when a dashboard uses top-level tabs, and
// DASHBOARD_VERSION_KEY is a version string rather than a component.
const RESERVED_IDS = new Set<string>([
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
]);

/**
 * Drop components that cannot be reached from ROOT_ID.
 *
 * Detached components never render, but they survive in position_json and stay
 * visible to code that walks every layout entry or trusts the stale `parents`
 * of a node. A detached subtree containing a cycle is what crashes the filter
 * scope modal with "Maximum call stack size exceeded"; dropping it here also
 * returns any chart trapped inside to the pool of charts hydration re-adds to
 * the layout. Charts remain associated with the dashboard either way.
 */
export default function removeUnreachableComponents<
  T extends { children?: string[] },
>(layout: Record<string, T>): Record<string, T> {
  if (!layout[DASHBOARD_ROOT_ID]) {
    return layout;
  }

  const reachable = new Set<string>();
  const stack: string[] = [DASHBOARD_ROOT_ID];

  while (stack.length) {
    const id = stack.pop() as string;
    // doubles as the cycle guard: an id already seen is never expanded twice
    if (!reachable.has(id)) {
      reachable.add(id);
      (layout[id]?.children || []).forEach(childId => {
        if (layout[childId]) {
          stack.push(childId);
        }
      });
    }
  }

  const unreachable = Object.keys(layout).filter(
    id => !reachable.has(id) && !RESERVED_IDS.has(id),
  );

  if (!unreachable.length) {
    return layout;
  }

  const next = { ...layout };
  unreachable.forEach(id => {
    delete next[id];
  });

  return next;
}
