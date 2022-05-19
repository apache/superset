import { getChartAlias, Slice } from 'cypress/utils/vizPlugins';
import {
  dashboardView,
  editDashboardView,
  nativeFilters,
} from 'cypress/support/directories';

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
export const TABBED_DASHBOARD = '/superset/dashboard/tabbed_dash/';

export const testItems = {
  dashboard: 'Cypress Sales Dashboard',
  dataset: 'Vehicle Sales',
  chart: 'Cypress chart',
  newChart: 'New Cypress Chart',
  createdDashboard: 'New Dashboard',
  defaultNameDashboard: '[ untitled dashboard ]',
  newDashboardTitle: `Test dashboard [NEW TEST]`,
  bulkFirstNameDashboard: 'First Dash',
  bulkSecondNameDashboard: 'Second Dash',
  worldBanksDataCopy: `World Bank's Data [copy]`,
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
        .trigger('mousedown', { which: 1 })
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
 * Clicks on new filter button
 * @returns {None}
 * @summary helper for adding new filter
 ************************************************************************* */
export function clickOnAddFilterInModal() {
  return cy
    .get(nativeFilters.addFilterButton.button)
    .first()
    .click()
    .then(() => {
      cy.get(nativeFilters.addFilterButton.dropdownItem)
        .contains('Filter')
        .click({ force: true });
    });
}

/** ************************************************************************
 * Fills value native filter form with basic information
 * @param {string} name name for filter
 * @param {string} dataset which dataset should be used
 * @param {string} filterColumn which column should be used
 * @returns {None}
 * @summary helper for filling value native filter form
 ************************************************************************* */
export function fillValueNativeFilterForm(
  name: string,
  dataset: string,
  filterColumn: string,
) {
  cy.get(nativeFilters.modal.container)
    .find(nativeFilters.filtersPanel.filterName)
    .last()
    .click({ scrollBehavior: false })
    .type(name, { scrollBehavior: false });
  cy.get(nativeFilters.modal.container)
    .find(nativeFilters.filtersPanel.datasetName)
    .last()
    .click({ scrollBehavior: false })
    .type(`${dataset}{enter}`, { scrollBehavior: false });
  cy.get(nativeFilters.silentLoading).should('not.exist');
  cy.get(nativeFilters.filtersPanel.filterInfoInput)
    .last()
    .should('be.visible')
    .click({ force: true });
  cy.get(nativeFilters.filtersPanel.filterInfoInput).last().type(filterColumn);
  cy.get(nativeFilters.filtersPanel.inputDropdown)
    .should('be.visible', { timeout: 20000 })
    .last()
    .click();
}
/** ************************************************************************
 * Get native filter placeholder e.g 9 options
 * @param {number} index which input it fills
 * @returns cy object for assertions
 * @summary helper for getting placeholder value
 ************************************************************************* */
export function getNativeFilterPlaceholderWithIndex(index: number) {
  return cy.get(nativeFilters.filtersPanel.columnEmptyInput).eq(index);
}

/** ************************************************************************
 * Apply native filter value from dashboard view
 * @param {number} index which input it fills
 * @param {string} value what is filter value
 * @returns {null}
 * @summary put value to nth native filter input in view
 ************************************************************************* */
export function applyNativeFilterValueWithIndex(index: number, value: string) {
  cy.get(nativeFilters.filterFromDashboardView.filterValueInput)
    .eq(index)
    .parent()
    .should('be.visible', { timeout: 10000 })
    .type(`${value}{enter}`);
  // click the title to dismiss shown options
  cy.get(nativeFilters.filterFromDashboardView.filterName).eq(index).click();
}

/** ************************************************************************
 * Fills parent filter input
 * @param {number} index which input it fills
 * @param {string} value on which filter it depends on
 * @returns {null}
 * @summary takes first or second input and modify the depends on filter value
 ************************************************************************* */
export function addParentFilterWithValue(index: number, value: string) {
  return cy
    .get(nativeFilters.filterConfigurationSections.displayedSection)
    .within(() => {
      cy.get('input[aria-label="Limit type"]')
        .eq(index)
        .click({ force: true })
        .type(`${value}{enter}`, { delay: 30, force: true });
    });
}
