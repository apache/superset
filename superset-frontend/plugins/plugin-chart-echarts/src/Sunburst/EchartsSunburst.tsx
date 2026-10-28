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
import { useCallback } from 'react';
import {
  BinaryQueryObjectFilterClause,
  getColumnLabel,
  DataRecordValue,
} from '@superset-ui/core';
import { SunburstTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers, TreePathInfo } from '../types';
import {
  getSunburstDetailFilter,
  getSunburstDrillByFilter,
  getSunburstFilter,
  getSunburstSelectionKey,
} from './utils';

export const extractTreePathInfo = (treePathInfo: TreePathInfo[] | undefined) =>
  (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

export default function EchartsSunburst(props: SunburstTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    selectedValues,
    formData,
    onContextMenu,
    refs,
    emitCrossFilters,
    coltypeMapping,
  } = props;
  const { columns = [] } = formData;

  const getCrossFilterDataMask = useCallback(
    (treePathInfo: TreePathInfo[], records: DataRecordValue[]) => {
      const treePath = extractTreePathInfo(treePathInfo);
      const joinedTreePath = getSunburstSelectionKey(
        records,
        treePath,
        columns,
        coltypeMapping,
      );
      const index = records.length - 1;
      const value = treePath[treePath.length - 1];

      const isCurrentValueSelected =
        Object.values(selectedValues).includes(joinedTreePath) ||
        Object.values(selectedValues).includes(treePath.join(','));

      if (!columns?.length || !records.length || isCurrentValueSelected) {
        return {
          dataMask: {
            extraFormData: {
              filters: [],
            },
            filterState: {
              value: null,
              selectedValues: [],
            },
          },
          isCurrentValueSelected,
        };
      }

      const filter = getSunburstFilter(
        columns[index],
        records[index],
        formData,
        coltypeMapping?.[getColumnLabel(columns[index])],
      );

      return {
        dataMask: {
          extraFormData: {
            filters: [filter],
            // Target queries rewrite temporal filter bounds from time_range.
            ...(filter.op === 'TEMPORAL_RANGE' && {
              time_range: String(filter.val),
            }),
          },
          filterState: {
            value,
            selectedValues: [joinedTreePath],
          },
        },
        isCurrentValueSelected,
      };
    },
    [columns, selectedValues, coltypeMapping, formData],
  );

  const handleChange = useCallback(
    (treePathInfo: TreePathInfo[], records: DataRecordValue[]) => {
      if (!emitCrossFilters || !columns?.length) {
        return;
      }

      setDataMask(getCrossFilterDataMask(treePathInfo, records).dataMask);
    },
    [emitCrossFilters, columns?.length, setDataMask, getCrossFilterDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { treePathInfo, data } = props;
      handleChange(treePathInfo, data.records);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, treePathInfo } = eventParams;
        const { records } = data;
        const treePath = extractTreePathInfo(eventParams.treePathInfo);
        const pointerEvent = eventParams.event.event;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        if (columns?.length) {
          records.forEach((record: DataRecordValue, i: number) => {
            const coltype = coltypeMapping?.[getColumnLabel(columns[i])];
            drillToDetailFilters.push(
              getSunburstDetailFilter(
                columns[i],
                record,
                formData,
                coltype,
                treePath[i],
              ),
            );
            if (i === records.length - 1) {
              drillByFilters.push(
                getSunburstDrillByFilter(
                  columns[i],
                  record,
                  formData,
                  coltype,
                  treePath[i],
                ),
              );
            }
          });
        }
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: columns?.length
            ? getCrossFilterDataMask(treePathInfo, records)
            : undefined,
          drillBy: { filters: drillByFilters, groupbyFieldName: 'columns' },
        });
      }
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
      vizType={formData.vizType}
    />
  );
}
