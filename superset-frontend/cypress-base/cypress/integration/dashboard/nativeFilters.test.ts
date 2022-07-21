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
  dataTestChartName,
} from 'cypress/support/directories';
import {
  cleanUp,
  copyTestDashboard,
  testItems,
  waitForChartLoad,
  WORLD_HEALTH_DASHBOARD,
  WORLD_HEALTH_CHARTS,
} from './dashboard.helper';
import {
  addCountryCodeFilter,
  addCountryNameFilter,
  addParentFilterWithValue,
  addRegionFilter,
  applyAdvancedTimeRangeFilterOnDashboard,
  applyNativeFilterValueWithIndex,
  cancelNativeFilterSettings,
  checkNativeFilterTooltip,
  clickOnAddFilterInModal,
  closeDashboardToastMessage,
  collapseFilterOnLeftPanel,
  deleteNativeFilter,
  enterNativeFilterEditModal,
  expandFilterOnLeftPanel,
  fillNativeFilterForm,
  getNativeFilterPlaceholderWithIndex,
  inputNativeFilterDefaultValue,
  saveNativeFilterSettings,
  nativeFilterTooltips,
  undoDeleteNativeFilter,
  validateFilterContentOnDashboard,
  valueNativeFilterOptions,
  validateFilterNameOnDashboard,
} from './nativeFilter.helper';
import { DASHBOARD_LIST } from '../dashboard_list/dashboard_list.helper';
import { CHART_LIST } from '../chart_list/chart_list.helper';

// TODO: fix flaky init logic and re-enable
const milliseconds = new Date().getTime();
const dashboard = `Test Dashboard${milliseconds}`;

