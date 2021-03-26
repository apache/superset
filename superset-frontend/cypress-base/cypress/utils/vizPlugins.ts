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

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonArray = JsonValue[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = { [member: string]: any };

export interface Slice {
  slice_id: number;
  form_data: {
    viz_type: string;
  };
}

export interface Dashboard {
  slices: Slice[];
}

const V1_PLUGINS = [
  'box_plot',
  'echarts_timeseries',
  'word_cloud',
  'pie',
  'table',
];
export const DASHBOARD_CHART_ALIAS_PREFIX = 'getChartData_';

export function isLegacyChart(vizType: string): boolean {
  return !V1_PLUGINS.includes(vizType);
}

export function isLegacyResponse(response: any): boolean {
  return !response.result;
}

export function getSliceIdFromRequestUrl(url: string) {
  const address = new URL(url);
  const query = address.searchParams.get('form_data');
  return query?.match(/\d+/)?.[0];
}

export function getChartDataRouteForSlice(slice: Slice) {
  const vizType = slice.form_data.viz_type;
  const isLegacy = isLegacyChart(vizType);
  const formData = encodeURIComponent(`{"slice_id":${slice.slice_id}}`);
  if (isLegacy) {
    return `/superset/explore_json/?*${formData}*`;
  }
  return `/api/v1/chart/data?*${formData}*`;
}

export function getChartAlias(slice: Slice): string {
  const alias = `${DASHBOARD_CHART_ALIAS_PREFIX}${slice.slice_id}_${slice.form_data.viz_type}`;
  const route = getChartDataRouteForSlice(slice);
  cy.intercept('POST', route).as(alias);
  return `@${alias}`;
}

export function getChartAliases(slices: Slice[]): string[] {
  return Array.from(slices).map(getChartAlias);
}

export function interceptChart({
  sliceId,
  legacy = false,
  method = 'POST',
}: {
  sliceId?: number;
  legacy?: boolean;
  method?: 'POST' | 'GET';
}) {
  const urlBase = legacy ? '**/superset/explore_json/' : '**/api/v1/chart/data';
  let url;
  if (sliceId) {
    const encodedFormData = encodeURIComponent(
      JSON.stringify({ slice_id: sliceId }),
    );
    url = `${urlBase}?form_data=${encodedFormData}*`;
  } else {
    url = `${urlBase}**`;
  }
  return cy.intercept(method, url);
}
