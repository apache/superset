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
import { DataMask, DrillDown } from '@superset-ui/core';
import { PieChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';

export default function EchartsPie({
  formData,
  height,
  width,
  echartOptions,
  setDataMask,
  labelMap,
  groupby,
  selectedValues,
  ownState,
}: PieChartTransformedProps) {
  const handleChange = useCallback(
    (values: string[]) => {
      if (!formData.emitFilter && !formData.drillDown) {
        return;
      }

      const groupbyValues = values.map(value => labelMap[value]);

      let dataMask: DataMask = {};
      if (formData.emitFilter) {
        dataMask = {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : groupby.map((col, idx) => {
                    const val = groupbyValues.map(v => v[idx]);
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
        };
      }

      if (formData.drillDown && ownState?.drilldown) {
        const drilldown = DrillDown.drillDown(ownState?.drilldown, values[0]);
        dataMask = {
          extraFormData: {
            filters: drilldown.filters,
          },
          filterState: {
            value:
              groupbyValues.length && drilldown.filters.length > 0
                ? groupbyValues
                : null,
          },
          ownState: {
            drilldown,
          },
        };
      }

      setDataMask(dataMask);
    },
    [groupby, labelMap, setDataMask, selectedValues],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { name } = props;
      const values = Object.values(selectedValues);
      if (values.includes(name)) {
        handleChange(values.filter(v => v !== name));
      } else {
        handleChange([name]);
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
