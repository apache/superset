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
import { scaleLinear } from '@visx/scale';
import { ACCESSIBLE_COLOR_BOUNDS } from '../../constants';

/**
 * Generates a color based on a numeric value and color bounds
 * @param value - The numeric value to generate color for
 * @param bounds - Optional array containing min and max bounds
 * @param colorBounds - Array of colors to use for the bounds
 * @returns A color string or null if no bounds are provided
 */
export function colorFromBounds(
  value: number | null,
  bounds?: [number | null, number | null] | null[],
  colorBounds: string[] = ACCESSIBLE_COLOR_BOUNDS,
): string | null {
  if (bounds && bounds.length > 0) {
    const [min, max] = bounds;
    const [minColor, maxColor] = colorBounds;

    if (
      min !== null &&
      max !== null &&
      min !== undefined &&
      max !== undefined
    ) {
      const colorScale = scaleLinear<string>()
        .domain([min, (max + min) / 2, max])
        .range([minColor, 'grey', maxColor]);

      return colorScale(value || 0) || null;
    }

    if (min !== null && min !== undefined)
      return value !== null && value >= min ? maxColor : minColor;

    if (max !== null && max !== undefined)
      return value !== null && value < max ? maxColor : minColor;
  }

  return null;
}
