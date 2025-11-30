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

// import { NumericCellRenderer } from '../renderers/NumericCellRenderer';
import { SparklineRenderer } from '../renderers/SparklineRenderer';
import { BarChartRenderer } from '../renderers/BarChartRenderer';
import type { InputColumn } from '../types';
import { GenericDataType } from '@apache-superset/core/api/core';
import { type RGBColor } from '@superset-ui/core/components';

/**
 * Registry of available chart renderers
 * Maps chartType strings to their corresponding renderer components
 */
const CHART_RENDERERS = {
  'sparkline': SparklineRenderer,
  'minibar': BarChartRenderer,           // Map minibar to BarChartRenderer
  // 'horizontal-bar': NumericCellRenderer, // Use existing horizontal bars
  // 'default': NumericCellRenderer,        // Fallback to existing renderer
};

/**
 * Factory function to get the appropriate chart renderer based on chart type
 * @param chartType - The type of chart renderer to retrieve
 * @returns The chart renderer component function
 */
export const getChartRenderer = (chartType: string) => {
  return CHART_RENDERERS[chartType as keyof typeof CHART_RENDERERS] || CHART_RENDERERS.sparkline;
};

/**
 * Determines if a column should use a chart renderer instead of the default text/numeric renderer
 * @param col - The column definition containing configuration
 * @param data - The table data (for future validation if needed)
 * @returns true if the column should use a chart renderer
 */
export const shouldUseChartRenderer = (col: InputColumn): boolean => {
  return (col.dataType === GenericDataType.Chart);
};

export const rgbToHex = (rgb: RGBColor): string => {
  const { r, g, b, a = 1 } = rgb;
  const toHex = (value: number) => {
    const hex = Math.round(value).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  if (a !== undefined && a !== 1) {
    return `${hexColor}${toHex(Math.round(a * 255))}`;
  }

  return hexColor;
}