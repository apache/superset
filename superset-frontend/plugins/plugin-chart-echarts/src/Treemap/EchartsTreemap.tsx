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
  DataRecordValue,
  BinaryQueryObjectFilterClause,
  getTimeFormatter,
  getColumnLabel,
  getNumberFormatter,
} from '@superset-ui/core';
import React, { useCallback } from 'react';
import Echart from '../components/Echart';
import { NULL_STRING } from '../constants';
import { EventHandlers } from '../types';
import { extractTreePathInfo } from './constants';
import { TreemapTransformedProps } from './types';
import { formatSeriesName } from '../utils/series';

export default function EchartsTreemap({
  echartOptions,
  emitCrossFilters,
  groupby,
  height,
  labelMap,
  onContextMenu,
  refs,
  setDataMask,
  selectedValues,
  width,
  formData,
  coltypeMapping,
}: TreemapTransformedProps) {
  const getCrossFilterDataMask = useCallback(
    (data, treePathInfo) => {
      if (data?.children) {
        return undefined;
      }
      const { treePath } = extractTreePathInfo(treePathInfo);
      const name = treePath.join(',');
      const selected = Object.values(selectedValues);
      let values: string[];
      if (selected.includes(name)) {
        values = selected.filter(v => v !== name);
      } else {
        values = [name];
      }

      const groupbyValues = values.map(value => labelMap[value]);

      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val: DataRecordValue[] = groupbyValues.map(
                      v => v[idx],
                    );
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(name),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (data, treePathInfo) => {
      if (!emitCrossFilters) {
        return;
      }

      const dataMask = getCrossFilterDataMask(data, treePathInfo)?.dataMask;
      if (dataMask) {
        setDataMask(dataMask);
      }
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { data, treePathInfo } = props;
      handleChange(data, treePathInfo);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, treePathInfo } = eventParams;
        const { treePath } = extractTreePathInfo(treePathInfo);
        if (treePath.length > 0) {
          const pointerEvent = eventParams.event.event;
          const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
          const drillByFilters: BinaryQueryObjectFilterClause[] = [];
          treePath.forEach((path, i) => {
            const val = path === 'null' ? NULL_STRING : path;
            drillToDetailFilters.push({
              col: groupby[i],
              op: '==',
              val,
              formattedVal: path,
            });
            drillByFilters.push({
              col: groupby[i],
              op: '==',
              val,
              formattedVal: formatSeriesName(val, {
                timeFormatter: getTimeFormatter(formData.dateFormat),
                numberFormatter: getNumberFormatter(formData.numberFormat),
                coltype: coltypeMapping?.[getColumnLabel(groupby[i])],
              }),
            });
          });
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter: getCrossFilterDataMask(data, treePathInfo),
            drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
          });
        }
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
    />
  );
}
