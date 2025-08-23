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

import { SAMPLE_DASHBOARD_1 } from 'cypress/utils/urls';
import { interceptCharts, interceptDatasets, interceptGet } from './utils';

export const SAMPLE_CHART = { name: 'Most Populated Countries', viz: 'table' };

export function visitDashboard(createSample = true) {
  interceptCharts();
  interceptGet();
  interceptDatasets();

  if (createSample) {
    cy.createSampleDashboards([0]);
  }

  cy.visit(SAMPLE_DASHBOARD_1);
  cy.wait('@get');
  cy.wait('@getCharts');
  cy.wait('@getDatasets');
  cy.url().should('contain', 'native_filters_key');
}

export function prepareDashboardFilters(
  filters: { name: string; column: string; datasetId: number }[],
) {
  cy.createSampleDashboards([0]);
  cy.request({
    method: 'GET',
    url: `api/v1/dashboard/1-sample-dashboard`,
  }).then(res => {
    const { body } = res;
    const dashboardId = body.result.id;
    const allFilters: Record<string, unknown>[] = [];
    filters.forEach((f, i) => {
      allFilters.push({
        id: `NATIVE_FILTER-fLH0pxFQ${i}`,
        controlValues: {
          enableEmptyFilter: false,
          defaultToFirstItem: false,
          multiSelect: true,
          searchAllOptions: false,
          inverseSelection: false,
        },
        name: f.name,
        filterType: 'filter_select',
        targets: [
          {
            datasetId: f.datasetId,
            column: { name: f.column },
          },
        ],
        defaultDataMask: {
          extraFormData: {},
          filterState: {},
          ownState: {},
        },
        cascadeParentIds: [],
        scope: {
          rootPath: ['ROOT_ID'],
          excluded: [],
        },
        type: 'NATIVE_FILTER',
        description: '',
        chartsInScope: [5],
        tabsInScope: [],
      });
    });
    if (dashboardId) {
      const jsonMetadata = {
        native_filter_configuration: allFilters,
        timed_refresh_immune_slices: [],
        expanded_slices: {},
        refresh_frequency: 0,
        color_scheme: '',
        label_colors: {},
        shared_label_colors: [],
        color_scheme_domain: [],
        cross_filters_enabled: false,
        positions: {
          DASHBOARD_VERSION_KEY: 'v2',
          ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
          GRID_ID: {
            type: 'GRID',
            id: 'GRID_ID',
            children: ['ROW-0rHnUz4nMA'],
            parents: ['ROOT_ID'],
          },
          HEADER_ID: {
            id: 'HEADER_ID',
            type: 'HEADER',
            meta: { text: '1 - Sample dashboard' },
          },
          'CHART-DF6EfI55F-': {
            type: 'CHART',
            id: 'CHART-DF6EfI55F-',
            children: [],
            parents: ['ROOT_ID', 'GRID_ID', 'ROW-0rHnUz4nMA'],
            meta: {
              width: 4,
              height: 50,
              chartId: 5,
              sliceName: 'Most Populated Countries',
            },
          },
          'ROW-0rHnUz4nMA': {
            type: 'ROW',
            id: 'ROW-0rHnUz4nMA',
            children: ['CHART-DF6EfI55F-'],
            parents: ['ROOT_ID', 'GRID_ID'],
            meta: { background: 'BACKGROUND_TRANSPARENT' },
          },
        },
        default_filters: '{}',
        filter_scopes: {},
        chart_configuration: {},
      };

      return cy
        .request({
          method: 'PUT',
          url: `api/v1/dashboard/${dashboardId}`,
          body: {
            json_metadata: JSON.stringify(jsonMetadata),
          },
        })
        .then(() => visitDashboard(false));
    }
    return cy;
  });
}
