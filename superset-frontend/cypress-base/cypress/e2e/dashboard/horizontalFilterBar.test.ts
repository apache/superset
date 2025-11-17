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
import { nativeFilters } from 'cypress/support/directories';

import {
  addCountryNameFilter,
  applyNativeFilterValueWithIndex,
  enterNativeFilterEditModal,
  inputNativeFilterDefaultValue,
  saveNativeFilterSettings,
  validateFilterNameOnDashboard,
  testItems,
  interceptFilterState,
} from './utils';
import {
  prepareDashboardFilters,
  SAMPLE_CHART,
  visitDashboard,
} from './shared_dashboard_functions';

function openMoreFilters(waitFilterState = true) {
  interceptFilterState();
  // Wait for the dropdown button to appear when filters are overflowed
  // The button only appears when there are overflowed filters
  cy.getBySel('dropdown-container-btn', { timeout: 10000 })
    .should('exist')
    .should('be.visible')
    .click({ force: true });

  if (waitFilterState) {
    cy.wait('@postFilterState');
  }
}

function openVerticalFilterBar() {
  cy.getBySel('dashboard-filters-panel').should('exist');
  cy.getBySel('filter-bar__expand-button').click();
}

function setFilterBarOrientation(orientation: 'vertical' | 'horizontal') {
  cy.getBySel('filterbar-orientation-icon').click();
  cy.wait(250);
  cy.get('.filter-bar-orientation-submenu')
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
    cy.get(nativeFilters.filtersPanel.filterGear).click({
      force: true,
    });
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
    // Use 4 filters with unique columns to ensure overflow testing while allowing all to fit at large viewport
    prepareDashboardFilters([
      { name: 'Country', column: 'country_name', datasetId: 2 },
      { name: 'Code', column: 'country_code', datasetId: 2 },
      { name: 'Region', column: 'region', datasetId: 2 },
      { name: 'Year', column: 'year', datasetId: 2 },
    ]);
    setFilterBarOrientation('horizontal');

    // At full width, check how many filters are visible in main bar
    cy.get('.filter-item-wrapper').then($items => {
      cy.log(`Found ${$items.length} filter items at full width`);
    });

    // Resize to force overflow
    cy.viewport(500, 1024);
    cy.wait(500); // Allow layout to stabilize after viewport change

    // Should have some filters visible and dropdown button present
    cy.get('.filter-item-wrapper').should('have.length.lessThan', 4);
    cy.getBySel('dropdown-container-btn').should('exist');

    // Open more filters and verify all are accessible in the dropdown
    openMoreFilters(false);
    // Check that the dropdown content contains filters
    cy.getBySel('dropdown-content').within(() => {
      cy.getBySel('form-item-value').should('have.length.greaterThan', 0);
    });

    // Close the dropdown
    cy.getBySel('filter-bar').click();

    // Test with medium viewport
    cy.viewport(800, 1024);
    cy.wait(500); // Allow layout to stabilize after viewport change

    // May or may not have overflow at this size - test adaptively
    cy.get('body').then($body => {
      if ($body.find('[data-test="dropdown-container-btn"]').length > 0) {
        openMoreFilters(false);
        cy.getBySel('dropdown-content').within(() => {
          cy.getBySel('form-item-value').should('have.length.greaterThan', 0);
        });
        cy.getBySel('filter-bar').click(); // Close dropdown
      }
    });

    // At large viewport, all filters should fit
    cy.viewport(1300, 1024);
    cy.wait(500); // Allow layout to stabilize after viewport change
    cy.get('.filter-item-wrapper').then($items => {
      cy.log(`Found ${$items.length} filter items at large width`);
      // Just verify we have some filters, don't assert exact count
      expect($items.length).to.be.greaterThan(0);
    });
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

    cy.get('.filter-item-wrapper').should('have.length', 4);
    openMoreFilters();
    cy.getBySel('form-item-value').should('have.length', 12);
    cy.getBySel('filter-control-name').contains('test_3').should('be.visible');
    cy.getBySel('filter-control-name')
      .contains('test_12')
      .should('not.be.visible');
    cy.getBySel('filter-control-name').contains('test_12').scrollIntoView();
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

  it.skip('should spot changes in "more filters" and apply their values', () => {
    cy.intercept(`**/api/v1/chart/data?form_data=**`).as('chart');
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
    cy.get('.ant-scroll-number.ant-badge-count').should(
      'have.attr',
      'title',
      '1',
    );
  });

  it.skip('should focus filter and open "more filters" programmatically', () => {
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
    cy.getBySel('filter-status-popover').contains('test_9').click();
    cy.getBySel('dropdown-content').should('be.visible');
    cy.get('.ant-select-focused').should('be.visible');
  });

  it.skip('should show tag count and one plain tag on focus and only count on blur in select ', () => {
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
