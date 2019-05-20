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
import { getEffectiveExtraFilters, filterKeys } from './getEffectiveExtraFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
const cachedDashboardMetadataByChart = {};
const cachedFiltersByChart = {};
const cachedFormdataByChart = {};

const getExtraFilters = (subscriberMap, globalFilters, slicesInState) => {
  if (subscriberMap && subscriberMap.actions.indexOf("APPLY_FILTER") > -1) {
    const filters = getFiltersFromSlices(slicesInState, globalFilters)
    return filters;
  }
  return {};
}

const getFiltersFromSlices = (slices, globalFilters) => {
  const filters = {};
  slices.forEach(slice => {
    const sliceId = Object.keys(slice) && Object.keys(slice)[0];
    const subscribe_columns = slice[sliceId]
    filters[sliceId] = {}
    subscribe_columns.forEach(item => {
      if (globalFilters[sliceId].hasOwnProperty(item.col)) {
        filters[sliceId][item.col] = globalFilters[sliceId][item.col];
      }
    })
    // handle publish special filterKeys column seperately
    filterKeys.forEach(element => {
      if (globalFilters[sliceId].hasOwnProperty(element)) {
        filters[sliceId][element] = globalFilters[sliceId][element];
      }
    });

  })
  return filters;
}

const getLinkedSlicesExistInFilters = (subscriberMap, globalFilters) => {
  let linkedSlicesExistInFilters = [];
  if (subscriberMap && subscriberMap.actions.indexOf("APPLY_FILTER") > -1) {
    const propExist = subscriberMap.hasOwnProperty("linked_slices");
    if (propExist) {
      const linked_slices = subscriberMap.linked_slices;
      for (var sliceId in linked_slices) {
        if (globalFilters.hasOwnProperty(sliceId)) {
          let slice = {};
          slice[sliceId] = linked_slices[sliceId];
          linkedSlicesExistInFilters.push(slice);
        }
      }
    }
  }
  return linkedSlicesExistInFilters;
}

const getSubscriberSliceMap = (publishSubscriberMap, sliceId) => {
  return publishSubscriberMap && publishSubscriberMap.hasOwnProperty("subscribers") && publishSubscriberMap.subscribers && publishSubscriberMap.subscribers[sliceId] ? publishSubscriberMap.subscribers[sliceId] : undefined;
}

export default function getFormDataWithExtraFilters({
  chart = {},
  dashboardMetadata,
  filters,
  sliceId,
  publishSubscriberMap = undefined,
}) {

  const subscriberSliceMap = getSubscriberSliceMap(publishSubscriberMap, sliceId);

  // update filter based on subscriber map
  const linkedSlicesExistInFilters = getLinkedSlicesExistInFilters(subscriberSliceMap, filters)
  filters = getExtraFilters(subscriberSliceMap, filters, linkedSlicesExistInFilters);

  // if dashboard metadata + filters have not changed, use cache if possible
  if (
    (cachedDashboardMetadataByChart[sliceId] || {}) === dashboardMetadata &&
    (cachedFiltersByChart[sliceId] || {}) === filters &&
    !!cachedFormdataByChart[sliceId]
  ) {
    return cachedFormdataByChart[sliceId];
  }

  const formData = {
    ...chart.formData,
    extra_filters: getEffectiveExtraFilters({
      dashboardMetadata,
      filters,
      sliceId,
      linkedSlicesExistInFilters,
    }),
  };

  cachedDashboardMetadataByChart[sliceId] = dashboardMetadata;
  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = formData;

  return formData;
}
