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

import { CHART_TYPE } from '../util/componentTypes';

export default function getCurrentScopeChartIds({
  scopeComponentIds,
  filterField,
  filterImmuneSlices,
  filterImmuneSliceFields,
  components,
}) {
  function traverse(component) {
    if (!component) {
      return;
    }

    if (
      component.type === CHART_TYPE &&
      component.meta &&
      component.meta.chartId
    ) {
      chartIds.push(component.meta.chartId);
    } else if (component.children) {
      component.children.forEach(child => traverse(components[child]));
    }
  }

  let chartIds = [];
  scopeComponentIds.forEach(componentId => (traverse(components[componentId])));

  if (filterImmuneSlices && filterImmuneSlices.length) {
    chartIds = chartIds.filter(id => !filterImmuneSlices.includes(id));
  }

  if (filterImmuneSliceFields) {
    chartIds = chartIds.filter(id =>
      !(id.toString() in filterImmuneSliceFields) ||
      !filterImmuneSliceFields[id].includes(filterField)
    );
  }

  return chartIds;
}