describe('Nativefilters tests initial state required', () => {
  beforeEach(() => {
    cy.login();
    cleanUp();
    copyTestDashboard("World Bank's Data");
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    closeDashboardToastMessage();
  });
  afterEach(() => {
    cleanUp();
  });

  it('Verify that default value is respected after revisit', () => {
    expandFilterOnLeftPanel();
    enterNativeFilterEditModal();
    addCountryNameFilter();
    inputNativeFilterDefaultValue(testItems.filterDefaultValue);
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.get(nativeFilters.filterItem)
      .contains(testItems.filterDefaultValue)
      .should('be.visible');
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('not.exist');
    });
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
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('not.exist');
    });
    validateFilterContentOnDashboard(testItems.filterDefaultValue);
  });

  it('User can create parent filters using "Values are dependent on other filters"', () => {
    enterNativeFilterEditModal();
    // Create parent filter 'region'.
    addRegionFilter();
    // Create filter 'country_name' depend on region filter.
    clickOnAddFilterInModal();
    addCountryNameFilter();
    cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
      () => {
        cy.contains('Values are dependent on other filters')
          .should('be.visible')
          .click();
      },
    );
    addParentFilterWithValue(0, testItems.topTenChart.filterColumnRegion);
    cy.wait(1000);
    saveNativeFilterSettings();
    // Validate both filter in dashboard view.
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    [
      testItems.topTenChart.filterColumnRegion,
      testItems.topTenChart.filterColumn,
    ].forEach(it => {
      cy.get(nativeFilters.filterFromDashboardView.filterName)
        .contains(it)
        .should('be.visible');
    });
    getNativeFilterPlaceholderWithIndex(1)
      .invoke('text')
      .should('equal', '214 options', { timeout: 20000 });
    // apply first filter value and validate 2nd filter is depden on 1st filter.
    applyNativeFilterValueWithIndex(0, 'North America');
    getNativeFilterPlaceholderWithIndex(0).should('have.text', '3 options', {
      timeout: 20000,
    });
  });

  it('user can delete dependent filter', () => {
    enterNativeFilterEditModal();
    addRegionFilter();
    clickOnAddFilterInModal();
    addCountryNameFilter();
    cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
      () => {
        cy.contains('Values are dependent on other filters')
          .should('be.visible')
          .click();
      },
    );
    addParentFilterWithValue(0, testItems.topTenChart.filterColumnRegion);
    // remove year native filter to cause it disappears from parent filter input in global sales
    cy.get(nativeFilters.modal.tabsList.removeTab)
      .should('be.visible')
      .first()
      .click();
    // make sure you are seeing global sales filter which had parent filter
    cy.get(nativeFilters.modal.tabsList.filterItemsContainer)
      .children()
      .last()
      .click();
    //
    cy.wait(1000);
    cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
      () => {
        cy.contains('Values are dependent on other filters').should(
          'not.exist',
        );
      },
    );
  });

  it('User can create filter depend on 2 other filters', () => {
    enterNativeFilterEditModal();
    // add first filter
    addRegionFilter();
    // add second filter
    clickOnAddFilterInModal();
    addCountryNameFilter();
    // add third filter
    clickOnAddFilterInModal();
    addCountryCodeFilter();
    cy.wait(1000);
    cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
      () => {
        cy.contains('Values are dependent on other filters')
          .should('be.visible')
          .click();
        cy.get(exploreView.controlPanel.addFieldValue).click();
      },
    );
    // add value to the first input
    addParentFilterWithValue(0, testItems.topTenChart.filterColumnRegion);
    // add value to the second input
    addParentFilterWithValue(1, testItems.topTenChart.filterColumn);
    saveNativeFilterSettings();
    // wait for charts load
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    // filters should be displayed in the left panel
    [
      testItems.topTenChart.filterColumnRegion,
      testItems.topTenChart.filterColumn,
      testItems.topTenChart.filterColumnCountryCode,
    ].forEach(it => {
      validateFilterNameOnDashboard(it);
    });

    // initially first filter shows 39 options
    getNativeFilterPlaceholderWithIndex(0).should('have.text', '7 options');
    // initially second filter shows 409 options
    getNativeFilterPlaceholderWithIndex(1).should('have.text', '214 options');
    // verify third filter shows 409 options
    getNativeFilterPlaceholderWithIndex(2).should('have.text', '214 options');

    // apply first filter value
    applyNativeFilterValueWithIndex(0, 'North America');

    // verify second filter shows 409 options available still
    getNativeFilterPlaceholderWithIndex(0).should('have.text', '214 options');

    // verify second filter shows 69 options available still
    getNativeFilterPlaceholderWithIndex(1).should('have.text', '3 options');

    // apply second filter value
    applyNativeFilterValueWithIndex(1, 'United States');

    // verify number of available options for third filter - should be decreased to only one
    getNativeFilterPlaceholderWithIndex(0).should('have.text', '1 option');
  });

  it('User can remove parent filters', () => {
    enterNativeFilterEditModal();
    addRegionFilter();
    clickOnAddFilterInModal();
    addCountryNameFilter();
    cy.wait(1000);
    // Select dependdent option and auto use platform for genre
    cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
      () => {
        cy.contains('Values are dependent on other filters')
          .should('be.visible')
          .click();
      },
    );
    saveNativeFilterSettings();
    enterNativeFilterEditModal();
    cy.get(nativeFilters.modal.tabsList.removeTab)
      .should('be.visible')
      .first()
      .click({
        force: true,
      });
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('be.visible');
    });
  });
});

