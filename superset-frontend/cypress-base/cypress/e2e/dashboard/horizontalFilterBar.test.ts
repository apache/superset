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
  cy.getBySel('dropdown-container-btn').click();

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
