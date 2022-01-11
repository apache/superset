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
import { CHART_LIST } from '../chart_list/chart_list.helper';
import { DASHBOARD_LIST } from '../dashboard_list/dashboard_list.helper';

// TODO: fix flaky init logic and re-enable
const milliseconds = new Date().getTime();
const dashboard = `Test Dashboard${milliseconds}`;
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
