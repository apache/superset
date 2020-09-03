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
import { ChartProps, DataRecord } from '@superset-ui/core';
import { EchartsPieProps } from './types';

export default function transformProps(chartProps: ChartProps): EchartsPieProps {
  /*
  TODO:
  - add support for multiple groupby (requires post transform op)
  - add support for ad-hoc metrics (currently only supports datasource metrics)
  - add support for superset colors
  - add support for control values in legacy pie chart
   */
  const { width, height, formData, queryData } = chartProps;
  const data: DataRecord[] = queryData.data || [];

  const { innerRadius = 50, outerRadius = 70, groupby = [], metrics = [] } = formData;

  const keys = Array.from(new Set(data.map(datum => datum[groupby[0]])));

  const transformedData = data.map(datum => {
    return {
      value: datum[metrics[0]],
      name: datum[groupby[0]],
    };
  });

  const echartOptions = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 10,
      data: keys,
    },
    series: [
      {
        type: 'pie',
        radius: [`${innerRadius}%`, `${outerRadius}%`],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '30',
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: transformedData,
      },
    ],
  };

  return {
    width,
    height,
    // @ts-ignore
    echartOptions,
  };
}
