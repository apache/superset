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
import { getTextDimension } from '@superset-ui/core';
import { LinearScaleConfig } from '@visx/scale';
import { AxisScaleOutput } from '@visx/axis';

const TEXT_STYLE = {
  fontSize: '12px',
  fontWeight: 200,
  letterSpacing: 0.4,
} as const;

/**
 * Calculates the width needed for text in the sparkline
 */
export function getSparklineTextWidth(text: string): number {
  return getTextDimension({ text, style: TEXT_STYLE }).width + 5;
}

/**
 * Validates if a value can be used as a bound
 */
export function isValidBoundValue(value?: number | string): value is number {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    typeof value === 'number' &&
    !Number.isNaN(value)
  );
}

/**
 * Calculates min and max values from valid data points
 */
export function getDataBounds(validData: number[]): [number, number] {
  if (validData.length === 0) {
    return [0, 0];
  }

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  return [min, max];
}

/**
 * Creates Y scale configuration based on data and bounds
 */
export function createYScaleConfig(
  validData: number[],
  yAxisBounds?: [number | undefined, number | undefined],
): {
  yScaleConfig: LinearScaleConfig<AxisScaleOutput>;
  min: number;
  max: number;
} {
  const [dataMin, dataMax] = getDataBounds(validData);
  const [minBound, maxBound] = yAxisBounds || [undefined, undefined];

  const hasMinBound = isValidBoundValue(minBound);
  const hasMaxBound = isValidBoundValue(maxBound);

  const finalMin = hasMinBound ? minBound! : dataMin;
  const finalMax = hasMaxBound ? maxBound! : dataMax;

  const config: LinearScaleConfig<AxisScaleOutput> = {
    type: 'linear',
    zero: hasMinBound && minBound! <= 0,
    domain: [finalMin, finalMax],
  };

  return {
    yScaleConfig: config,
    min: finalMin,
    max: finalMax,
  };
}

/**
 * Transforms raw data into chart data points
 */
export function transformChartData(
  data: Array<number | null>,
): Array<{ x: number; y: number }> {
  return data.map((num, idx) => ({ x: idx, y: num ?? 0 }));
}
