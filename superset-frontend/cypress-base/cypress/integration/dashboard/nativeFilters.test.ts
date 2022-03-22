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
import qs from 'querystring';
import {
  dashboardView,
  nativeFilters,
  exploreView,
} from 'cypress/support/directories';
import { testItems } from './dashboard.helper';
import { DASHBOARD_LIST } from '../dashboard_list/dashboard_list.helper';
import { CHART_LIST } from '../chart_list/chart_list.helper';
import { FORM_DATA_DEFAULTS } from '../explore/visualizations/shared.helper';

const getTestTitle = (
  test: Mocha.Suite = (Cypress as any).mocha.getRunner().suite.ctx.test,
): string =>
  test.parent?.title
    ? `${getTestTitle(test.parent)} -- ${test.title}`
    : test.title;

// TODO: fix flaky init logic and re-enable
const milliseconds = new Date().getTime();
const dashboard = `Test Dashboard${milliseconds}`;

describe('Nativefilters Sanity test', () => {
  before(() => {
    cy.login();
    cy.intercept('/api/v1/dashboard/?q=**').as('dashboardsList');
    cy.intercept('POST', '**/copy_dash/*').as('copy');
    cy.intercept('/api/v1/dashboard/*').as('dashboard');
    cy.request(
      'api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:100)',
    ).then(xhr => {
      const dashboards = xhr.body.result;
      const worldBankDashboard = dashboards.find(
        (d: { dashboard_title: string }) =>
          d.dashboard_title === "World Bank's Data",
      );
      cy.visit(worldBankDashboard.url);
    });
    cy.get(dashboardView.threeDotsMenuIcon).should('be.visible').click();
    cy.get(dashboardView.saveAsMenuOption).should('be.visible').click();
    cy.get(dashboardView.saveModal.dashboardNameInput)
      .should('be.visible')
      .clear()
      .type(testItems.dashboard);
    cy.get(dashboardView.saveModal.saveButton).click();
    cy.wait('@copy', { timeout: 45000 })
      .its('response.statusCode')
      .should('eq', 200);
  });
  beforeEach(() => {
    cy.login();
    cy.request(
      'api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:100)',
    ).then(xhr => {
      const dashboards = xhr.body.result;
      const testDashboard = dashboards.find(
        (d: { dashboard_title: string }) =>
          d.dashboard_title === testItems.dashboard,
      );
      cy.visit(testDashboard.url);
    });
  });
  it('User can expand / retract native filter sidebar on a dashboard', () => {
    cy.get(nativeFilters.createFilterButton).should('not.exist');
    cy.get(nativeFilters.filterFromDashboardView.expand)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.createFilterButton).should('be.visible');
    cy.get(nativeFilters.filterFromDashboardView.expand).should(
      'not.be.visible',
    );
    cy.get(nativeFilters.filterFromDashboardView.collapse)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filterFromDashboardView.collapse).should(
      'not.be.visible',
    );
  });
  it('User can enter filter edit pop-up by clicking on pencil icon', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container).should('be.visible');
  });
  it('User can add a new native filter', () => {
    let filterKey: string;
    const removeFirstChar = (search: string) =>
      search.split('').slice(1, search.length).join('');
    cy.wait(3000);
    cy.location().then(loc => {
      const queryParams = qs.parse(removeFirstChar(loc.search));
      filterKey = queryParams.native_filters_key as string;
      expect(typeof filterKey).eq('string');
    });
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ force: true })
      .type('Country name');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .click({ force: true })
      .within(() =>
        cy.get('input').type('wb_health_population{enter}', { force: true }),
      );

    cy.get(`${nativeFilters.filtersPanel.filterInfoInput}:visible:last`)
      .last()
      .focus()
      .type('country_name');
    cy.get(nativeFilters.filtersPanel.inputDropdown)
      .should('be.visible', { timeout: 20000 })
      .last()
      .click();
    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
    cy.wait(3000);
    cy.location().then(loc => {
      const queryParams = qs.parse(removeFirstChar(loc.search));
      const newfilterKey = queryParams.native_filters_key;
      expect(newfilterKey).eq(filterKey);
    });
    cy.wait(3000);
    cy.get(nativeFilters.modal.container).should('not.exist');
  });
  it('User can delete a native filter', () => {
    cy.get(nativeFilters.createFilterButton).click({ force: true });
    cy.get(nativeFilters.modal.container).should('be.visible');

    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.contains('Restore Filter').should('not.exist', { timeout: 10000 });

    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
  });
  it('User can cancel changes in native filter', () => {
    cy.get(nativeFilters.createFilterButton).click({ force: true });
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ force: true })
      .type('suffix');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .should('be.visible');
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.cancelButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.modal.alertXUnsavedFilters).should('be.visible');
    // remove native filter
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.yesCancelButton)
      .contains('cancel')
      .should('be.visible')
      .click({ force: true });

    cy.get(nativeFilters.createFilterButton).click({ force: true });
    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.contains('You have removed this filter.').should('be.visible');
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.saveButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filtersPanel.filterName).should('not.exist');
  });
  it('User can cancel creating a new filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container).should('be.visible');

    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.cancelButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.modal.alertXUnsavedFilters)
      .should('have.text', 'There are unsaved changes.')
      .should('be.visible');
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.yesCancelButton)
      .contains('cancel')
      .should('be.visible')
      .click();
    cy.get(nativeFilters.modal.container).should('not.exist');
  });
  it('User can undo deleting a native filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container).should('be.visible');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ force: true })
      .type('Country name');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .click({ force: true })
      .within(() =>
        cy.get('input').type('wb_health_population{enter}', { force: true }),
      );

    cy.get('.loading inline-centered css-101mkpk').should('not.exist');
    // hack for unclickable country_name
    cy.wait(5000);
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .should('be.visible')
      .click({ force: true });
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .type('country_name');
    cy.get(nativeFilters.filtersPanel.inputDropdown)
      .should('be.visible', { timeout: 20000 })
      .last()
      .click();
    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filterFromDashboardView.filterName)
      .should('be.visible')
      .contains('Country name');
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container).should('be.visible');
    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.contains('Undo?').click();
  });
  it('Verify setting options and tooltips for value filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.createFilterButton).should('be.visible').click();
    cy.get(nativeFilters.modal.container).should('be.visible');
    [
      'Filter has default value',
      'Can select multiple values',
      'Filter value is required',
      'Select first filter value by default',
      'Inverse selection',
      'Dynamically search all filter values',
      'Pre-filter available values',
      'Sort filter values',
    ].forEach(el => {
      cy.contains(el);
    });
    cy.get(nativeFilters.filterConfigurationSections.checkedCheckbox).contains(
      'Can select multiple values',
    );
    cy.get(nativeFilters.filterConfigurationSections.infoTooltip)
      .eq(0)
      .trigger('mouseover', { force: true });
    cy.contains('User must select a value before applying the filter');

    cy.get(nativeFilters.filterConfigurationSections.infoTooltip)
      .eq(1)
      .trigger('mouseover', { force: true });
    cy.contains('When using this option, default value can’t be set');

    cy.get(nativeFilters.filterConfigurationSections.infoTooltip)
      .eq(2)
      .trigger('mouseover', { force: true });
    cy.contains(
      'By default, each filter loads at most 1000 choices at the initial page load. Check this box if you have more than 1000 filter values and want to enable dynamically searching that loads filter values as users type (may add stress to your database).',
    );
    cy.get(nativeFilters.filterConfigurationSections.infoTooltip)
      .eq(3)
      .trigger('mouseover', { force: true });
    cy.contains('Exclude selected values');
  });
  it('User can create a time range filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .click({ force: true });
    cy.get('[label="Time range"]').click();
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click()
      .clear()
      .type('time range');
    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
    cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
    cy.get(dashboardView.salesDashboardSpecific.vehicleSalesFilterTimeRange)
      .should('be.visible')
      .click();
    cy.get('.control-label').contains('RANGE TYPE').should('be.visible');
    cy.get('.ant-popover-content .ant-select-selector')
      .should('be.visible')
      .click();
    cy.get('[label="Advanced"]').should('be.visible').click();
    cy.get('.section-title')
      .contains('Advanced Time Range')
      .should('be.visible');
    cy.get('.ant-popover-inner-content')
      .find('[class^=ant-input]')
      .first()
      .type('2005-12-17');
    cy.get(dashboardView.timeRangeModal.applyButton).click();
    cy.get(nativeFilters.applyFilter).click();
    cy.wait('@chart');
    cy.url().then(u => {
      const ur = new URL(u);
      expect(ur.search).to.include('native_filters');
    });
    cy.get(nativeFilters.filterFromDashboardView.filterName)
      .contains('time range')
      .should('be.visible');
    cy.get(nativeFilters.filterFromDashboardView.timeRangeFilterContent)
      .contains('2005-12-17')
      .should('be.visible');
  });

  it("User can check 'Filter has default value'", () => {
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.createFilterButton)
      .should('be.visible')
      .click({ force: true });
    cy.get(nativeFilters.modal.container).should('be.visible');
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .click({ force: true });
    cy.get('[label="Value"]').click();
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ force: true })
      .clear()
      .type('country_name');

    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .click({ force: true })
      .within(() =>
        cy.get('input').type('wb_health_population{enter}', { force: true }),
      );
    // hack for unclickable datetime
    cy.wait(5000);
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .click({ force: true });
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .type('country_name');
    cy.get(nativeFilters.filtersPanel.inputDropdown)
      .should('be.visible', { timeout: 20000 })
      .last()
      .click();
    cy.contains('Filter has default value').click();
    cy.contains('Default value is required');
    cy.get(nativeFilters.modal.defaultValueCheck).should('be.visible');
    cy.get(nativeFilters.filtersPanel.columnEmptyInput)
      .last()
      .type('United States{enter}');
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.saveButton)
      .should('be.visible')
      .click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.filterContent).contains(
      'United States',
    );
    cy.get('.line').within(() => {
      cy.contains('United States').should('be.visible');
    });

    // clean up the default setting
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton).click();
    cy.contains('Filter has default value').click();
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.saveButton)
      .should('be.visible')
      .click({ force: true });
  });

  it('User can create a time grain filter', () => {
    const VIZ_DEFAULTS = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'echarts_timeseries',
      datasource: '3__table',
      granularity_sqla: 'purpose__last_set',
      time_grain_sqla: 'P1D',
      time_range: 'No filter',
      metrics: ['count'],
      comparison_type: 'values',
      forecastPeriods: 10,
      forecastInterval: 0.8,
      x_axis_title_margin: 15,
      y_axis_title_margin: 15,
      y_axis_title_position: 'Left',
      color_scheme: 'supersetColors',
      seriesType: 'line',
      only_total: true,
      opacity: 0.2,
      markerSize: 6,
      legendType: 'scroll',
      legendOrientation: 'top',
      x_axis_time_format: 'smart_date',
      rich_tooltip: true,
      tooltipTimeFormat: 'smart_date',
      y_axis_format: 'SMART_NUMBER',
    };
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
    });
    cy.get(exploreView.controlPanel.runButton).should('be.visible', {
      timeout: 10000,
    });
    cy.get(exploreView.controlPanel.saveQuery).click();
    cy.get(exploreView.saveModal.modal).within(() => {
      cy.get(exploreView.saveModal.chartNameInput).type(
        `${testItems.chart}{enter}`,
      );
      cy.get(exploreView.saveModal.dashboardNameInput).type(
        `${testItems.dashboard}{enter}`,
        { delay: 100, force: true },
      );
      cy.get(exploreView.saveModal.saveAndGoToDashboard).click();
    });

    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .click({ force: true });
    cy.get('[label="Time grain"]').click();
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click()
      .clear()
      .type('time grain');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .click()
      .type('wb_health_population');
    cy.get(nativeFilters.silentLoading).should('not.exist');
    cy.get('[label="wb_health_population"]').click();
    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
    cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
    cy.get(nativeFilters.modal.container).should('not.exist');
    cy.get(nativeFilters.filterFromDashboardView.filterValueInput)
      .should('be.visible', { timeout: 10000 })
      .click()
      .type('Month{enter}');
    cy.get(nativeFilters.applyFilter).click();
    cy.wait('@chart');
    cy.url().then(u => {
      const ur = new URL(u);
      expect(ur.search).to.include('native_filters');
    });
    cy.get(nativeFilters.filterFromDashboardView.filterName)
      .contains('time grain')
      .should('be.visible');
    cy.get(nativeFilters.filterFromDashboardView.filterContent)
      .contains('Month')
      .should('be.visible');
  });
  it('User can create a time column filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .click({ force: true });
    cy.get('[label="Time column"]').click({ force: true });
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ force: true })
      .clear()
      .type('time column');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.datasetName)
      .click()
      .type('wb_health_population');
    cy.get(nativeFilters.silentLoading).should('not.exist');
    cy.get('[label="wb_health_population"]').click();

    cy.get(nativeFilters.modal.footer)
      .contains('Save')
      .should('be.visible')
      .click();
    cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
    cy.get(nativeFilters.modal.container).should('not.exist');
    // assert that native filter is created
    cy.get(nativeFilters.filterFromDashboardView.filterName)
      .should('be.visible')
      .contains('time column');
    cy.get(nativeFilters.filterFromDashboardView.filterValueInput)
      .should('be.visible', { timeout: 10000 })
      .click()
      .type('year{enter}');
    cy.get(nativeFilters.applyFilter).click({ force: true });
    cy.wait('@chart');
    cy.get(nativeFilters.filterFromDashboardView.filterContent)
      .contains('year')
      .should('be.visible');
  });
  it('User can create a value filter', () => {
    cy.get(nativeFilters.filterFromDashboardView.expand).click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton)
      .should('be.visible')
      .click();
    cy.get(nativeFilters.modal.container).should('be.visible');
    cy.get('body').type('{home}');

    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .click({ scrollBehavior: false })
      .type('{home}Value{enter}', { scrollBehavior: false });
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .should('have.text', 'Value');
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .click({ scrollBehavior: false })
      .clear()
      .type('country_name', { scrollBehavior: false });

    cy.get(nativeFilters.silentLoading).should('not.exist');
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .should('be.visible')
      .click({ force: true });
    cy.get(nativeFilters.filtersPanel.filterInfoInput)
      .last()
      .type('country_name {enter}');
    cy.get(nativeFilters.modal.footer)
      .find(nativeFilters.modal.saveButton)
      .should('be.visible')
      .click({ force: true });
    cy.get(nativeFilters.filterFromDashboardView.filterName)
      .should('be.visible', { timeout: 40000 })
      .contains('country_name');
  });
});

