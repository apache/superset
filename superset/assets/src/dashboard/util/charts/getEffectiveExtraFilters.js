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

import * as _ from 'lodash';

export const filterKeys = [
  '__time_range',
  '__time_col',
  '__time_grain',
  '__time_origin',
  '__granularity',
];

const getOperatorOfColumn = (linkedSlicesExistInFilters, filteringSliceId, col) => {
  let op = 'in';

  let subscribe_slice = _.find(linkedSlicesExistInFilters, function (slice) {
    const sliceId = Object.keys(slice) && Object.keys(slice)[0];
    return (sliceId == filteringSliceId)
  });

  let subscribe_columns = subscribe_slice ? subscribe_slice[filteringSliceId] : [];

  let columnInfo = _.find(subscribe_columns, function (item) {
    return (item.col == col);
  });

  op = columnInfo ? columnInfo.op : op;

  return op;
}

const getFilter = (col, op, val) => {
  return {
    col: col,
    op: op,
    val: val,
  }
}

const valueToString = (value) => value ? value.toString() : value;

export function getEffectiveExtraFilters({
  dashboardMetadata,
  filters,
  sliceId,
  linkedSlicesExistInFilters,
}) {
  const immuneSlices = dashboardMetadata.filter_immune_slices || [];

  if (sliceId && immuneSlices.includes(sliceId)) {
    // The slice is immune to dashboard filters
    return [];
  }

  // Build a list of fields the slice is immune to filters on
  const effectiveFilters = [];
  let immuneToFields = [];
  if (
    sliceId &&
    dashboardMetadata.filter_immune_slice_fields &&
    dashboardMetadata.filter_immune_slice_fields[sliceId]
  ) {
    immuneToFields = dashboardMetadata.filter_immune_slice_fields[sliceId];
  }

  Object.keys(filters).forEach(filteringSliceId => {
    if (filteringSliceId === sliceId.toString()) {
      // Filters applied by the slice don't apply to itself
      return;
    }
    const filtersFromSlice = filters[filteringSliceId];
    Object.keys(filtersFromSlice).forEach(field => {
      if (!immuneToFields.includes(field)) {
        if (filterKeys.indexOf(field) == -1) {
          let op = getOperatorOfColumn(linkedSlicesExistInFilters, filteringSliceId, field);
          if (Array.isArray(filtersFromSlice[field])) {
            if (op == 'in' || op == 'not in') {
              effectiveFilters.push(getFilter(field, op, filtersFromSlice[field]));
            } else {
              filtersFromSlice[field].forEach(val => {
                effectiveFilters.push(getFilter(field, op, valueToString(val)));
              })
            }
          } else {
            if (op == 'in' || op == 'not in') {
              effectiveFilters.push(getFilter(field, op, [filtersFromSlice[field]]));
            } else {
              effectiveFilters.push(getFilter(field, op, valueToString(filtersFromSlice[field])));
            }
          }
        } else {
          effectiveFilters.push(getFilter(field, "in", filtersFromSlice[field]));
        }
      }
    });
  });

  return effectiveFilters;
}


export default {
  filterKeys,
  getEffectiveExtraFilters,
}