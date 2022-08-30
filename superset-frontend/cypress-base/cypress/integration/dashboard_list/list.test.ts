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
import { DASHBOARD_LIST } from 'cypress/utils/urls';

function refresh() {
  cy.loginGoTo(DASHBOARD_LIST);
}

function revertChanges() {
  cy.deleteDashboardByName('0 - Sample dashboard');
  cy.deleteDashboardByName('1 - Sample dashboard');
  cy.deleteDashboardByName('0 - Sample dashboard | EDITED');
}

function ensureAuth() {
  cy.login();
}

function toggleBulkSelect() {
  cy.getBySel("bulk-select").click();
}

function setGridMode(type: 'card' | 'list') {
  cy.get(`[aria-label="${type}-view"]`).click();
}

function orderAlphabetical() {
  cy.get('[aria-label="Sort"]').first().click();
  cy.get('[title="Alphabetical"]').click();
}

describe('Dashboards list', () => {
  beforeEach(() => {
    ensureAuth();
    revertChanges();
  });

  describe('list mode', () => {
    before(() => {
      refresh()
      setGridMode('list');
    });

    it('should load rows in list mode', () => {
      cy.getBySel("listview-table").should('be.visible');
      cy.getBySel("sort-header").eq(1).contains('Title');
      cy.getBySel("sort-header").eq(2).contains('Modified by');
      cy.getBySel("sort-header").eq(3).contains('Status');
      cy.getBySel("sort-header").eq(4).contains('Modified');
      cy.getBySel("sort-header").eq(5).contains('Created by');
      cy.getBySel("sort-header").eq(6).contains('Owners');
      cy.getBySel("sort-header").eq(7).contains('Actions');
    });

    it('should sort correctly in list mode', () => {
      cy.getBySel("sort-header").eq(1).click();
      cy.getBySel("table-row").first()
        .contains("ECharts Dashboard");
      cy.getBySel("sort-header").eq(1).click();
      cy.getBySel("table-row").first()
        .contains("World Bank's Data");
      cy.getBySel("sort-header").eq(1).click();
    });

    it('should bulk select in list mode', () => {
      toggleBulkSelect();
      cy.get('#header-toggle-all').click();
      cy.get('[aria-label="checkbox-on"]').should('have.length', 6);
      cy.getBySel("bulk-select-copy").contains('5 Selected');
      cy.getBySel("bulk-select-action").should('have.length', 2).then($btns => {
        expect($btns).to.contain('Delete');
        expect($btns).to.contain('Export');
      });
      cy.getBySel("bulk-select-deselect-all").click();
      cy.get('[aria-label="checkbox-on"]').should('have.length', 0);
      cy.getBySel("bulk-select-copy").contains('0 Selected');
      cy.getBySel("bulk-select-action").should('not.exist');
    });
  });

  describe('card mode', () => {
    before(() => {
      refresh();
      setGridMode('card');
    });

    it('should load rows in card mode', () => {
      cy.getBySel("listview-table").should('not.exist');
      cy.getBySel("styled-card").should('have.length', 5);
    });

    it('should bulk select in card mode', () => {
      toggleBulkSelect();
      cy.getBySel("styled-card").click({multiple: true});
      cy.getBySel("bulk-select-copy").contains('5 Selected');
      cy.getBySel("bulk-select-action").should('have.length', 2).then($btns => {
        expect($btns).to.contain('Delete');
        expect($btns).to.contain('Export');
      });
      cy.getBySel("bulk-select-deselect-all").click();
      cy.getBySel("bulk-select-copy").contains('0 Selected');
      cy.getBySel("bulk-select-action").should('not.exist');
    });

    it('should sort in card mode', () => {
      orderAlphabetical();
      cy.getBySel("styled-card").first().contains('ECharts Dashboard');
    });
  });

  describe('common actions', () => {
    beforeEach(() => {
      cy.createDashboard('0 - Sample dashboard');
      cy.createDashboard('1 - Sample dashboard');
      refresh();
      setGridMode('card');
      orderAlphabetical();
    });

    it('should allow to favorite/unfavorite dashboard', () => {
      cy.intercept(`/superset/favstar/Dashboard/*/select/`).as('select');
      cy.intercept(`/superset/favstar/Dashboard/*/unselect/`).as('unselect');

      cy.getBySel('styled-card').first().contains('0 - Sample dashboard')
      cy.getBySel('styled-card').first().find("[aria-label='favorite-unselected']")
        .click();
      cy.wait('@select');
      cy.getBySel('styled-card').first().find("[aria-label='favorite-selected']")
        .click();
      cy.wait('@unselect');
      cy.getBySel('styled-card')
        .first()
        .find("[aria-label='favorite-selected']")
        .should('not.exist');
    });

    it('should bulk delete correctly', () => {
      toggleBulkSelect();

      cy.getBySel("styled-card").eq(0).contains('0 - Sample dashboard').click();
      cy.getBySel("styled-card").eq(1).contains('1 - Sample dashboard').click();
      cy.getBySel("bulk-select-action").eq(0).contains('Delete').click();
      cy.getBySel('delete-modal-input').type('DELETE');
      cy.getBySel('modal-confirm-button').click();
      cy.getBySel("styled-card").eq(0).should('not.contain', '0 - Sample dashboard');
      cy.getBySel("styled-card").eq(1).should('not.contain', '1 - Sample dashboard');

    });

   it('should delete correctly', () => {
      cy.getBySel("styled-card").eq(0).contains('0 - Sample dashboard');
      cy.get('[aria-label="more-vert"]').first().click();
      cy.getBySel('dashboard-card-option-delete-button').click();
      cy.getBySel('delete-modal-input').type('DELETE');
      cy.getBySel('modal-confirm-button').click();
      cy.getBySel("styled-card").eq(0).should('not.contain', '0 - Sample dashboard');
    });

    it('should edit correctly', () => {
      cy.getBySel("styled-card").eq(0).contains('0 - Sample dashboard');
      cy.get('[aria-label="more-vert"]').first().click();
      cy.getBySel('dashboard-card-option-edit-button').click();
      cy.getBySel('dashboard-title-input').type(' | EDITED');
      cy.get('button:contains("Save")').click();
      cy.getBySel("styled-card").eq(0).contains('0 - Sample dashboard | EDITED');
    });
  });
});
