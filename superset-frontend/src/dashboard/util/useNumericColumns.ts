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

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState, Slice, WhatIfColumn } from 'src/dashboard/types';
import { getNumericColumnsForDashboard } from './whatIf';

/**
 * Hook to get numeric columns available for what-if analysis on the dashboard.
 * This hook memoizes the computation and provides a stable reference to avoid
 * unnecessary re-renders in consuming components.
 *
 * Returns:
 * - numericColumns: Array of WhatIfColumn objects with column metadata
 * - columnToChartIds: Map from column name to array of chart IDs that use it
 */
export function useNumericColumns(): {
  numericColumns: WhatIfColumn[];
  columnToChartIds: Map<string, number[]>;
} {
  const slices = useSelector(
    (state: RootState) => state.sliceEntities.slices as { [id: number]: Slice },
  );
  const datasources = useSelector((state: RootState) => state.datasources);

  const numericColumns = useMemo(
    () => getNumericColumnsForDashboard(slices, datasources),
    [slices, datasources],
  );

  const columnToChartIds = useMemo(() => {
    const map = new Map<string, number[]>();
    numericColumns.forEach(col => {
      map.set(col.columnName, col.usedByChartIds);
    });
    return map;
  }, [numericColumns]);

  return { numericColumns, columnToChartIds };
}

export default useNumericColumns;
