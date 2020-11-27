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

const V1_PLUGINS = ['box_plot', 'echarts_timeseries', 'word_cloud', 'pie'];
export const DASHBOARD_CHART_ALIAS_PREFIX = 'getJson_';

export function isLegacyChart(vizType: string): boolean {
  return !V1_PLUGINS.includes(vizType);
}
export function isLegacyResponse(response: any): boolean {
  return !response.result;
}
export function getSliceIdFromRequestUrl(url: string): string {
  const address = new URL(url);
  const query = address.searchParams.get('form_data');
  return query?.match(/\d+/)[0];
}
export function getChartAliases(slices: any[]): string[] {
  const aliases: string[] = [];
  Array.from(slices).forEach(slice => {
    const vizType = slice.form_data.viz_type;
    const isLegacy = isLegacyChart(vizType);
    const alias = `${DASHBOARD_CHART_ALIAS_PREFIX}${slice.slice_id}`;
    const formData = `{"slice_id":${slice.slice_id}}`;
    if (isLegacy) {
      const route = `/superset/explore_json/?*${formData}*`;
      cy.route('POST', `${route}`).as(alias);
      aliases.push(`@${alias}`);
    } else {
      const route = `/api/v1/chart/data?*${formData}*`;
      cy.route('POST', `${route}`).as(alias);
      aliases.push(`@${alias}`);
    }
  });
  return aliases;
}
