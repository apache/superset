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
import { useMemo, useEffect, useRef } from 'react';
import {
  DataRecord,
  DataRecordValue,
  BinaryQueryObjectFilterClause,
  extractTextFromHTML,
} from '@superset-ui/core';
import { DataColumnMeta, TableChartTransformedProps } from '../../../types';
import { formatColumnValue } from '../../../utils/formatValue';

export interface UseContextMenuProps<D extends DataRecord> {
  onContextMenu?: TableChartTransformedProps<D>['onContextMenu'];
  isRawRecords: boolean;
  filteredColumnsMeta: DataColumnMeta[];
  getCrossFilterDataMask: (key: string, value: DataRecordValue) => any;
}

export type ContextMenuHandler<D extends DataRecord> =
  | ((
      value: D,
      cellPoint: {
        key: string;
        value: DataRecordValue;
        isMetric?: boolean;
      },
      clientX: number,
      clientY: number,
    ) => void)
  | undefined;

/**
 * Manages context menu functionality for table cells including drill-to-detail,
 * cross-filter, and drill-by functionality. Uses ref pattern to avoid recreating
 * the handler when filteredColumnsMeta changes.
 */
export function useContextMenu<D extends DataRecord = DataRecord>({
  onContextMenu,
  isRawRecords,
  filteredColumnsMeta,
  getCrossFilterDataMask,
}: UseContextMenuProps<D>): ContextMenuHandler<D> {
  const filteredColumnsMetaRef = useRef(filteredColumnsMeta);

  useEffect(() => {
    filteredColumnsMetaRef.current = filteredColumnsMeta;
  }, [filteredColumnsMeta]);

  const handleContextMenu = useMemo(
    () =>
      onContextMenu && !isRawRecords
        ? (
            value: D,
            cellPoint: {
              key: string;
              value: DataRecordValue;
              isMetric?: boolean;
            },
            clientX: number,
            clientY: number,
          ) => {
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            filteredColumnsMetaRef.current.forEach(col => {
              if (!col.isMetric) {
                let dataRecordValue = value[col.key];
                dataRecordValue = extractTextFromHTML(dataRecordValue);

                drillToDetailFilters.push({
                  col: col.key,
                  op: '==',
                  val: dataRecordValue as string | number | boolean,
                  formattedVal: formatColumnValue(col, dataRecordValue)[1],
                });
              }
            });
            onContextMenu(clientX, clientY, {
              drillToDetail: drillToDetailFilters,
              crossFilter: cellPoint.isMetric
                ? undefined
                : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
              drillBy: cellPoint.isMetric
                ? undefined
                : {
                    filters: [
                      {
                        col: cellPoint.key,
                        op: '==',
                        val: extractTextFromHTML(cellPoint.value),
                      },
                    ],
                    groupbyFieldName: 'groupby',
                  },
            });
          }
        : undefined,
    [onContextMenu, isRawRecords, getCrossFilterDataMask],
  );

  return handleContextMenu;
}
