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
import {
  AxisType,
  DataRecordValue,
  DTTM_ALIAS,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import { EchartsMixedTimeseriesChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { currentSeries } from '../utils/series';

export default function EchartsMixedTimeseries({
  height,
  width,
  echartOptions,
  setDataMask,
  labelMap,
  labelMapB,
  groupby,
  groupbyB,
  selectedValues,
  formData,
  emitCrossFilters,
  seriesBreakdown,
  onContextMenu,
  xValueFormatter,
  xAxis,
  refs,
}: EchartsMixedTimeseriesChartTransformedProps) {
  const isFirstQuery = useCallback(
    (seriesIndex: number) => seriesIndex < seriesBreakdown,
    [seriesBreakdown],
  );

  const handleChange = useCallback(
    (values: string[], seriesIndex: number) => {
      if (!emitCrossFilters) {
        return;
      }

      const currentGroupBy = isFirstQuery(seriesIndex) ? groupby : groupbyB;
      const currentLabelMap = isFirstQuery(seriesIndex) ? labelMap : labelMapB;
      const groupbyValues = values
        .map(value => currentLabelMap?.[value])
        .filter(value => !!value);

      setDataMask({
        extraFormData: {
          // @ts-ignore
          filters:
            values.length === 0
              ? []
              : [
                  ...currentGroupBy.map((col, idx) => {
                    const val: DataRecordValue[] = groupbyValues.map(
                      v => v[idx],
                    );
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
                ],
        },
        filterState: {
          value: !groupbyValues.length ? null : groupbyValues,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [groupby, groupbyB, labelMap, labelMapB, setDataMask, selectedValues],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { seriesName, seriesIndex } = props;
      const values: string[] = Object.values(selectedValues || {});
      if (values.includes(seriesName)) {
        handleChange(
          values.filter(v => v !== seriesName),
          seriesIndex,
        );
      } else {
        handleChange([seriesName], seriesIndex);
      }
    },
    mouseout: () => {
      currentSeries.name = '';
    },
    mouseover: params => {
      currentSeries.name = params.seriesName;
    },
    contextmenu: eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesIndex } = eventParams;
        if (data) {
          const pointerEvent = eventParams.event.event;
          const values = [
            ...(eventParams.name ? [eventParams.name] : []),
            ...(isFirstQuery(seriesIndex) ? labelMap : labelMapB)[
              eventParams.seriesName
            ],
          ];
          const filters: BinaryQueryObjectFilterClause[] = [];
          if (xAxis.type === AxisType.time) {
            filters.push({
              col:
                xAxis.label === DTTM_ALIAS
                  ? formData.granularitySqla
                  : xAxis.label,
              grain: formData.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: xValueFormatter(data[0]),
            });
          }
          [
            ...(xAxis.type === AxisType.category ? [xAxis.label] : []),
            ...(isFirstQuery(seriesIndex)
              ? formData.groupby
              : formData.groupbyB),
          ].forEach((dimension, i) =>
            filters.push({
              col: dimension,
              op: '==',
              val: values[i],
              formattedVal: String(values[i]),
            }),
          );
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, filters);
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
