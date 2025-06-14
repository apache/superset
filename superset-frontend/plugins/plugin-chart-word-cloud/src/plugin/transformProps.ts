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

import { ChartProps, getColumnLabel } from '@superset-ui/core';
import { WordCloudProps, WordCloudEncoding } from '../chart/WordCloud';
import { WordCloudFormData } from '../types';

function getMetricLabel(
  metric: WordCloudFormData['metric'],
): string | undefined {
  if (typeof metric === 'string' || typeof metric === 'undefined') {
    return metric;
  }
  if (Array.isArray(metric)) {
    return metric.length > 0 ? getMetricLabel(metric[0]) : undefined;
  }

  return metric.label;
}

export default function transformProps(chartProps: ChartProps): WordCloudProps {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    metric,
    rotation,
    series,
    sizeFrom = 0,
    sizeTo,
    sliceId,
  } = formData as WordCloudFormData;

  const metricLabel = getMetricLabel(metric);
  const seriesLabel = getColumnLabel(series);

  const encoding: Partial<WordCloudEncoding> = {
    color: {
      field: seriesLabel,
      scale: {
        scheme: colorScheme,
      },
      type: 'nominal',
    },
    fontSize:
      typeof metricLabel === 'undefined'
        ? undefined
        : {
            field: metricLabel,
            scale: {
              range: [sizeFrom, sizeTo],
              zero: true,
            },
            type: 'quantitative',
          },
    text: {
      field: seriesLabel,
    },
  };

  return {
    data: queriesData[0].data,
    encoding,
    height,
    rotation,
    width,
    sliceId,
    colorScheme,
  };
}
