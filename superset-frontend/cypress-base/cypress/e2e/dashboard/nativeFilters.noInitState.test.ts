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
} from './utils';
import {
  prepareDashboardFilters,
  SAMPLE_CHART,
  visitDashboard,
} from './shared_dashboard_functions';

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

describe('Native filters', () => {
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
