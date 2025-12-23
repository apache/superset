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
 * software distributed under this License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Shared transform helpers (used by all ECharts plugins)
 * Plugin-specific helpers are in their respective plugin folders
 */

export { getColorPalette, cleanSeriesColors, applyColorPalette } from './colorPalette';
export { applyAllDefaults } from './applyDefaults';

export {
  ECHARTS_SCHEMA,
  getMergeStrategy,
  shouldMergeIntoItems,
  getPropertyType,
  type EChartsPropertySchema,
  type EChartsPropertyType,
  type MergeStrategy,
} from './echartsSchema';
export { safeParseJson } from './utils';
export {
  type TransformConfig,
  DEFAULT_TRANSFORMS,
  resolveTransformConfig,
} from './transformRegistry';

