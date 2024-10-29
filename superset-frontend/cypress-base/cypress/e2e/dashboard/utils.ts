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

import { dashboardView, nativeFilters } from 'cypress/support/directories';
import { ChartSpec, waitForChartLoad } from 'cypress/utils';

export const WORLD_HEALTH_CHARTS = [
  { name: '% Rural', viz: 'world_map' },
  { name: 'Most Populated Countries', viz: 'table' },
  { name: "World's Population", viz: 'big_number' },
  { name: 'Growth Rate', viz: 'line' },
  { name: 'Rural Breakdown', viz: 'sunburst_v2' },
  { name: "World's Pop Growth", viz: 'area' },
  { name: 'Life Expectancy VS Rural %', viz: 'bubble' },
  { name: 'Treemap', viz: 'treemap_v2' },
  { name: 'Box plot', viz: 'box_plot' },
] as ChartSpec[];

export const SUPPORTED_TIER1_CHARTS = [
  { name: 'Big Number', viz: 'big_number_total' },
  { name: 'Big Number with Trendline', viz: 'big_number' },
  { name: 'Pie Chart', viz: 'pie' },
  { name: 'Table', viz: 'table' },
  { name: 'Pivot Table', viz: 'pivot_table_v2' },
  { name: 'Line Chart', viz: 'echarts_timeseries_line' },
  { name: 'Area Chart', viz: 'echarts_area' },
  { name: 'Scatter Chart', viz: 'echarts_timeseries_scatter' },
  { name: 'Bar Chart V2', viz: 'echarts_timeseries_bar' },
] as ChartSpec[];

export const SUPPORTED_TIER2_CHARTS = [
  { name: 'Box Plot Chart', viz: 'box_plot' },
  { name: 'Generic Chart', viz: 'echarts_timeseries' },
  { name: 'Smooth Line Chart', viz: 'echarts_timeseries_smooth' },
  { name: 'Step Line Chart', viz: 'echarts_timeseries_step' },
  { name: 'Funnel Chart', viz: 'funnel' },
  { name: 'Gauge Chart', viz: 'gauge_chart' },
  { name: 'Radar Chart', viz: 'radar' },
  { name: 'Treemap V2 Chart', viz: 'treemap_v2' },
  { name: 'Mixed Chart', viz: 'mixed_timeseries' },
] as ChartSpec[];

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

export const nativeFilterTooltips = {
  searchAllFilterOptions:
    'By default, each filter loads at most 1000 choices at the initial page load. Check this box if you have more than 1000 filter values and want to enable dynamically searching that loads filter values as users type (may add stress to your database).',
  defaultToFirstItem: 'When using this option, default value can’t be set',
  inverseSelection: 'Exclude selected values',
  required: 'User must select a value before applying the filter',
  multipleSelect: 'Allow selecting multiple values',
  defaultValue:
    'Default value must be set when "Filter value is required" is checked',
  preFilter: `Add filter clauses to control the filter's source query, though only in the context of the autocomplete i.e., these conditions do not impact how the filter is applied to the dashboard. This is useful when you want to improve the query's performance by only scanning a subset of the underlying data or limit the available values displayed in the filter.`,
};

export const nativeFilterOptions = [
  'Filter has default value',
  'Multiple select',
  'Filter value is required',
  'Filter is hierarchical',
  'Default to first item',
  'Inverse selection',
  'Search all filter options',
  'Pre-filter available values',
  'Sort filter values',
];

export const valueNativeFilterOptions = [
  'Pre-filter available values',
  'Sort filter values',
  'Filter has default value',
  'Select first filter value by default',
  'Can select multiple values',
  'Dynamically search all filter values',
  'Inverse selection',
  'Filter value is required',
];

export function interceptGet() {
  cy.intercept('/api/v1/dashboard/*').as('get');
}

export function interceptFiltering() {
  cy.intercept('GET', `/api/v1/dashboard/?q=*`).as('filtering');
}

