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

import { ActiveFilters } from '../types';

/**
 * Returns the filter IDs that apply to a specific chart based on their scope.
 * This centralizes the logic for determining which dashboard filters
 * should be applied to a given chart.
 *
 * @param activeFilters - The currently active dashboard filters
 * @param chartId - The ID of the chart to check filter scope for
 * @returns Array of filter IDs that apply to the specified chart
 */
export const getFilterIdsAppliedOnChart = (
  activeFilters: ActiveFilters,
  chartId: number,
): string[] =>
  Object.entries(activeFilters)
    .filter(([, activeFilter]) => activeFilter.scope.includes(chartId))
    .map(([filterId]) => filterId);
