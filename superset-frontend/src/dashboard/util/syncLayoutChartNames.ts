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

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { LayoutItem } from '../types';

/**
 * Sync chart names in dashboard layout with current API data.
 *
 * Overwrites meta.sliceName in layout CHART components with the latest name
 * from the /charts API. Handles stale position_json when a chart was renamed
 * in Explore after the dashboard was last saved.
 *
 * When content localization is enabled, position_json already contains
 * server-localized names via the full priority chain:
 *   1. Dashboard override translation
 *   2. Dashboard override name
 *   3. Chart translation
 *   4. Original chart name
 *
 * The /charts API only carries chart-level translations (3-4) and would
 * overwrite dashboard-level overrides (1-2). Skip sync to preserve
 * the server's authoritative localized names.
 */
export default function syncLayoutChartNames(
  layout: Record<string, LayoutItem>,
  chartIdToLayoutId: Record<number, string>,
  chartId: number,
  sliceName: string,
): void {
  if (isFeatureEnabled(FeatureFlag.EnableContentLocalization)) {
    return;
  }

  const layoutId = chartIdToLayoutId[chartId];
  if (layoutId && layout[layoutId]) {
    layout[layoutId].meta.sliceName = sliceName;
  }
}
