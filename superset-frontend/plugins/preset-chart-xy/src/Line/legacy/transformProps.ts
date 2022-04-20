/*
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

import { ChartProps } from '@superset-ui/core';
import { flatMap } from 'lodash';

interface DataRow {
  key: string[];
  values: {
    x: number;
    y: number;
  }[];
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { colorScheme, xAxisLabel, xAxisFormat, yAxisLabel, yAxisFormat } =
    formData;
  const data = queriesData[0].data as DataRow[];

  return {
    data: flatMap(
      data.map((row: DataRow) =>
        row.values.map(v => ({
          ...v,
          name: row.key[0],
        })),
      ),
    ),
    width,
    height,
    encoding: {
      x: {
        field: 'x',
        type: 'temporal',
        format: xAxisFormat,
        scale: {
          type: 'time',
        },
        axis: {
          orient: 'bottom',
          title: xAxisLabel,
        },
      },
      y: {
        field: 'y',
        type: 'quantitative',
        format: yAxisFormat,
        scale: {
          type: 'linear',
        },
        axis: {
          orient: 'left',
          title: yAxisLabel,
        },
      },
      stroke: {
        field: 'name',
        type: 'nominal',
        scale: {
          scheme: colorScheme,
        },
        legend: true,
      },
    },
  };
}
