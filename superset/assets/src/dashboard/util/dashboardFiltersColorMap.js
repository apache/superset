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
// should be consistent with @badge-colors .less variable
const FILTER_COLORS_COUNT = 20;

let filterColorMap = {};

export function getFilterColorKey(chartId, column) {
  return `${chartId}_${column}`;
}

export function getFilterColorMap() {
  return filterColorMap;
}

export function buildFilterColorMap(allDashboardFilters = {}) {
  let filterColorIndex = 1;
  filterColorMap = Object.values(allDashboardFilters).reduce(
    (colorMap, filter) => {
      const { chartId, columns } = filter;

      Object.keys(columns)
        .sort()
        .forEach(column => {
          const key = getFilterColorKey(chartId, column);
          const colorCode = `badge-${filterColorIndex % FILTER_COLORS_COUNT}`;
          /* eslint-disable no-param-reassign */
          colorMap[key] = colorCode;

          filterColorIndex += 1;
        });

      return colorMap;
    },
    {},
  );
}
