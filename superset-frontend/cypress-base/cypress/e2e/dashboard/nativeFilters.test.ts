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
import { SAMPLE_DASHBOARD_1 } from 'cypress/utils/urls';

import {
  addCountryNameFilter,
  addParentFilterWithValue,
  applyAdvancedTimeRangeFilterOnDashboard,
  applyNativeFilterValueWithIndex,
  cancelNativeFilterSettings,
  checkNativeFilterTooltip,
  clickOnAddFilterInModal,
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
  testItems,
  WORLD_HEALTH_CHARTS,
  interceptGet,
  interceptCharts,
  interceptDatasets,
  interceptFilterState,
} from './utils';

const SAMPLE_CHART = { name: 'Most Populated Countries', viz: 'table' };

function visitDashboard(createSample = true) {
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

function prepareDashboardFilters(
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
        shared_label_colors: {},
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

function selectFilter(index: number) {
  cy.get("[data-test='filter-title-container'] [draggable='true']")
    .eq(index)
    .click();
}

function closeFilterModal() {
  cy.get('body').then($body => {
    if ($body.find('[data-test="native-filter-modal-cancel-button"]').length) {
      cy.getBySel('native-filter-modal-cancel-button').click();
    }
  });
}

function openVerticalFilterBar() {
  cy.getBySel('dashboard-filters-panel').should('exist');
  cy.getBySel('filter-bar__expand-button').click();
}

function setFilterBarOrientation(orientation: 'vertical' | 'horizontal') {
  cy.getBySel('filterbar-orientation-icon').click();
  cy.wait(250);
  cy.getBySel('dropdown-selectable-icon-submenu')
    .contains('Orientation of filter bar')
    .should('exist')
    .trigger('mouseover');

  if (orientation === 'vertical') {
    cy.get('.ant-dropdown-menu-item-selected')
      .contains('Horizontal (Top)')
      .should('exist');
    cy.get('.ant-dropdown-menu-item').contains('Vertical (Left)').click();
    cy.getBySel('dashboard-filters-panel').should('exist');
  } else {
    cy.get('.ant-dropdown-menu-item-selected')
      .contains('Vertical (Left)')
      .should('exist');
    cy.get('.ant-dropdown-menu-item').contains('Horizontal (Top)').click();
    cy.getBySel('loading-indicator').should('exist');
    cy.getBySel('filter-bar').should('exist');
    cy.getBySel('dashboard-filters-panel').should('not.exist');
  }
}

function openMoreFilters(intercetFilterState = true) {
  interceptFilterState();
  cy.getBySel('dropdown-container-btn').click();

  if (intercetFilterState) {
    cy.wait('@postFilterState');
  }
}

describe('Horizontal FilterBar', () => {
  it('should go from vertical to horizontal and the opposite', () => {
    visitDashboard();
    openVerticalFilterBar();
    setFilterBarOrientation('horizontal');
    setFilterBarOrientation('vertical');
  });

  it('should show all default actions in horizontal mode', () => {
    visitDashboard();
    openVerticalFilterBar();
    setFilterBarOrientation('horizontal');
    cy.getBySel('horizontal-filterbar-empty')
      .contains('No filters are currently added to this dashboard.')
      .should('exist');
    cy.getBySel('filter-bar__create-filter').should('exist');
    cy.getBySel('filterbar-action-buttons').should('exist');
  });

  it('should stay in horizontal mode when reloading', () => {
    visitDashboard();
    openVerticalFilterBar();
    setFilterBarOrientation('horizontal');
    cy.reload();
    cy.getBySel('dashboard-filters-panel').should('not.exist');
  });

  it('should show all filters in available space on load', () => {
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
      { name: 'test_2', column: 'country_code', datasetId: 2 },
      { name: 'test_3', column: 'region', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');
    cy.get('.filter-item-wrapper').should('have.length', 3);
  });

  it('should show "more filters" on window resizing up and down', () => {
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
      { name: 'test_2', column: 'country_code', datasetId: 2 },
      { name: 'test_3', column: 'region', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');

    cy.getBySel('form-item-value').should('have.length', 3);
    cy.viewport(768, 1024);
    cy.getBySel('form-item-value').should('have.length', 0);
    openMoreFilters(false);
    cy.getBySel('form-item-value').should('have.length', 3);

    cy.getBySel('filter-bar').click();
    cy.viewport(1000, 1024);
    openMoreFilters(false);
    cy.getBySel('form-item-value').should('have.length', 3);

    cy.getBySel('filter-bar').click();
    cy.viewport(1300, 1024);
    cy.getBySel('form-item-value').should('have.length', 3);
    cy.getBySel('dropdown-container-btn').should('not.exist');
  });

  it('should show "more filters" and scroll', () => {
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
      { name: 'test_2', column: 'country_code', datasetId: 2 },
      { name: 'test_3', column: 'region', datasetId: 2 },
      { name: 'test_4', column: 'year', datasetId: 2 },
      { name: 'test_5', column: 'country_name', datasetId: 2 },
      { name: 'test_6', column: 'country_code', datasetId: 2 },
      { name: 'test_7', column: 'region', datasetId: 2 },
      { name: 'test_8', column: 'year', datasetId: 2 },
      { name: 'test_9', column: 'country_name', datasetId: 2 },
      { name: 'test_10', column: 'country_code', datasetId: 2 },
      { name: 'test_11', column: 'region', datasetId: 2 },
      { name: 'test_12', column: 'year', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');
    cy.get('.filter-item-wrapper').should('have.length', 3);
    openMoreFilters();
    cy.getBySel('form-item-value').should('have.length', 12);
    cy.getBySel('filter-control-name').contains('test_10').should('be.visible');
    cy.getBySel('filter-control-name')
      .contains('test_12')
      .should('not.be.visible');
    cy.get('.ant-popover-inner-content').scrollTo('bottom');
    cy.getBySel('filter-control-name').contains('test_12').should('be.visible');
  });

  it('should display newly added filter', () => {
    visitDashboard();
    openVerticalFilterBar();
    setFilterBarOrientation('horizontal');

    enterNativeFilterEditModal(false);
    addCountryNameFilter();
    saveNativeFilterSettings([]);
    validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
  });

  it('should spot changes in "more filters" and apply their values', () => {
    cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
      { name: 'test_2', column: 'country_code', datasetId: 2 },
      { name: 'test_3', column: 'region', datasetId: 2 },
      { name: 'test_4', column: 'year', datasetId: 2 },
      { name: 'test_5', column: 'country_name', datasetId: 2 },
      { name: 'test_6', column: 'country_code', datasetId: 2 },
      { name: 'test_7', column: 'region', datasetId: 2 },
      { name: 'test_8', column: 'year', datasetId: 2 },
      { name: 'test_9', column: 'country_name', datasetId: 2 },
      { name: 'test_10', column: 'country_code', datasetId: 2 },
      { name: 'test_11', column: 'region', datasetId: 2 },
      { name: 'test_12', column: 'year', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');
    openMoreFilters();
    applyNativeFilterValueWithIndex(8, testItems.filterDefaultValue);
    cy.get(nativeFilters.applyFilter).click({ force: true });
    cy.wait('@chart');
    cy.get('.antd5-scroll-number.antd5-badge-count').should(
      'have.attr',
      'title',
      '1',
    );
  });

  it('should focus filter and open "more filters" programmatically', () => {
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
      { name: 'test_2', column: 'country_code', datasetId: 2 },
      { name: 'test_3', column: 'region', datasetId: 2 },
      { name: 'test_4', column: 'year', datasetId: 2 },
      { name: 'test_5', column: 'country_name', datasetId: 2 },
      { name: 'test_6', column: 'country_code', datasetId: 2 },
      { name: 'test_7', column: 'region', datasetId: 2 },
      { name: 'test_8', column: 'year', datasetId: 2 },
      { name: 'test_9', column: 'country_name', datasetId: 2 },
      { name: 'test_10', column: 'country_code', datasetId: 2 },
      { name: 'test_11', column: 'region', datasetId: 2 },
      { name: 'test_12', column: 'year', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');
    openMoreFilters();
    applyNativeFilterValueWithIndex(8, testItems.filterDefaultValue);
    cy.get(nativeFilters.applyFilter).click({ force: true });
    cy.getBySel('slice-header').within(() => {
      cy.get('.filter-counts').trigger('mouseover');
    });
    cy.get('.filterStatusPopover').contains('test_9').click();
    cy.getBySel('dropdown-content').should('be.visible');
    cy.get('.ant-select-focused').should('be.visible');
  });

  it('should show tag count and one plain tag on focus and only count on blur in select ', () => {
    prepareDashboardFilters([
      { name: 'test_1', column: 'country_name', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');
    enterNativeFilterEditModal();
    inputNativeFilterDefaultValue('Albania');
    cy.get('.ant-select-selection-search-input').clear({ force: true });
    inputNativeFilterDefaultValue('Algeria', true);
    saveNativeFilterSettings([SAMPLE_CHART]);
    cy.getBySel('filter-bar').within(() => {
      cy.get(nativeFilters.filterItem).contains('Albania').should('be.visible');
      cy.get(nativeFilters.filterItem).contains('+ 1 ...').should('be.visible');
      cy.get('.ant-select-selection-search-input').click();
      cy.get(nativeFilters.filterItem).contains('+ 2 ...').should('be.visible');
    });
  });
});

describe('Native filters', () => {
  describe('Nativefilters tests initial state required', () => {
    beforeEach(() => {
      cy.createSampleDashboards([0]);
    });

    it('Verify that default value is respected after revisit', () => {
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      inputNativeFilterDefaultValue(testItems.filterDefaultValue);
      saveNativeFilterSettings([SAMPLE_CHART]);
      cy.get(nativeFilters.filterItem)
        .contains(testItems.filterDefaultValue)
        .should('be.visible');
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('not.exist');
      });

      // reload dashboard
      cy.reload();
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('not.exist');
      });
      validateFilterContentOnDashboard(testItems.filterDefaultValue);
    });

    it('User can create parent filters using "Values are dependent on other filters"', () => {
      prepareDashboardFilters([
        { name: 'region', column: 'region', datasetId: 2 },
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      selectFilter(1);
      cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
        () => {
          cy.contains('Values are dependent on other filters')
            .should('be.visible')
            .click();
        },
      );
      addParentFilterWithValue(0, testItems.topTenChart.filterColumnRegion);
      saveNativeFilterSettings([SAMPLE_CHART]);
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
      prepareDashboardFilters([
        { name: 'region', column: 'region', datasetId: 2 },
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      selectFilter(1);
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
      prepareDashboardFilters([
        { name: 'region', column: 'region', datasetId: 2 },
        { name: 'country_name', column: 'country_name', datasetId: 2 },
        { name: 'country_code', column: 'country_code', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      selectFilter(2);
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
      saveNativeFilterSettings([SAMPLE_CHART]);
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
      prepareDashboardFilters([
        { name: 'region', column: 'region', datasetId: 2 },
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      selectFilter(1);
      // Select dependdent option and auto use platform for genre
      cy.get(nativeFilters.filterConfigurationSections.displayedSection).within(
        () => {
          cy.contains('Values are dependent on other filters')
            .should('be.visible')
            .click();
        },
      );
      saveNativeFilterSettings([SAMPLE_CHART]);
      enterNativeFilterEditModal(false);
      cy.get(nativeFilters.modal.tabsList.removeTab)
        .should('be.visible')
        .first()
        .click({
          force: true,
        });
      saveNativeFilterSettings([SAMPLE_CHART]);
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('be.visible');
      });
    });
  });

  describe('Nativefilters basic interactions', () => {
    before(() => {
      visitDashboard();
    });

    beforeEach(() => {
      cy.createSampleDashboards([0]);
      closeFilterModal();
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
      enterNativeFilterEditModal(false);
    });

    it('User can delete a native filter', () => {
      enterNativeFilterEditModal(false);
      cy.get(nativeFilters.filtersList.removeIcon).first().click();
      cy.contains('Restore Filter').should('not.exist', { timeout: 10000 });
    });

    it('User can cancel creating a new filter', () => {
      enterNativeFilterEditModal(false);
      cancelNativeFilterSettings();
    });

    it('Verify setting options and tooltips for value filter', () => {
      enterNativeFilterEditModal(false);
      cy.contains('Filter value is required').should('be.visible').click();
      checkNativeFilterTooltip(0, nativeFilterTooltips.preFilter);
      checkNativeFilterTooltip(1, nativeFilterTooltips.defaultValue);
      cy.get(nativeFilters.modal.container).should('be.visible');
      valueNativeFilterOptions.forEach(el => {
        cy.contains(el);
      });
      cy.contains('Values are dependent on other filters').should('not.exist');
      cy.get(
        nativeFilters.filterConfigurationSections.checkedCheckbox,
      ).contains('Can select multiple values');
      checkNativeFilterTooltip(2, nativeFilterTooltips.required);
      checkNativeFilterTooltip(3, nativeFilterTooltips.defaultToFirstItem);
      checkNativeFilterTooltip(4, nativeFilterTooltips.searchAllFilterOptions);
      checkNativeFilterTooltip(5, nativeFilterTooltips.inverseSelection);
      clickOnAddFilterInModal();
      cy.contains('Values are dependent on other filters').should('exist');
    });
  });

  describe('Nativefilters initial state not required', () => {
    it("User can check 'Filter has default value'", () => {
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      inputNativeFilterDefaultValue(testItems.filterDefaultValue);
    });

    it('User can add a new native filter', () => {
      prepareDashboardFilters([]);

      let filterKey: string;
      const removeFirstChar = (search: string) =>
        search.split('').slice(1, search.length).join('');

      cy.location().then(loc => {
        cy.url().should('contain', 'native_filters_key');
        const queryParams = qs.parse(removeFirstChar(loc.search));
        filterKey = queryParams.native_filters_key as string;
        expect(typeof filterKey).eq('string');
      });
      enterNativeFilterEditModal();
      addCountryNameFilter();
      saveNativeFilterSettings([SAMPLE_CHART]);
      cy.location().then(loc => {
        cy.url().should('contain', 'native_filters_key');
        const queryParams = qs.parse(removeFirstChar(loc.search));
        const newfilterKey = queryParams.native_filters_key;
        expect(newfilterKey).eq(filterKey);
      });
      cy.get(nativeFilters.modal.container).should('not.exist');
    });

    it('User can restore a deleted native filter', () => {
      prepareDashboardFilters([
        { name: 'country_code', column: 'country_code', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      cy.get(nativeFilters.filtersList.removeIcon).first().click();
      cy.get('[data-test="restore-filter-button"]')
        .should('be.visible')
        .click();
      cy.get(nativeFilters.modal.container)
        .find(nativeFilters.filtersPanel.filterName)
        .should(
          'have.attr',
          'value',
          testItems.topTenChart.filterColumnCountryCode,
        );
    });

    it('User can create a time grain filter', () => {
      prepareDashboardFilters([]);
      enterNativeFilterEditModal();
      fillNativeFilterForm(
        testItems.filterType.timeGrain,
        testItems.filterType.timeGrain,
        testItems.datasetForNativeFilter,
      );
      saveNativeFilterSettings([SAMPLE_CHART]);
      applyNativeFilterValueWithIndex(0, testItems.filterTimeGrain);
      cy.get(nativeFilters.applyFilter).click();
      cy.url().then(u => {
        const ur = new URL(u);
        expect(ur.search).to.include('native_filters');
      });
      validateFilterNameOnDashboard(testItems.filterType.timeGrain);
      validateFilterContentOnDashboard(testItems.filterTimeGrain);
    });

    it.skip('User can create a time range filter', () => {
      enterNativeFilterEditModal();
      fillNativeFilterForm(
        testItems.filterType.timeRange,
        testItems.filterType.timeRange,
      );
      saveNativeFilterSettings(WORLD_HEALTH_CHARTS);
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

    it.skip('User can create a time column filter', () => {
      enterNativeFilterEditModal();
      fillNativeFilterForm(
        testItems.filterType.timeColumn,
        testItems.filterType.timeColumn,
        testItems.datasetForNativeFilter,
      );
      saveNativeFilterSettings(WORLD_HEALTH_CHARTS);
      cy.intercept(`/api/v1/chart/data?form_data=**`).as('chart');
      cy.get(nativeFilters.modal.container).should('not.exist');
      // assert that native filter is created
      validateFilterNameOnDashboard(testItems.filterType.timeColumn);
      applyNativeFilterValueWithIndex(
        0,
        testItems.topTenChart.filterColumnYear,
      );
      cy.get(nativeFilters.applyFilter).click({ force: true });
      cy.wait('@chart');
      validateFilterContentOnDashboard(testItems.topTenChart.filterColumnYear);
    });

    it('User can create a numerical range filter', () => {
      visitDashboard();
      enterNativeFilterEditModal(false);
      fillNativeFilterForm(
        testItems.filterType.numerical,
        testItems.filterNumericalColumn,
        testItems.datasetForNativeFilter,
        testItems.filterNumericalColumn,
      );
      saveNativeFilterSettings([]);
      // assertions
      cy.get(nativeFilters.slider.slider).should('be.visible').click('center');
      cy.get(nativeFilters.applyFilter).click();
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
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      undoDeleteNativeFilter();
      cy.get(nativeFilters.modal.container)
        .find(nativeFilters.filtersPanel.filterName)
        .should('have.attr', 'value', testItems.topTenChart.filterColumn);
    });

    it('User can cancel changes in native filter', () => {
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      cy.getBySel('filters-config-modal__name-input').type('|EDITED', {
        force: true,
      });
      cancelNativeFilterSettings();
      enterNativeFilterEditModal(false);
      cy.get(nativeFilters.filtersList.removeIcon).first().click();
      cy.contains('You have removed this filter.').should('be.visible');
    });

    it('User can create a value filter', () => {
      visitDashboard();
      enterNativeFilterEditModal(false);
      addCountryNameFilter();
      cy.get(nativeFilters.filtersPanel.filterTypeInput)
        .find(nativeFilters.filtersPanel.filterTypeItem)
        .should('have.text', testItems.filterType.value);
      saveNativeFilterSettings([]);
      validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
    });

    it('User can apply value filter with selected values', () => {
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      applyNativeFilterValueWithIndex(0, testItems.filterDefaultValue);
      cy.get(nativeFilters.applyFilter).click();
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('not.exist');
      });
    });

    it('User can stop filtering when filter is removed', () => {
      prepareDashboardFilters([
        { name: 'country_name', column: 'country_name', datasetId: 2 },
      ]);
      enterNativeFilterEditModal();
      inputNativeFilterDefaultValue(testItems.filterDefaultValue);
      saveNativeFilterSettings([SAMPLE_CHART]);
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('not.exist');
      });
      cy.get(nativeFilters.filterItem)
        .contains(testItems.filterDefaultValue)
        .should('be.visible');
      validateFilterNameOnDashboard(testItems.topTenChart.filterColumn);
      enterNativeFilterEditModal(false);
      deleteNativeFilter();
      saveNativeFilterSettings([SAMPLE_CHART]);
      cy.get(dataTestChartName(testItems.topTenChart.name)).within(() => {
        cy.contains(testItems.filterDefaultValue).should('be.visible');
        cy.contains(testItems.filterOtherCountry).should('be.visible');
      });
    });
  });
});
