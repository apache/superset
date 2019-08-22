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
export default function getEffectiveExtraFilters({
  dashboardMetadata,
  filters,
  sliceId,
}) {
  const immuneSlices = dashboardMetadata.filterImmuneSlices || [];

  if (sliceId && immuneSlices.includes(sliceId)) {
    // The slice is immune to dashboard filters
    return [];
  }

  // Build a list of fields the slice is immune to filters on
  const effectiveFilters = [];
  let immuneToFields = [];
  if (
    sliceId &&
    dashboardMetadata.filterImmuneSliceFields &&
    dashboardMetadata.filterImmuneSliceFields[sliceId]
  ) {
    immuneToFields = dashboardMetadata.filterImmuneSliceFields[sliceId];
  }

  Object.keys(filters).forEach(filteringSliceId => {
    if (filteringSliceId === sliceId.toString()) {
      // Filters applied by the slice don't apply to itself
      return;
    }
    const filtersFromSlice = filters[filteringSliceId];
    Object.keys(filtersFromSlice).forEach(field => {
      if (!immuneToFields.includes(field)) {
        effectiveFilters.push({
          col: field,
          op: 'in',
          val: filtersFromSlice[field],
        });
      }
    });
  });

  return effectiveFilters;
}
