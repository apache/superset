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
import { QueryObjectFilterClause } from '@superset-ui/core';
import { GaugeChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { Event, clickEventHandler } from '../utils/eventHandlers';

export default function EchartsGauge({
  height,
  width,
  echartOptions,
  setDataMask,
  labelMap,
  groupby,
  selectedValues,
  formData: { emitFilter },
  onContextMenu,
}: GaugeChartTransformedProps) {
  const handleChange = useCallback(
    (values: string[]) => {
      if (!emitFilter) {
        return;
      }

      const groupbyValues = values.map(value => labelMap[value]);

      setDataMask({
        extraFormData: {
          filters:
            values.length === 0
              ? []
              : groupby.map((col, idx) => {
                  const val = groupbyValues.map(v => v[idx]);
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value: groupbyValues.length ? groupbyValues : null,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [groupby, labelMap, setDataMask, selectedValues],
  );

  const eventHandlers = {
    click: clickEventHandler(selectedValues, handleChange),
    contextmenu: (e: Event) => {
      if (onContextMenu) {
        e.event.stop();
        const pointerEvent = e.event.event;
        const filters: QueryObjectFilterClause[] = [];
        if (groupby.length > 0) {
          const values = e.name.split(',');
          groupby.forEach((dimension, i) =>
            filters.push({
              col: dimension,
              op: '==',
              val: values[i].split(': ')[1],
              formattedVal: values[i].split(': ')[1],
            }),
          );
        }
        onContextMenu(filters, pointerEvent.offsetX, pointerEvent.offsetY);
      }
    },
  };

  return (
    <Echart
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
    />
  );
}
