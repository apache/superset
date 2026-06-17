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

/**
 * Glyph Core - A declarative visualization plugin framework
 *
 * This module enables single-file visualization plugins where:
 * 1. Arguments define both the chart's inputs AND the control panel
 * 2. transformProps is auto-generated from argument definitions
 * 3. The chart component is a simple function receiving typed arguments
 *
 * Features:
 * - Single-file chart definitions with defineChart()
 * - Declarative argument types (Metric, Dimension, Select, Checkbox, etc.)
 * - Conditional visibility with visibleWhen/disabledWhen
 * - Cross-filtering support with extractCrossFilterProps() and allEventHandlers()
 * - Reusable presets (ShowLegend, HeaderFontSize, etc.)
 *
 * Example usage:
 * ```typescript
 * export default defineChart({
 *   metadata: {
 *     name: 'My Chart',
 *     thumbnail,
 *     behaviors: [Behavior.InteractiveChart, Behavior.DrillToDetail, Behavior.DrillBy],
 *   },
 *   arguments: {
 *     metric: Metric.with({ label: 'Metric' }),
 *     groupby: Dimension.with({ label: 'Breakdowns' }),
 *     fontSize: Select.with({
 *       label: 'Font Size',
 *       options: [{ label: 'Small', value: 0.2 }, { label: 'Large', value: 0.4 }],
 *       default: 0.3,
 *     }),
 *   },
 *   transform: (chartProps, argValues) => {
 *     // Extract cross-filter props for interactive filtering
 *     const crossFilterProps = extractCrossFilterProps(chartProps, groupby, labelMap, seriesNames);
 *     return { transformedProps: { echartOptions, ...crossFilterProps } };
 *   },
 *   render: ({ transformedProps }) => {
 *     const eventHandlers = allEventHandlers(transformedProps);
 *     return <Echart eventHandlers={eventHandlers} ... />;
 *   },
 * });
 * ```
 */

// Re-export everything
export * from './types';
export * from './arguments';
export * from './defineChart';
export * from './presets';
export * from './crossFilter';
