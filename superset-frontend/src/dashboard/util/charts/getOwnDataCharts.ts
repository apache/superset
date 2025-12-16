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
import { JsonObject } from '@superset-ui/core';
import { areObjectsEqual } from '../../../reduxUtils';

export const arrayDiff = (a: string[], b: string[]) => [
  ...a.filter(x => !b.includes(x)),
  ...b.filter(x => !a.includes(x)),
];

// Fields in ownState that don't require re-querying the chart when changed
// clientView is used by TableChart to store filtered rows for export - it's a
// derived/cached value that doesn't affect the query
const IGNORED_OWN_STATE_FIELDS = ['clientView'];

const getComparableOwnState = (
  ownState: JsonObject | undefined,
): JsonObject => {
  if (!ownState) return {};
  const result: JsonObject = {};
  Object.keys(ownState).forEach(key => {
    if (!IGNORED_OWN_STATE_FIELDS.includes(key)) {
      result[key] = ownState[key];
    }
  });
  return result;
};

export const getAffectedOwnDataCharts = (
  ownDataCharts: JsonObject,
  appliedOwnDataCharts: JsonObject,
) => {
  const chartIds = Object.keys(ownDataCharts);
  const appliedChartIds = Object.keys(appliedOwnDataCharts);
  const affectedIds: string[] = arrayDiff(chartIds, appliedChartIds).filter(
    id => ownDataCharts[id] || appliedOwnDataCharts[id],
  );
  const checkForUpdateIds = new Set<string>([...chartIds, ...appliedChartIds]);
  checkForUpdateIds.forEach(chartId => {
    // Compare ownState excluding fields that don't require re-querying
    const currentState = getComparableOwnState(ownDataCharts[chartId]);
    const appliedState = getComparableOwnState(appliedOwnDataCharts[chartId]);
    if (!areObjectsEqual(currentState, appliedState)) {
      affectedIds.push(chartId);
    }
  });
  return [...new Set(affectedIds)];
};
