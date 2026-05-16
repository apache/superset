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

import type {
  ChartStateConverter,
  BackendOwnState,
  JsonObject,
} from '@superset-ui/core';

/**
 * Registry of chart-specific state converters.
 * Maps viz_type to a function that converts chart state to backend format.
 *
 * This allows chart plugins to define their own state conversion logic
 * without polluting the dashboard code with viz-type-specific logic.
 */
class ChartStateConverterRegistry {
  private converters = new Map<string, ChartStateConverter>();

  /**
   * Register a state converter for a specific viz type
   */
  register(vizType: string, converter: ChartStateConverter): void {
    this.converters.set(vizType, converter);
  }

  /**
   * Convert chart-specific state to backend-compatible ownState format.
   * Returns an empty object if no converter is registered for the viz type.
   */
  convert(vizType: string, chartState: JsonObject): Partial<BackendOwnState> {
    const converter = this.converters.get(vizType);
    if (!converter) {
      return {};
    }

    try {
      return converter(chartState);
    } catch (error) {
      // Log error but don't throw - graceful degradation
      console.warn(
        `Error converting chart state for viz type "${vizType}":`,
        error,
      );
      return {};
    }
  }

  /**
   * Check if a viz type has a registered state converter
   */
  has(vizType: string): boolean {
    return this.converters.has(vizType);
  }

  /**
   * Remove a registered converter (useful for testing)
   */
  unregister(vizType: string): void {
    this.converters.delete(vizType);
  }

  /**
   * Clear all registered converters (useful for testing)
   */
  clear(): void {
    this.converters.clear();
  }
}

// Singleton instance
const registry = new ChartStateConverterRegistry();

/**
 * Register a state converter for a specific viz type
 *
 * @example
 * ```typescript
 * import { convertAgGridStateToOwnState } from 'plugins/plugin-chart-ag-grid-table';
 * import { registerChartStateConverter } from 'src/dashboard/util/chartStateConverter';
 *
 * registerChartStateConverter('ag-grid-table', convertAgGridStateToOwnState);
 * ```
 */
export function registerChartStateConverter(
  vizType: string,
  converter: ChartStateConverter,
): void {
  registry.register(vizType, converter);
}

/**
 * Convert chart-specific state to backend-compatible ownState format
 *
 * @param vizType - The visualization type (e.g., 'ag-grid-table')
 * @param chartState - The chart-specific state object
 * @returns Backend-compatible ownState, or empty object if no converter is registered
 */
export function convertChartStateToOwnState(
  vizType: string,
  chartState: JsonObject,
): Partial<BackendOwnState> {
  return registry.convert(vizType, chartState);
}

/**
 * Check if a viz type has a registered state converter
 *
 * @param vizType - The visualization type to check
 * @returns true if a converter is registered for this viz type
 */
export function hasChartStateConverter(vizType: string): boolean {
  return registry.has(vizType);
}

/**
 * Check if a dashboard contains any charts with registered state converters
 * (i.e., charts that maintain stateful behavior like sorting, filtering, column order)
 *
 * @param sliceEntities - The slice entities object from Redux state
 * @returns true if at least one stateful chart exists in the dashboard
 *
 * @example
 * ```typescript
 * const hasStateful = hasStatefulCharts(state.sliceEntities.slices);
 * if (hasStateful && chartStates) {
 *   // Include chart states in permalink
 * }
 * ```
 */
export function hasStatefulCharts(
  sliceEntities: Record<string, any> | null | undefined,
): boolean {
  if (!sliceEntities) {
    return false;
  }

  return Object.values(sliceEntities).some(
    slice =>
      slice &&
      typeof slice === 'object' &&
      'viz_type' in slice &&
      hasChartStateConverter(slice.viz_type),
  );
}

// Export registry instance for testing purposes
// eslint-disable-next-line no-underscore-dangle
export const __chartStateConverterRegistryForTesting__ = registry;
