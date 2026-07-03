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
import { ChartProps, getMetricLabel } from '@superset-ui/core';
import nvd3TransformProps from '../transformProps';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const { formData, queriesData } = chartProps;
  const rawData = queriesData[0].data;
  // v1 responses arrive as flat records; the legacy explore_json endpoint
  // delivered the period-pivoted series directly.
  const data = Array.isArray(rawData)
    ? transformData(
        rawData as Record<string, unknown>[],
        getMetricLabel(formData.metric),
        formData.freq as string,
      )
    : rawData;
  return nvd3TransformProps({
    ...chartProps,
    queriesData: [{ ...queriesData[0], data }],
  } as ChartProps);
}
