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
  ChartProps,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
} from '@superset-ui/core';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const { formData, queriesData, height } = chartProps;
  const {
    groupby,
    liftvaluePrecision,
    metrics,
    pvaluePrecision,
    significanceLevel,
  } = formData;

  const metricLabels = ensureIsArray(metrics).map(getMetricLabel);
  const rawData = queriesData[0].data;
  // The legacy explore_json endpoint pivoted the timeseries server-side;
  // v1 responses arrive as flat records and are reshaped here.
  const data = Array.isArray(rawData)
    ? transformData(
        rawData,
        ensureIsArray(groupby).map(getColumnLabel),
        metricLabels,
      )
    : rawData;

  return {
    alpha: significanceLevel,
    data,
    groups: groupby,
    height,
    liftValPrec: parseInt(liftvaluePrecision, 10),
    metrics: metricLabels,
    pValPrec: parseInt(pvaluePrecision, 10),
  };
}
