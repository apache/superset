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
  CountryMapChartProps,
  CountryMapFormData,
  CountryMapTransformedProps,
} from '../types';

/**
 * Translate Superset's standard ChartProps into the shape the renderer
 * needs. Notable: derive `geoJsonUrl` from the form data so the renderer
 * can fetch the right output from the build pipeline.
 *
 * URL layout (matches the build script's output naming):
 *   <worldview>_admin0.geo.json                — world choropleth, per worldview
 *   ukr_admin1_<adm0_a3>.geo.json              — country subdivisions, shared
 *   regional_<adm0_a3>_<set>_ukr.geo.json      — aggregated regions, shared
 *   composite_<id>_ukr.geo.json                — composite maps, shared
 *
 * Worldview only affects Admin 0 because Natural Earth's Admin 1 layer is
 * a single global file with no worldview variants — subdivisions within a
 * country don't change with the user's worldview choice. Aggregated
 * regions and composites dissolve / regroup Admin 1, so they inherit the
 * shared baseline too. The "_ukr" suffix on shared outputs is historical
 * and kept for back-compat with the build pipeline's naming.
 */
const GEOJSON_BASE = '/static/assets/country-maps';
const SHARED_ADMIN1_WORLDVIEW = 'ukr';

export default function transformProps(
  chartProps: CountryMapChartProps,
): CountryMapTransformedProps {
  const { queriesData, width, height } = chartProps;
  // ChartProps.formData is camelCase-normalized; use rawFormData to keep
  // the snake_case keys defined in CountryMapFormData / the control panel.
  const formData = chartProps.rawFormData as CountryMapFormData;
  const data = (queriesData?.[0]?.data as Record<string, unknown>[]) ?? [];

  const worldview = formData.worldview || 'ukr';
  // SelectControl serializes the admin_level value as a string ('0' /
  // '1' / 'aggregated'), but the form_data type allows number 0/1 too
  // (legacy migration, jest tests). Normalize to a string before any
  // comparison so we don't silently fall through every branch and
  // return a null URL.
  const adminLevel = String(formData.admin_level ?? '0');

  let geoJsonUrl: string | null = null;
  if (formData.composite) {
    geoJsonUrl = `${GEOJSON_BASE}/composite_${formData.composite}_${SHARED_ADMIN1_WORLDVIEW}.geo.json`;
  } else if (formData.region_set && formData.country) {
    geoJsonUrl = `${GEOJSON_BASE}/regional_${formData.country}_${formData.region_set}_${SHARED_ADMIN1_WORLDVIEW}.geo.json`;
  } else if (adminLevel === '1' && formData.country) {
    geoJsonUrl = `${GEOJSON_BASE}/${SHARED_ADMIN1_WORLDVIEW}_admin1_${formData.country}.geo.json`;
  } else if (adminLevel === '0') {
    geoJsonUrl = `${GEOJSON_BASE}/${worldview}_admin0.geo.json`;
  }

  return {
    width,
    height,
    formData,
    data,
    geoJsonUrl,
    metricName: typeof formData.metric === 'string' ? formData.metric : null,
    numberFormat: formData.number_format,
    linearColorScheme: formData.linear_color_scheme,
  };
}
