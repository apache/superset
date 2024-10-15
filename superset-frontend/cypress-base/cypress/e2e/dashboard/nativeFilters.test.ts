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
      // Select dependent option and auto use platform for genre
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
});
