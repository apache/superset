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
  seriesBreakdown,
}: EchartsMixedTimeseriesChartTransformedProps) {
  const isFirstQuery = useCallback(
    (seriesIndex: number) => seriesIndex < seriesBreakdown,
    [seriesBreakdown],
  );

  const handleChange = useCallback(
    (values: string[], seriesIndex: number) => {
      const emitFilter = isFirstQuery(seriesIndex)
        ? formData.emitFilter
        : formData.emitFilterB;
      if (!emitFilter) {
        return;
      }

      const currentGroupBy = isFirstQuery(seriesIndex) ? groupby : groupbyB;
      const currentLabelMap = isFirstQuery(seriesIndex) ? labelMap : labelMapB;
      const groupbyValues = values
        .map(value => currentLabelMap[value])
        .filter(value => !!value);

      setDataMask({
        extraFormData: {
          // @ts-ignore
          filters:
            values.length === 0
              ? []
              : [
                  ...currentGroupBy.map((col, idx) => {
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
      const values: string[] = Object.values(selectedValues);
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
