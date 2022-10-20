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
import React, { useCallback } from 'react';

import { hasGenericChartAxes } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl/DateFilterLabel';

interface DatePickerInFilterProps {
  columnName: string;
  timeRange: string;
  columns: ColumnMeta[];
  onChange: (columnName: string, timeRange: string) => void;
}

// todo(Yongjie): refactor `isColumnMeta` in the '@superset-ui/chart-controls', then remove this one.
const isColumnMeta = (column: any): column is ColumnMeta =>
  !!column && 'column_name' in column;

export const useDatePickerInAdhocFilter = ({
  columnName,
  timeRange,
  columns,
  onChange,
}: DatePickerInFilterProps): React.ReactElement | undefined => {
  const isDateColumn = useCallback(
    (colName: string, columns: ColumnMeta[]): boolean =>
      !!columns.find(
        column => isColumnMeta(column) && column.column_name === colName,
      )?.is_dttm,
    [columnName],
  );

  const onTimeRangeChange = (val: string) => onChange(columnName, val);

  return hasGenericChartAxes && isDateColumn(columnName, columns) ? (
    <DateFilterControl
      value={timeRange}
      name="time_range"
      onChange={onTimeRangeChange}
      overlayStyle="Modal"
    />
  ) : undefined;
};
