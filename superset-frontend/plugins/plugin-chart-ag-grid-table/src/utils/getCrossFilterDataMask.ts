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

import {
  DataRecordFilters,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  TimeGranularity,
} from '@superset-ui/core';

type GetCrossFilterDataMaskProps = {
  key: string;
  value: DataRecordValue;
  filters?: DataRecordFilters;
  timeGrain?: TimeGranularity;
  isActiveFilterValue: (key: string, val: DataRecordValue) => boolean;
  timestampFormatter: (value: DataRecordValue) => string;
};

export const getCrossFilterDataMask = ({
  key,
  value,
  filters,
  timeGrain,
  isActiveFilterValue,
  timestampFormatter,
}: GetCrossFilterDataMaskProps) => {
  let updatedFilters = { ...(filters || {}) };
  if (filters && isActiveFilterValue(key, value)) {
    updatedFilters = {};
  } else {
    updatedFilters = {
      [key]: [value],
    };
  }
  if (Array.isArray(updatedFilters[key]) && updatedFilters[key].length === 0) {
    delete updatedFilters[key];
  }

  const groupBy = Object.keys(updatedFilters);
  const groupByValues = Object.values(updatedFilters);
  const labelElements: string[] = [];
  groupBy.forEach(col => {
    const isTimestamp = col === DTTM_ALIAS;
    const filterValues = ensureIsArray(updatedFilters?.[col]);
    if (filterValues.length) {
      const valueLabels = filterValues.map(value =>
        isTimestamp ? timestampFormatter(value) : value,
      );
      labelElements.push(`${valueLabels.join(', ')}`);
    }
  });

  return {
    dataMask: {
      extraFormData: {
        filters:
          groupBy.length === 0
            ? []
            : groupBy.map(col => {
                const val = ensureIsArray(updatedFilters?.[col]);
                if (!val.length)
                  return {
                    col,
                    op: 'IS NULL' as const,
                  };
                return {
                  col,
                  op: 'IN' as const,
                  val: val.map(el => (el instanceof Date ? el.getTime() : el!)),
                  grain: col === DTTM_ALIAS ? timeGrain : undefined,
                };
              }),
      },
      filterState: {
        label: labelElements.join(', '),
        value: groupByValues.length ? groupByValues : null,
        filters:
          updatedFilters && Object.keys(updatedFilters).length
            ? updatedFilters
            : null,
      },
    },
    isCurrentValueSelected: isActiveFilterValue(key, value),
  };
};
