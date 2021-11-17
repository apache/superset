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

interface Value {
  [key: string]: unknown;
}

type Key = keyof Value;

interface DataRow {
  key: string[];
  values: Value[];
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    maxBubbleSize,
    showLegend,
    xAxisFormat,
    xAxisLabel,
    // TODO: These fields are not supported yet
    // xAxisShowminmax,
    // xLogScale,
    yAxisLabel,
    yAxisFormat,
    // TODO: These fields are not supported yet
    // yAxisShowminmax,
    // yLogScale,
  } = formData;
  const x = formData.x as Key;
  const y = formData.y as Key;
  const series = formData.series as Key;
  const size = formData.size as Key;
  const entity = formData.entity as Key;
  const data = queriesData[0].data as DataRow[];

  return {
    data: flatMap(
      data.map((row: DataRow) =>
        row.values.map(v => ({
          [x]: v[x],
          [y]: v[y],
          [series]: v[series],
          [size]: v[size],
          [entity]: v[entity],
        })),
      ),
    ),
    width,
    height,
    encoding: {
      x: {
        field: x,
        type: 'quantitive',
        format: xAxisFormat,
        scale: {
          type: 'linear',
        },
        axis: {
          orient: 'bottom',
          title: xAxisLabel,
        },
      },
      y: {
        field: y,
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
      size: {
        field: size,
        type: 'quantitative',
        scale: {
          type: 'linear',
          range: [0, maxBubbleSize],
        },
      },
      fill: {
        field: series,
        type: 'nominal',
        scale: {
          scheme: colorScheme,
        },
        legend: showLegend,
      },
      group: [{ field: entity }],
    },
  };
}
