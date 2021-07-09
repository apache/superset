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
import { EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';

// @ts-ignore
export default function EchartsTimeseries({
  formData,
  height,
  width,
  echartOptions,
  groupby,
  labelMap,
  setDataMask,
}: TimeseriesChartTransformedProps) {
  const { filterState } = formData;
  const handleChange = useCallback(
    (values: string[]) => {
      if (!formData.emitFilter) {
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
          label: groupbyValues.length ? groupbyValues : undefined,
          value: groupbyValues.length ? groupbyValues : null,
        },
      });
    },
    [groupby, labelMap, setDataMask],
  );

  const selectedValues = (filterState || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = Object.keys(labelMap).indexOf(selectedValue);
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { seriesId } = props;
      const values: string[] = Object.values(selectedValues);
      if (values.includes(seriesId)) {
        handleChange(values.filter(v => v !== seriesId));
      } else {
        handleChange([...values, seriesId]);
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