export function interceptBulkDelete() {
  cy.intercept('DELETE', `/api/v1/dashboard/?q=*`).as('bulkDelete');
}

export function interceptDelete() {
  cy.intercept('DELETE', `/api/v1/dashboard/*`).as('delete');
}

export function interceptUpdate() {
  cy.intercept('PUT', `/api/v1/dashboard/*`).as('update');
}

export function interceptPost() {
  cy.intercept('POST', `/api/v1/dashboard/`).as('post');
}

export function interceptLog() {
  cy.intercept('/superset/log/?explode=events&dashboard_id=*').as('logs');
}

export function interceptFav() {
  cy.intercept({ url: `/api/v1/dashboard/*/favorites/`, method: 'POST' }).as(
    'select',
  );
}

export function interceptUnfav() {
  cy.intercept({ url: `/api/v1/dashboard/*/favorites/`, method: 'POST' }).as(
    'unselect',
  );
}

export function interceptDataset() {
  cy.intercept('GET', `/api/v1/dataset/*`).as('getDataset');
}

export function interceptCharts() {
  cy.intercept('GET', `/api/v1/dashboard/*/charts`).as('getCharts');
}

export function interceptDatasets() {
  cy.intercept('GET', `/api/v1/dashboard/*/datasets`).as('getDatasets');
}

export function interceptFilterState() {
  cy.intercept('POST', `/api/v1/dashboard/*/filter_state*`).as(
    'postFilterState',
  );
}

export function setFilter(filter: string, option: string) {
  interceptFiltering();

  cy.get(`[aria-label="${filter}"]`).first().click();
  cy.get(`[aria-label="${filter}"] [title="${option}"]`).click();

  cy.wait('@filtering');
}

/** ************************************************************************
 * Expend Native filter from the left panel on dashboard
 * @returns {None}
 * @summary helper for expend native filter
 ************************************************************************* */
export function expandFilterOnLeftPanel() {
  return cy
    .get(nativeFilters.filterFromDashboardView.expand)
    .should('be.visible')
    .click({ force: true });
}

/** ************************************************************************
 * Collapses Native Filter from the left panel on dashboard
 * @returns {None}
 * @summary helper for collapse native filter
 ************************************************************************* */
export function collapseFilterOnLeftPanel() {
  cy.get(nativeFilters.filterFromDashboardView.collapse)
    .should('be.visible')
    .click();
  cy.get(nativeFilters.filterFromDashboardView.collapse).should(
    'not.be.visible',
  );
}

/** ************************************************************************
 * Enter Native Filter edit modal from the left panel on dashboard
 * @returns {None}
 * @summary helper for enter native filter edit modal
 ************************************************************************* */
export function enterNativeFilterEditModal(waitForDataset = true) {
  interceptDataset();
  cy.get(nativeFilters.filterFromDashboardView.createFilterButton).click({
    force: true,
  });
  cy.get(nativeFilters.modal.container).should('be.visible');
  if (waitForDataset) {
    cy.wait('@getDataset');
  }
}

/** ************************************************************************
 * Clicks on new filter button
 * @returns {None}
 * @summary helper for adding new filter
 ************************************************************************* */
export function clickOnAddFilterInModal() {
  cy.get(nativeFilters.addFilterButton.button).first().click();
  return cy
    .get(nativeFilters.addFilterButton.dropdownItem)
    .contains('Filter')
    .click({ force: true });
}

/** ************************************************************************
 * Fills value native filter form with basic information
 * @param {string} type type for filter: Value, Numerical range,Time column,Time grain,Time range
 *  @param {string} name name for filter
 * @param {string} dataset which dataset should be used
 * @param {string} filterColumn which column should be used
 * @returns {None}
 * @summary helper for filling value native filter form
 ************************************************************************* */
