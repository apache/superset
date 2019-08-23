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
let activeFilters = {};

export function getActiveFilters() {
  return activeFilters;
}

// non-empty filters from dashboardFilters,
// this function does not take into account: filter immune or filter scope settings
export function buildActiveFilters(allDashboardFilters = {}) {
  activeFilters = Object.values(allDashboardFilters).reduce(
    (result, filter) => {
      const { chartId, columns } = filter;

      Object.keys(columns).forEach(key => {
        if (
          Array.isArray(columns[key])
            ? columns[key].length
            : columns[key] !== undefined
        ) {
          /* eslint-disable no-param-reassign */
          result[chartId] = {
            ...result[chartId],
            [key]: columns[key],
          };
        }
      });

      return result;
    },
    {},
  );
}
