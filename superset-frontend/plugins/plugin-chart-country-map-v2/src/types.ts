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
import { ChartProps, QueryFormData } from '@superset-ui/core';

/** Admin levels supported by the plugin. */
export type AdminLevel = 0 | 1;

/**
 * Identifier of one of the per-region-set dissolved outputs (e.g. `nuts_1`
 * for Türkiye, `regions` for France/Italy/Philippines), shipped from the
 * build pipeline's `regional_aggregations.yaml`.
 */
export type RegionSetId = string;

/**
 * Form data shape for the new country map. All fields are optional except
 * the standard `viz_type`/`datasource` etc. inherited from QueryFormData.
 */
export interface CountryMapFormData extends QueryFormData {
  /** NE worldview code (e.g. `ukr`, `default`, `ind`). Defaults to repo-configured value. */
  worldview?: string;

  /** 0 = countries, 1 = subdivisions (or aggregated regions when region_set is set). */
  admin_level?: AdminLevel;

  /** ISO_A3 country code; required when admin_level === 1 (and not a composite). */
  country?: string;

  /** Identifier from regional_aggregations.yaml; selects an aggregated region layer. */
  region_set?: RegionSetId;

  /** Identifier from composite_maps.yaml; selects a composite map (e.g. france_overseas). */
  composite?: string;

  /** ISO codes to keep; if non-empty, filter rendered features to these. */
  region_includes?: string[];
  /** ISO codes to drop; mutually exclusive with the above in normal use. */
  region_excludes?: string[];

  /** When true (default), repositioned flying islands are visible; when false, they are dropped. */
  show_flying_islands?: boolean;

  /** NE NAME_<lang> field code (e.g. `en`, `fr`, `de`, `vi`). */
  name_language?: string;

  // ---- Inherited / shared ---- //
  /** Chosen metric to color the choropleth by. */
  metric?: string;
  /** Color scheme name from @superset-ui/core. */
  linear_color_scheme?: string;
  /** Number-format string for tooltip values. */
  number_format?: string;
}

/** Props shape passed to the renderer after transformProps. */
export interface CountryMapTransformedProps {
  width: number;
  height: number;
  formData: CountryMapFormData;
  data: Array<Record<string, unknown>>;
  // The resolved GeoJSON URL the renderer should fetch — derived from
  // formData fields by transformProps; null if unsatisfiable.
  geoJsonUrl: string | null;
  metricName: string | null;
  numberFormat: string | undefined;
  linearColorScheme: string | undefined;
}

export type CountryMapChartProps = ChartProps<CountryMapFormData>;
