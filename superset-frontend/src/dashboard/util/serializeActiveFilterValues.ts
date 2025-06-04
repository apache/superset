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
import { getChartIdAndColumnFromFilterKey } from './getDashboardFilterKey';

// input: { [id_column1]: values, [id_column2]: values }
// output: { id: { column1: values, column2: values } }
export default function serializeActiveFilterValues(activeFilters: $TSFixMe) {
  return Object.entries(activeFilters).reduce((map, entry) => {
    // @ts-expect-error TS(2339): Property 'values' does not exist on type 'unknown'... Remove this comment to see the full error message
    const [filterKey, { values }] = entry;
    const { chartId, column } = getChartIdAndColumnFromFilterKey(filterKey);
    const entryByChartId = {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      ...map[chartId],
      [column]: values,
    };
    return {
      ...map,
      [chartId]: entryByChartId,
    };
  }, {});
}
