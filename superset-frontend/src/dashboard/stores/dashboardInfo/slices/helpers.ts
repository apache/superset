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

import type { DashboardInfo } from 'src/dashboard/types';

/** Convenience alias for the dashboard metadata blob shared across slices. */
export type DashboardMetadata = DashboardInfo['metadata'];

export const nowInSeconds = () => Math.round(Date.now() / 1000);

/** Base shape for items that can have scopes preserved. */
interface ScopedConfigItem {
  id: string;
  chartsInScope?: number[];
  tabsInScope?: string[];
}

/**
 * Carries forward client-only scope data (chartsInScope, tabsInScope) when a
 * config is refreshed from the server, which omits those fields.
 */
export function preserveScopes<T extends ScopedConfigItem>(
  existingConfig: T[] | undefined,
  incomingConfig: T[] | undefined,
): T[] {
  const truthyExistingConfig = (existingConfig || []).filter(Boolean);
  const truthyIncomingConfig = (incomingConfig || []).filter(Boolean);

  const existingScopesMap = truthyExistingConfig.reduce<
    Record<string, { chartsInScope?: number[]; tabsInScope?: string[] }>
  >((acc, item) => {
    if (item.chartsInScope != null || item.tabsInScope != null) {
      acc[item.id] = {
        chartsInScope: item.chartsInScope,
        tabsInScope: item.tabsInScope,
      };
    }
    return acc;
  }, {});

  return truthyIncomingConfig.map(item => {
    const existingScopes = existingScopesMap[item.id];
    if (item.chartsInScope == null && existingScopes) {
      return {
        ...item,
        chartsInScope: existingScopes.chartsInScope,
        tabsInScope: existingScopes.tabsInScope,
      };
    }
    return item;
  });
}
