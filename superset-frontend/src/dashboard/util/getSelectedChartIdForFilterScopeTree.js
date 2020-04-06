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

export default function getSelectedChartIdForFilterScopeTree({
  activeFilterField,
  checkedFilterFields,
}) {
  // we don't apply filter on filter_box itself, so we will disable
  // checkbox in filter scope selector.
  // this function returns chart id based on current filter scope selector local state:
  // 1. if in single-edit mode, return the chart id for selected filter field.
  // 2. if in multi-edit mode, if all filter fields are from same chart id,
  // return the single chart id.
  // otherwise, there is no chart to disable.
  if (activeFilterField) {
    return getChartIdAndColumnFromFilterKey(activeFilterField).chartId;
  }

  if (checkedFilterFields.length) {
    const { chartId } = getChartIdAndColumnFromFilterKey(
      checkedFilterFields[0],
    );

    if (
      checkedFilterFields.some(
        filterKey =>
          getChartIdAndColumnFromFilterKey(filterKey).chartId !== chartId,
      )
    ) {
      return null;
    }
    return chartId;
  }

  return null;
}
