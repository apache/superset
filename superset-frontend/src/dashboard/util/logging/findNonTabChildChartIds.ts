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
import { TABS_TYPE, CHART_TYPE } from '../componentTypes';

// This function traverses the layout from the passed id, returning an array
// of any child chartIds NOT nested within a Tabs component. These helps us identify
// if the charts at a given "Tabs" level are loaded
function findNonTabChildChartIds({ id, layout }: $TSFixMe) {
  const chartIds: $TSFixMe = [];
  function recurseFromNode(node: $TSFixMe) {
    if (node && node.type === CHART_TYPE) {
      if (node.meta && node.meta.chartId) {
        chartIds.push(node.meta.chartId);
      }
    } else if (
      node &&
      node.type !== TABS_TYPE &&
      node.children &&
      node.children.length
    ) {
      node.children.forEach((childId: $TSFixMe) => {
        const child = layout[childId];
        if (child) {
          recurseFromNode(child);
        }
      });
    }
  }

  recurseFromNode(layout[id]);

  return chartIds;
}

// This method is called frequently, so cache results
let cachedLayout: $TSFixMe;
let cachedIdsLookup = {};
export default function findNonTabChildChartIdsWithCache({
  id,
  layout,
}: $TSFixMe) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (cachedLayout === layout && cachedIdsLookup[id]) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return cachedIdsLookup[id];
  }
  if (layout !== cachedLayout) {
    cachedLayout = layout;
    cachedIdsLookup = {};
  }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  cachedIdsLookup[id] = findNonTabChildChartIds({ layout, id });
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return cachedIdsLookup[id];
}