export function fillNativeFilterForm(
  type: string,
  name: string,
  dataset?: string,
  filterColumn?: string,
) {
  cy.get(nativeFilters.filtersPanel.filterTypeInput)
    .find(nativeFilters.filtersPanel.filterTypeItem)
    .click({ multiple: true, force: true });
  cy.get(`[label="${type}"]`).click({ multiple: true, force: true });
  cy.get(nativeFilters.modal.container)
    .find(nativeFilters.filtersPanel.filterName)
    .last()
    .click({ scrollBehavior: false });
  cy.get(nativeFilters.modal.container)
    .find(nativeFilters.filtersPanel.filterName)
    .last()
    .clear({ force: true });
  cy.get(nativeFilters.modal.container)
    .find(nativeFilters.filtersPanel.filterName)
    .last()
    .type(name, { scrollBehavior: false, force: true });
  if (dataset) {
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .last()
      .click({ force: true, scrollBehavior: false });
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .type(`${dataset}`, { scrollBehavior: false });
    cy.get(nativeFilters.silentLoading).should('not.exist');
    cy.get(`[label="${dataset}"]`).click({ multiple: true, force: true });
  }
  cy.get(nativeFilters.silentLoading).should('not.exist');
  if (filterColumn) {
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .click({ force: true });
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .type(filterColumn);
    cy.get(nativeFilters.filtersPanel.inputDropdown)
      .should('be.visible', { timeout: 20000 })
      .last()
      .click();
  }
  cy.get(nativeFilters.silentLoading).should('not.exist');
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
    .should('exist', { timeout: 10000 })
    .type(`${value}{enter}`, { force: true });
  // click the title to dismiss shown options
  cy.get(nativeFilters.filterFromDashboardView.filterName)
    .eq(index)
    .click({ force: true });
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
      cy.get('input[aria-label="Limit type"]').eq(index).click({ force: true });
      cy.get('input[aria-label="Limit type"]')
        .eq(index)
        .type(`${value}{enter}`, { delay: 30, force: true });
    });
}

/** ************************************************************************
 * Save Native Filter Settings
 * @returns {None}
 * @summary helper for save native filters settings
 ************************************************************************* */
export function saveNativeFilterSettings(charts: ChartSpec[]) {
  cy.get(nativeFilters.modal.footer)
    .contains('Save')
    .should('be.visible')
    .click();
  cy.get(nativeFilters.modal.container).should('not.exist');
  charts.forEach(waitForChartLoad);
}

/** ************************************************************************
 * Cancel Native filter settings
 * @returns {None}
 * @summary helper for cancel native filters settings
 ************************************************************************* */
export function cancelNativeFilterSettings() {
  cy.get(nativeFilters.modal.footer)
    .find(nativeFilters.modal.cancelButton)
    .should('be.visible')
    .click();
  cy.get(nativeFilters.modal.alertXUnsavedFilters)
    .should('be.visible')
    .should('have.text', 'There are unsaved changes.');
  cy.get(nativeFilters.modal.footer)
    .find(nativeFilters.modal.confirmCancelButton)
    .contains('cancel')
    .click({ force: true });
  cy.get(nativeFilters.modal.container).should('not.exist');
}

/** ************************************************************************
 * Validate filter name on dashboard
 * @param name: filter name to validate
 * @return {null}
 * @summary helper for validate filter name on dashboard
 ************************************************************************* */
export function validateFilterNameOnDashboard(name: string) {
  cy.get(nativeFilters.filterFromDashboardView.filterName)
    .should('be.visible', { timeout: 40000 })
    .contains(`${name}`);
}

/** ************************************************************************
 * Validate filter content on dashboard
 * @param filterContent: filter content to validate
 * @return {null}
 * @summary helper for validate filter content on dashboard
 ************************************************************************* */
export function validateFilterContentOnDashboard(filterContent: string) {
  cy.get(nativeFilters.filterFromDashboardView.filterContent)
    .contains(`${filterContent}`)
    .should('be.visible');
}

/** ************************************************************************
 * Delete Native filter
 * @return {null}
 * @summary helper for delete native filter
 ************************************************************************* */
