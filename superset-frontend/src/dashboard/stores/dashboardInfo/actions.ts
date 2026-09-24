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

/**
 * Imperative domain API for dashboard "info" client state — for use outside
 * render (event handlers, effects, non-React modules). Components import these
 * from `src/dashboard/stores` instead of calling
 * `useDashboardInfoStore.getState()` directly. Calls delegate to the store's own
 * actions so the devtools/subscribeWithSelector middleware stays applied. For
 * reactive reads in render, use the hooks in `./hooks`.
 */
import type { ChartCustomization } from '@superset-ui/core';
import type { DashboardInfo } from 'src/dashboard/types';
import { useDashboardInfoStore } from './useDashboardInfoStore';

export const setDashboardInfo = (newInfo: Partial<DashboardInfo>): void =>
  useDashboardInfoStore.getState().setDashboardInfo(newInfo);

export const setPendingChartCustomization = (
  pending: ChartCustomization,
): void =>
  useDashboardInfoStore.getState().setPendingChartCustomization(pending);

export const clearAllPendingChartCustomizations = (): void =>
  useDashboardInfoStore.getState().clearAllPendingChartCustomizations();

export const clearAllChartCustomizations = (): void =>
  useDashboardInfoStore.getState().clearAllChartCustomizations();
