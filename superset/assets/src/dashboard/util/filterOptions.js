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

// maps control names to their key in extra_filters
export const TIME_FILTER_MAP = {
  time_range: '__time_range',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};

export function flattenFilters(filters = {}) {
  // convert filters object into object of {column: [vals], etc.}
  const filterColumns = {};
  const timeFilters = Object.values(TIME_FILTER_MAP);

  Object.keys(filters).forEach(filterId => {
    const filter = filters[filterId];
    Object.keys(filter).forEach(column => {
      if (timeFilters.includes(column)) {
        // time filters still require a chart ID as e.g., timegrain can't be shared by multiple filters
        const currentFilters = filterColumns[filterId] || {};
        filterColumns[filterId] = {
          ...currentFilters,
          [column]: filter[column],
        };
      } else {
        // append column selections to existing filters
        const set = new Set([
          ...(filterColumns[column] || []),
          ...filter[column],
        ]);
        filterColumns[column] = Array.from(set);
      }
    });
  });

  return filterColumns;
}
