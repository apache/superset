import { getChartAlias, Slice } from 'cypress/utils/vizPlugins';
import { dashboardView } from 'cypress/support/directories';

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
export const WORLD_HEALTH_DASHBOARD = '/superset/dashboard/world_health/';
export const testDashboard = '/superset/dashboard/538/';
export const TABBED_DASHBOARD = '/superset/dashboard/tabbed_dash/';

export const testItems = {
  dashboard: 'Cypress test Dashboard',
  dataset: 'Vehicle Sales',
  datasetForNativeFilter: 'wb_health_population',
  chart: 'Cypress chart',
  newChart: 'New Cypress Chart',
  createdDashboard: 'New Dashboard',
  defaultNameDashboard: '[ untitled dashboard ]',
  newDashboardTitle: `Test dashboard [NEW TEST]`,
  bulkFirstNameDashboard: 'First Dash',
  bulkSecondNameDashboard: 'Second Dash',
  worldBanksDataCopy: `World Bank's Data [copy]`,
  filterType: {
    value: 'Value',
    numerical: 'Numerical range',
    timeColumn: 'Time column',
    timeGrain: 'Time grain',
    timeRange: 'Time range',
  },
  topTenChart: {
    name: 'Most Populated Countries',
    filterColumn: 'country_name',
    filterColumnYear: 'year',
    filterColumnRegion: 'region',
    filterColumnCountryCode: 'country_code',
  },
  filterDefaultValue: 'United States',
  filterOtherCountry: 'China',
  filterTimeGrain: 'Month',
  filterTimeColumn: 'created',
  filterNumericalColumn: 'SP_RUR_TOTL_ZS',
};

export const CHECK_DASHBOARD_FAVORITE_ENDPOINT =
  '/superset/favstar/Dashboard/*/count';

export const WORLD_HEALTH_CHARTS = [
  { name: '% Rural', viz: 'world_map' },
  { name: 'Most Populated Countries', viz: 'table' },
  { name: 'Region Filter', viz: 'filter_box' },
  { name: "World's Population", viz: 'big_number' },
  { name: 'Growth Rate', viz: 'line' },
  { name: 'Rural Breakdown', viz: 'sunburst' },
  { name: "World's Pop Growth", viz: 'area' },
  { name: 'Life Expectancy VS Rural %', viz: 'bubble' },
  { name: 'Treemap', viz: 'treemap' },
  { name: 'Box plot', viz: 'box_plot' },
] as const;

/** Used to specify charts expected by the test suite */
export interface ChartSpec {
  name: string;
  viz: string;
}

export function getChartGridComponent({ name, viz }: ChartSpec) {
  return cy
    .get(`[data-test="chart-grid-component"][data-test-chart-name="${name}"]`)
    .should('have.attr', 'data-test-viz-type', viz);
}

export function waitForChartLoad(chart: ChartSpec) {
  return getChartGridComponent(chart).then(gridComponent => {
    const chartId = gridComponent.attr('data-test-chart-id');
    // the chart should load in under half a minute
    return (
      cy
        // this id only becomes visible when the chart is loaded
        .get(`[data-test="chart-grid-component"] #chart-id-${chartId}`, {
          timeout: 30000,
        })
        .should('be.visible')
        // return the chart grid component
        .then(() => gridComponent)
    );
  });
}

const toSlicelike = ($chart: JQuery<HTMLElement>): Slice => ({
  slice_id: parseInt($chart.attr('data-test-chart-id')!, 10),
  form_data: {
    viz_type: $chart.attr('data-test-viz-type')!,
  },
});

export function getChartAliasBySpec(chart: ChartSpec) {
  return getChartGridComponent(chart).then($chart =>
    cy.wrap(getChartAlias(toSlicelike($chart))),
  );
}

export function getChartAliasesBySpec(charts: readonly ChartSpec[]) {
  const aliases: string[] = [];
  charts.forEach(chart =>
    getChartAliasBySpec(chart).then(alias => {
      aliases.push(alias);
    }),
  );
  // Wrapping the aliases is key.
  // That way callers can chain off this function
  // and actually get the list of aliases.
  return cy.wrap(aliases);
}

/**
 * Drag an element and drop it to another element.
 * Usage:
 *    drag(source).to(target);
 */
export function drag(selector: string, content: string | number | RegExp) {
  const dataTransfer = { data: {} };
  return {
    to(target: string | Cypress.Chainable) {
      cy.get('.dragdroppable')
        .contains(selector, content)
        .trigger('mousedown', { which: 1 })
        .trigger('dragstart', { dataTransfer })
        .trigger('drag', {});

      (typeof target === 'string' ? cy.get(target) : target)
        .trigger('dragover', { dataTransfer })
        .trigger('drop', { dataTransfer })
        .trigger('dragend', { dataTransfer })
        .trigger('mouseup', { which: 1 });
    },
  };
}

export function resize(selector: string) {
  return {
    to(cordX: number, cordY: number) {
      cy.get(selector)
        .trigger('mousedown', { which: 1, force: true })
        .trigger('mousemove', { which: 1, cordX, cordY, force: true })
        .trigger('mouseup', { which: 1, force: true });
    },
  };
}

export function cleanUp() {
  cy.deleteDashboardByName(testItems.dashboard);
  cy.deleteDashboardByName(testItems.defaultNameDashboard);
  cy.deleteDashboardByName('');
  cy.deleteDashboardByName(testItems.newDashboardTitle);
  cy.deleteDashboardByName(testItems.bulkFirstNameDashboard);
  cy.deleteDashboardByName(testItems.bulkSecondNameDashboard);
  cy.deleteDashboardByName(testItems.createdDashboard);
  cy.deleteDashboardByName(testItems.worldBanksDataCopy);
  cy.deleteChartByName(testItems.chart);
  cy.deleteChartByName(testItems.newChart);
}

/** ************************************************************************
 * Copy dashboard for testing purpose
 * @returns {None}
 * @summary helper for copy dashboard for testing purpose
 ************************************************************************* */
export function copyTestDashboard(dashboard: string) {
  cy.intercept('POST', '**/copy_dash/**').as('copy');
  cy.intercept('GET', '**/api/v1/dataset/**').as('datasetLoad');
  cy.intercept('**/api/v1/dashboard/?q=**').as('dashboardsList');
  cy.intercept('**/api/v1/dashboard/**').as('dashboard');
  cy.visit('dashboard/list/');
  cy.contains('Actions');
  cy.wait('@dashboardsList').then(xhr => {
    const dashboards = xhr.response?.body.result;
    /* eslint-disable no-unused-expressions */
    expect(dashboards).not.to.be.undefined;
    const testDashboard = dashboards.find(
      (d: { dashboard_title: string }) => d.dashboard_title === `${dashboard}`,
    );
    cy.visit(testDashboard.url);
  });
  cy.get(dashboardView.threeDotsMenuIcon).should('be.visible').click();
  cy.get(dashboardView.saveAsMenuOption).click();
  cy.get(dashboardView.saveModal.dashboardNameInput)
    .should('be.visible')
    .clear()
    .type(testItems.dashboard);
  cy.get(dashboardView.saveModal.saveButton).click();
  cy.wait('@copy', { timeout: 45000 })
    .its('response.statusCode')
    .should('eq', 200);
}
