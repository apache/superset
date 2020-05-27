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

interface FilterScopeMap {
  [key: string]: number[];
}

interface GetRevertFilterScopeProps {
  checked: string[];
  filterFields: string[];
  filterScopeMap: FilterScopeMap;
}

export default function getRevertedFilterScope({
  checked = [],
  filterFields = [],
  filterScopeMap = {},
}: GetRevertFilterScopeProps) {
  const checkedChartIdsByFilterField = checked.reduce<FilterScopeMap>(
    (map, value) => {
      const [chartId, filterField] = value.split(':');
      return {
        ...map,
        [filterField]: (map[filterField] || []).concat(parseInt(chartId, 10)),
      };
    },
    {},
  );

  return filterFields.reduce<FilterScopeMap>((map, filterField) => {
    const { chartId } = getChartIdAndColumnFromFilterKey(filterField);
    // force display filter_box chart as unchecked, but show checkbox as disabled
    const updatedCheckedIds = (
      checkedChartIdsByFilterField[filterField] || []
    ).filter(id => id !== chartId);

    return {
      ...map,
      [filterField]: {
        ...filterScopeMap[filterField],
        checked: updatedCheckedIds,
      },
    };
  }, {});
}