describe('Nativefilters initial state not required', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
  });

  after(() => {
    enterNativeFilterEditModal();
    deleteNativeFilter();
  });

  it('User can expand / retract native filter sidebar on a dashboard', () => {
    cy.get(nativeFilters.addFilterButton.button).should('not.exist');
    expandFilterOnLeftPanel();
    cy.get(nativeFilters.filterFromDashboardView.createFilterButton).should(
      'be.visible',
    );
    cy.get(nativeFilters.filterFromDashboardView.expand).should(
      'not.be.visible',
    );
    collapseFilterOnLeftPanel();
  });

  it('User can enter filter edit pop-up by clicking on native filter edit icon', () => {
    enterNativeFilterEditModal();
  });

  it('User can delete a native filter', () => {
    enterNativeFilterEditModal();
    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.contains('Restore Filter').should('not.exist', { timeout: 10000 });
    saveNativeFilterSettings();
  });

  it('User can cancel creating a new filter', () => {
    enterNativeFilterEditModal();
    cancelNativeFilterSettings();
  });

  it('Verify setting options and tooltips for value filter', () => {
    enterNativeFilterEditModal();
    cy.contains('Filter value is required').should('be.visible').click();
    checkNativeFilterTooltip(0, nativeFilterTooltips.defaultValue);
    cy.get(nativeFilters.modal.container).should('be.visible');
    valueNativeFilterOptions.forEach(el => {
      cy.contains(el);
    });
    cy.contains('Values are dependent on other filters').should('not.exist');
    cy.get(nativeFilters.filterConfigurationSections.checkedCheckbox).contains(
      'Can select multiple values',
    );
    checkNativeFilterTooltip(1, nativeFilterTooltips.required);
    checkNativeFilterTooltip(2, nativeFilterTooltips.defaultToFirstItem);
    checkNativeFilterTooltip(3, nativeFilterTooltips.searchAllFilterOptions);
    checkNativeFilterTooltip(4, nativeFilterTooltips.inverseSelection);
    clickOnAddFilterInModal();
    cy.contains('Values are dependent on other filters').should('exist');
  });

  it("User can check 'Filter has default value'", () => {
    enterNativeFilterEditModal();
    addCountryNameFilter();
    inputNativeFilterDefaultValue(testItems.filterDefaultValue);
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
    enterNativeFilterEditModal();
    addCountryNameFilter();
    saveNativeFilterSettings();
    cy.wait(3000);
    cy.location().then(loc => {
      const queryParams = qs.parse(removeFirstChar(loc.search));
      const newfilterKey = queryParams.native_filters_key;
      expect(newfilterKey).eq(filterKey);
    });
    cy.wait(3000);
    cy.get(nativeFilters.modal.container).should('not.exist');
  });

  it('User can undo deleting a native filter', () => {
    enterNativeFilterEditModal();
    addCountryCodeFilter();
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    validateFilterNameOnDashboard(
      testItems.topTenChart.filterColumnCountryCode,
    );
    enterNativeFilterEditModal();
    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.get('[data-test="restore-filter-button"]').should('be.visible').click();
    cy.get(nativeFilters.modal.container)
      .find(nativeFilters.filtersPanel.filterName)
      .should(
        'have.attr',
        'value',
        testItems.topTenChart.filterColumnCountryCode,
      );
  });

  it('User can create a time grain filter', () => {
    enterNativeFilterEditModal();
    fillNativeFilterForm(
      testItems.filterType.timeGrain,
      testItems.filterType.timeGrain,
      testItems.datasetForNativeFilter,
    );
    saveNativeFilterSettings();
    applyNativeFilterValueWithIndex(0, testItems.filterTimeGrain);
    cy.get(nativeFilters.applyFilter).click();
    cy.url().then(u => {
      const ur = new URL(u);
      expect(ur.search).to.include('native_filters');
    });
    validateFilterNameOnDashboard(testItems.filterType.timeGrain);
    validateFilterContentOnDashboard(testItems.filterTimeGrain);
  });

  it('User can create a time range filter', () => {
    enterNativeFilterEditModal();
    fillNativeFilterForm(
      testItems.filterType.timeRange,
      testItems.filterType.timeRange,
    );
    saveNativeFilterSettings();
    cy.get(dashboardView.salesDashboardSpecific.vehicleSalesFilterTimeRange)
      .should('be.visible')
      .click();
    applyAdvancedTimeRangeFilterOnDashboard('2005-12-17', '2006-12-17');
    cy.url().then(u => {
      const ur = new URL(u);
      expect(ur.search).to.include('native_filters');
    });
    validateFilterNameOnDashboard(testItems.filterType.timeRange);
    cy.get(nativeFilters.filterFromDashboardView.timeRangeFilterContent)
      .contains('2005-12-17')
      .should('be.visible');
  });

  it('User can create a time column filter', () => {
    enterNativeFilterEditModal();
    fillNativeFilterForm(
      testItems.filterType.timeColumn,
      testItems.filterType.timeColumn,
      testItems.datasetForNativeFilter,
    );
    saveNativeFilterSettings();
    cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
    cy.get(nativeFilters.modal.container).should('not.exist');
    // assert that native filter is created
    validateFilterNameOnDashboard(testItems.filterType.timeColumn);
    applyNativeFilterValueWithIndex(0, testItems.topTenChart.filterColumnYear);
    cy.get(nativeFilters.applyFilter).click({ force: true });
    cy.wait('@chart');
    validateFilterContentOnDashboard(testItems.topTenChart.filterColumnYear);
  });

  it('User can create a numerical range filter', () => {
    enterNativeFilterEditModal();
    fillNativeFilterForm(
      testItems.filterType.numerical,
      testItems.filterNumericalColumn,
      testItems.datasetForNativeFilter,
      testItems.filterNumericalColumn,
    );
    saveNativeFilterSettings();
    // assertions
    cy.get(nativeFilters.slider.slider).should('be.visible').click('center');
    // cy.get(sqlLabView.tooltip).should('be.visible');
    cy.intercept(`/superset/explore_json/*`).as('slices');
    cy.get(nativeFilters.applyFilter).click();
    cy.wait('@slices');
    // assert that the url contains 'native_filters' in the url
    cy.url().then(u => {
      const ur = new URL(u);
      expect(ur.search).to.include('native_filters');
      // assert that the start handle has a value
      cy.get(nativeFilters.slider.startHandle)
        .invoke('attr', 'aria-valuenow')
        .should('exist');
      // assert that the end handle has a value
      cy.get(nativeFilters.slider.endHandle)
        .invoke('attr', 'aria-valuenow')
        .should('exist');
      // assert slider text matches what we should have
      cy.get(nativeFilters.slider.sliderText).should('have.text', '49');
    });
  });

  it('User can undo deleting a native filter', () => {
    enterNativeFilterEditModal();
    addCountryNameFilter();
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
    enterNativeFilterEditModal();
    undoDeleteNativeFilter();
  });

  it('User can cancel changes in native filter', () => {
    enterNativeFilterEditModal();
    fillNativeFilterForm(
      testItems.filterType.value,
      'suffix',
      testItems.datasetForNativeFilter,
    );
    cancelNativeFilterSettings();
    enterNativeFilterEditModal();
    cy.get(nativeFilters.filtersList.removeIcon).first().click();
    cy.contains('You have removed this filter.').should('be.visible');
    saveNativeFilterSettings();
  });

  it('User can create a value filter', () => {
    enterNativeFilterEditModal();
    addCountryNameFilter();
    cy.get(nativeFilters.filtersPanel.filterTypeInput)
      .find(nativeFilters.filtersPanel.filterTypeItem)
      .should('have.text', testItems.filterType.value);
    saveNativeFilterSettings();
    validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
  });

  it('User can apply value filter with selected values', () => {
    enterNativeFilterEditModal();
    addCountryNameFilter();
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    applyNativeFilterValueWithIndex(0, testItems.filterDefaultValue);
    cy.get(nativeFilters.applyFilter).click();
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('not.exist');
    });
  });

  it('User can stop filtering when filter is removed', () => {
    enterNativeFilterEditModal();
    addCountryNameFilter();
    inputNativeFilterDefaultValue(testItems.filterDefaultValue);
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('not.exist');
    });
    cy.get(nativeFilters.filterItem)
      .contains(testItems.filterDefaultValue)
      .should('be.visible');
    validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
    enterNativeFilterEditModal();
    deleteNativeFilter();
    saveNativeFilterSettings();
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
      cy.contains(testItems.filterDefaultValue).should('be.visible');
      cy.contains(testItems.filterOtherCountry).should('be.visible');
    });
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
