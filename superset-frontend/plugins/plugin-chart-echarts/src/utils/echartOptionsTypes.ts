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
 * Re-exports from @superset-ui/chart-controls
 *
 * This file exists for backwards compatibility.
 * All types and schemas are now defined in @superset-ui/chart-controls
 * using Zod for unified type inference and runtime validation.
 *
 * @deprecated Import from '@superset-ui/chart-controls' instead
 */

export {
  // Schemas (for runtime validation)
  customEChartOptionsSchema,
  textStyleSchema,
  lineStyleSchema,
  areaStyleSchema,
  itemStyleSchema,
  labelSchema,
  titleSchema,
  legendSchema,
  gridSchema,
  axisSchema,
  tooltipSchema,
  dataZoomSchema,
  toolboxSchema,
  visualMapSchema,
  seriesSchema,
  graphicElementSchema,
  axisPointerSchema,
  // Types (inferred from Zod schemas)
  type CustomEChartOptions,
  type TextStyleOption,
  type LineStyleOption,
  type AreaStyleOption,
  type ItemStyleOption,
  type LabelOption,
  type TitleOption,
  type LegendOption,
  type GridOption,
  type AxisOption,
  type TooltipOption,
  type DataZoomOption,
  type ToolboxOption,
  type VisualMapOption,
  type SeriesOption,
  type GraphicElementOption,
  type AxisPointerOption,
  // Validation functions
  validateEChartOptions,
  parseEChartOptionsStrict,
} from '@superset-ui/chart-controls';
