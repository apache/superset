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
import type { CoreSlice } from './slices/coreSlice';
import type { FilterSettingsSlice } from './slices/filterSettingsSlice';
import type { ChartCustomizationSlice } from './slices/chartCustomizationSlice';

/**
 * Loose shape for hydration input: the payload attaches permission flags
 * (superset_can_explore, superset_can_share, …) that are not part of the
 * DashboardInfo type, and may be partial.
 */
export type DashboardInfoData = Partial<DashboardInfo> & {
  last_modified_time?: number;
  [key: string]: unknown;
};

export type DashboardInfoStore = CoreSlice &
  FilterSettingsSlice &
  ChartCustomizationSlice;