export function deleteNativeFilter() {
  cy.get(nativeFilters.filtersList.removeIcon).first().click();
}

/** ************************************************************************
 * Undo delete Native filter
 * @return {null}
 * @summary helper for undo delete native filter
 ************************************************************************ */
export function undoDeleteNativeFilter() {
  deleteNativeFilter();
  cy.contains('Undo?').click();
}

/** ************************************************************************
 * Check Native Filter tooltip content
 * @param index: tooltip index to check
 * @param value: tooltip value to check
 * @return {null}
 * @summary helper for checking native filter tooltip content by index
 ************************************************************************* */
export function checkNativeFilterTooltip(index: number, value: string) {
  cy.get(nativeFilters.filterConfigurationSections.infoTooltip)
    .eq(index)
    .trigger('mouseover');
  cy.contains(`${value}`);
}

/** ************************************************************************
 * Apply advanced time range filter on dashboard
 * @param startRange: starting time range
 * @param endRange: ending time range
 * @return {null}
 * @summary helper for applying advanced time range filter on dashboard with customize time range
 ************************************************************************* */
export function applyAdvancedTimeRangeFilterOnDashboard(
  startRange?: string,
  endRange?: string,
) {
  cy.get('.control-label').contains('RANGE TYPE').should('be.visible');
  cy.get('.ant-popover-content .ant-select-selector')
    .should('be.visible')
    .click();
  cy.get(`[label="Advanced"]`).should('be.visible').click();
  cy.get('.section-title').contains('Advanced Time Range').should('be.visible');
  if (startRange) {
    cy.get('.ant-popover-inner-content')
      .find('[class^=ant-input]')
      .first()
      .type(`${startRange}`);
  }
  if (endRange) {
    cy.get('.ant-popover-inner-content')
      .find('[class^=ant-input]')
      .last()
      .type(`${endRange}`);
  }
  cy.get(dashboardView.timeRangeModal.applyButton).click();
  cy.get(nativeFilters.applyFilter).click();
}

/** ************************************************************************
 * Input default value in Native filter in filter settings
 * @param defaultValue: default value for native filter
 * @return {null}
 * @summary helper for input default value in Native filter in filter settings
 ************************************************************************* */
export function inputNativeFilterDefaultValue(
  defaultValue: string,
  multiple = false,
) {
  if (!multiple) {
    cy.contains('Filter has default value').click();
    cy.contains('Default value is required').should('be.visible');
    cy.get(nativeFilters.modal.container).within(() => {
      cy.get(
        nativeFilters.filterConfigurationSections.filterPlaceholder,
      ).contains('options');
      cy.get(
        nativeFilters.filterConfigurationSections.collapsedSectionContainer,
      )
        .eq(1)
        .within(() => {
          cy.get('.ant-select-selection-search-input').type(
            `${defaultValue}{enter}`,
            { force: true },
          );
        });
    });
  } else {
    cy.getBySel('default-input').within(() => {
      cy.get('.ant-select-selection-search-input').click();
      cy.get('.ant-select-item-option-content').contains(defaultValue).click();
    });
  }
}

/** ************************************************************************
 * add filter for test column 'Country name'
 * @return {null}
 * @summary helper for add filter for test column 'Country name'
 ************************************************************************* */
export function addCountryNameFilter() {
  fillNativeFilterForm(
    testItems.filterType.value,
    testItems.topTenChart.filterColumn,
    testItems.datasetForNativeFilter,
    testItems.topTenChart.filterColumn,
  );
}

export function openTab(tabComponentIndex: number, tabIndex: number) {
  return cy
    .getBySel('dashboard-component-tabs')
    .eq(tabComponentIndex)
    .find('[role="tab"]')
    .eq(tabIndex)
    .click();
}

export const openTopLevelTab = (tabName: string) => {
  cy.get("div#TABS-TOP div[role='tab']").contains(tabName).click();
};