xdescribe('Nativefilters', () => {
  before(() => {
    cy.login();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="new-dropdown"]').click();
    cy.get('[data-test="menu-item-Dashboard"]').click({ force: true });
    cy.get('[data-test="editable-title-input"]')
      .click()
      .clear()
      .type(`${dashboard}{enter}`);
    cy.get('[data-test="header-save-button"]').click();
    cy.visit(CHART_LIST);
    cy.get('[data-test="search-input"]').type('Treemap{enter}');
    cy.get('[data-test="Treemap-list-chart-title"]')
      .should('be.visible', { timeout: 5000 })
      .click();
    cy.get('[data-test="query-save-button"]').click();
    cy.get('[data-test="save-chart-modal-select-dashboard-form"]')
      .find('input[aria-label="Select a dashboard"]')
      .type(`${dashboard}`, { force: true });
    cy.get('[data-test="btn-modal-save"]').click();
  });
  beforeEach(() => {
    cy.login();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="search-input"]').click().type(`${dashboard}{enter}`);
    cy.contains('[data-test="cell-text"]', `${dashboard}`).click();
  });

  it('should show filter bar and allow user to create filters ', () => {
    cy.get('[data-test="filter-bar"]').should('be.visible');
    cy.get('[data-test="filter-bar__expand-button"]').click();
    cy.get('[data-test="filter-bar__create-filter"]').click();
    cy.get('.ant-modal').should('be.visible');

    cy.get('.ant-modal')
      .find('[data-test="filters-config-modal__name-input"]')
      .click()
      .type('Country name');

    cy.get('.ant-modal')
      .find('[data-test="filters-config-modal__datasource-input"]')
      .click()
      .type('wb_health_population');

    cy.get(
      '.ant-modal [data-test="filters-config-modal__datasource-input"] .Select__menu',
    )
      .contains('wb_health_population')
      .click();

    // hack for unclickable country_name
    cy.get('.ant-modal').find('[data-test="field-input"]').type('country_name');
    cy.get('.ant-modal')
      .find('[data-test="field-input"]')
      .type('{downarrow}{downarrow}{enter}');
    cy.get('[data-test="apply-changes-instantly-checkbox"]').check();
    cy.get('.ant-modal-footer')
      .find('[data-test="native-filter-modal-save-button"]')
      .should('be.visible')
      .click();
  });

  it('should show newly added filter in filter bar menu', () => {
    cy.get('[data-test="filter-bar"]').should('be.visible');
    cy.get('[data-test="filter-control-name"]').should('be.visible');
    cy.get('[data-test="form-item-value"]').should('be.visible');
  });
  it('should filter dashboard with selected filter value', () => {
    cy.get('[data-test="form-item-value"]').should('be.visible').click();
    cy.get('.ant-select-selection-search').type('Hong Kong{enter}');
    cy.get('[data-test="filter-bar__apply-button"]').click();
    cy.get('.treemap').within(() => {
      cy.contains('HKG').should('be.visible');
      cy.contains('USA').should('not.exist');
    });
  });
  xit('default value is respected after revisit', () => {
    cy.get('[data-test="filter-bar__create-filter"]').click();
    cy.get('.ant-modal').should('be.visible');
    // TODO: replace with proper wait for filter to finish loading
    cy.wait(1000);
    cy.get('[data-test="default-input"]').click();
    cy.get('.ant-modal')
      .find('[data-test="default-input"]')
      .type('Sweden{enter}');
    cy.get('[data-test="native-filter-modal-save-button"]')
      .should('be.visible')
      .click();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="search-input"]').click().type(`${dashboard}{enter}`);
    cy.contains('[data-test="cell-text"]', `${dashboard}`).click();
    cy.get('.treemap').within(() => {
      cy.contains('SWE').should('be.visible');
      cy.contains('USA').should('not.exist');
    });
    cy.contains('Sweden');
  });
  it('should allow for deleted filter restore', () => {
    cy.get('[data-test="filter-bar__create-filter"]').click();
    cy.get('.ant-modal').should('be.visible');
    cy.get('.ant-tabs-nav-list').within(() => {
      cy.get('.ant-tabs-tab-remove').click();
    });

    cy.get('[data-test="undo-button"]').should('be.visible').click();
    cy.get('.ant-tabs-nav-list').within(() => {
      cy.get('.ant-tabs-tab-remove').click();
    });
    cy.get('[data-test="restore-filter-button"]').should('be.visible').click();
  });

  it('should stop filtering when filter is removed', () => {
    cy.get('[data-test="filter-bar__create-filter"]').click();
    cy.get('.ant-modal').should('be.visible');
    cy.get('.ant-tabs-nav-list').within(() => {
      cy.get('.ant-tabs-tab-remove').click();
    });
    cy.get('.ant-modal-footer')
      .find('[data-test="native-filter-modal-save-button"]')
      .should('be.visible')
      .click();
    cy.get('.treemap').within(() => {
      cy.contains('HKG').should('be.visible');
      cy.contains('USA').should('be.visible');
    });
  });
  describe('Parent Filters', () => {
    it('should allow for creating parent filters ', () => {
      cy.get('[data-test="filter-bar"]').should('be.visible');
      cy.get('[data-test="filter-bar__expand-button"]').click();
      cy.get('[data-test="filter-bar__create-filter"]').click();
      cy.get('.ant-modal').should('be.visible');

      cy.get('.ant-modal')
        .find('[data-test="filters-config-modal__name-input"]')
        .click()
        .type('Country name');

      cy.get('.ant-modal')
        .find('[data-test="filters-config-modal__datasource-input"]')
        .click()
        .type('wb_health_population');

      cy.get(
        '.ant-modal [data-test="filters-config-modal__datasource-input"] .Select__menu',
      )
        .contains('wb_health_population')
        .click();

      // hack for unclickable country_name
      cy.get('.ant-modal')
        .find('[data-test="field-input"]')
        .type('country_name');
      cy.get('.ant-modal')
        .find('[data-test="field-input"]')
        .type('{downarrow}{downarrow}{enter}');
      cy.get('[data-test="apply-changes-instantly-checkbox"]').check();
      cy.get('.ant-modal-footer')
        .find('[data-test="native-filter-modal-save-button"]')
        .should('be.visible')
        .click();

      cy.get('[data-test="filter-bar__create-filter"]').click();
      cy.get('.ant-modal').first().should('be.visible');
      cy.get('[data-test=add-filter-button]').first().click();

      cy.get('.ant-modal')
        .find('[data-test="filters-config-modal__name-input"]')
        .last()
        .click()
        .type('Region Name');

      cy.get('.ant-modal')
        .find('[data-test="filters-config-modal__datasource-input"]')
        .last()
        .click()
        .type('wb_health_population');

      cy.get(
        '.ant-modal [data-test="filters-config-modal__datasource-input"] .Select__menu',
      )
        .last()
        .contains('wb_health_population')
        .click();

      // hack for unclickable country_name
      cy.get('.ant-modal')
        .find('[data-test="field-input"]')
        .last()
        .type('region');
      cy.get('.ant-modal')
        .find('[data-test="field-input"]')
        .last()
        .type('{downarrow}{downarrow}{downarrow}{downarrow}{enter}');

      cy.get('[data-test="apply-changes-instantly-checkbox"]').last().check();
      cy.get('.ant-modal')
        .find('[data-test="parent-filter-input"]')
        .last()
        .type('{downarrow}{enter}');

      cy.get('.ant-modal-footer')
        .find('[data-test="native-filter-modal-save-button"]')
        .first()
        .should('be.visible')
        .click();
      cy.get('[data-test="filter-icon"]').should('be.visible');
    });
    xit('should parent filter be working', () => {
      cy.get('.treemap').within(() => {
        cy.contains('SMR').should('be.visible');
        cy.contains('Europe & Central Asia').should('be.visible');
        cy.contains('South Asia').should('be.visible');
      });

      cy.get('[data-test="form-item-value"]').should('be.visible').click();
      cy.get('.ant-popover-inner-content').within(() => {
        cy.get('[data-test="form-item-value"]')
          .should('be.visible')
          .first()
          .type('San Marino{enter}');
        cy.get('[data-test="form-item-value"]')
          .should('be.visible')
          .last()
          .type('Europe & Central Asia{enter}');
      });
      cy.get('.treemap').within(() => {
        cy.contains('SMR').should('be.visible');
        cy.contains('Europe & Central Asia').should('be.visible');
        cy.contains('South Asia').should('not.exist');
      });
    });

    it('should stop filtering when parent filter is removed', () => {
      cy.get('[data-test="filter-bar__create-filter"]').click();
      cy.get('.ant-modal').should('be.visible');
      cy.get('.ant-tabs-nav-list').within(() => {
        cy.get('.ant-tabs-tab-remove').click({ multiple: true });
      });
      cy.get('.ant-modal-footer')
        .find('[data-test="native-filter-modal-save-button"]')
        .should('be.visible')
        .click();
      cy.get('.treemap').within(() => {
        cy.contains('HKG').should('be.visible');
        cy.contains('USA').should('be.visible');
      });
    });
  });
});
