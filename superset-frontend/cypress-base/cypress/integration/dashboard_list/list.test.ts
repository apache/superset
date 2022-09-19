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
import { setGridMode, toggleBulkSelect } from 'cypress/utils';
import {
  setFilter,
  interceptBulkDelete,
  interceptUpdate,
  interceptDelete,
  interceptFav,
  interceptUnfav,
} from '../dashboard/utils';

function orderAlphabetical() {
  setFilter('Sort', 'Alphabetical');
}

function openProperties() {
  cy.get('[aria-label="more-vert"]').first().click();
  cy.getBySel('dashboard-card-option-edit-button').click();
}

function openMenu() {
  cy.get('[aria-label="more-vert"]').first().click();
}

function confirmDelete() {
  cy.getBySel('delete-modal-input').type('DELETE');
  cy.getBySel('modal-confirm-button').click();
}

describe('Dashboards list', () => {
  beforeEach(() => {
    cy.preserveLogin();
  });

  describe('list mode', () => {
    before(() => {
      cy.visit(DASHBOARD_LIST);
      setGridMode('list');
    });

    it('should load rows in list mode', () => {
      cy.getBySel('listview-table').should('be.visible');
      cy.getBySel('sort-header').eq(1).contains('Title');
      cy.getBySel('sort-header').eq(2).contains('Modified by');
      cy.getBySel('sort-header').eq(3).contains('Status');
      cy.getBySel('sort-header').eq(4).contains('Modified');
      cy.getBySel('sort-header').eq(5).contains('Created by');
      cy.getBySel('sort-header').eq(6).contains('Owners');
      cy.getBySel('sort-header').eq(7).contains('Actions');
    });

    it('should sort correctly in list mode', () => {
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('table-row').first().contains('ECharts Dashboard');
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('table-row').first().contains("World Bank's Data");
      cy.getBySel('sort-header').eq(1).click();
    });

    it('should bulk select in list mode', () => {
      toggleBulkSelect();
      cy.get('#header-toggle-all').click();
      cy.get('[aria-label="checkbox-on"]').should('have.length', 6);
      cy.getBySel('bulk-select-copy').contains('5 Selected');
      cy.getBySel('bulk-select-action')
        .should('have.length', 2)
        .then($btns => {
          expect($btns).to.contain('Delete');
          expect($btns).to.contain('Export');
        });
      cy.getBySel('bulk-select-deselect-all').click();
      cy.get('[aria-label="checkbox-on"]').should('have.length', 0);
      cy.getBySel('bulk-select-copy').contains('0 Selected');
      cy.getBySel('bulk-select-action').should('not.exist');
    });
  });

  describe('card mode', () => {
    before(() => {
      cy.visit(DASHBOARD_LIST);
      setGridMode('card');
    });

    it('should load rows in card mode', () => {
      cy.getBySel('listview-table').should('not.exist');
      cy.getBySel('styled-card').should('have.length', 5);
    });

    it('should bulk select in card mode', () => {
      toggleBulkSelect();
      cy.getBySel('styled-card').click({ multiple: true });
      cy.getBySel('bulk-select-copy').contains('5 Selected');
      cy.getBySel('bulk-select-action')
        .should('have.length', 2)
        .then($btns => {
          expect($btns).to.contain('Delete');
          expect($btns).to.contain('Export');
        });
      cy.getBySel('bulk-select-deselect-all').click();
      cy.getBySel('bulk-select-copy').contains('0 Selected');
      cy.getBySel('bulk-select-action').should('not.exist');
    });

    it('should sort in card mode', () => {
      orderAlphabetical();
      cy.getBySel('styled-card').first().contains('ECharts Dashboard');
    });
  });

  describe('common actions', () => {
    beforeEach(() => {
      cy.createSampleDashboards();
      cy.visit(DASHBOARD_LIST);
    });

    it('should allow to favorite/unfavorite dashboard', () => {
      interceptFav();
      interceptUnfav();

      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').first().contains('1 - Sample dashboard');
      cy.getBySel('styled-card')
        .first()
        .find("[aria-label='favorite-unselected']")
        .click();
      cy.wait('@select');
      cy.getBySel('styled-card')
        .first()
        .find("[aria-label='favorite-selected']")
        .click();
      cy.wait('@unselect');
      cy.getBySel('styled-card')
        .first()
        .find("[aria-label='favorite-selected']")
        .should('not.exist');
    });

    it('should bulk delete correctly', () => {
      interceptBulkDelete();
      toggleBulkSelect();

      // bulk deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').eq(0).contains('1 - Sample dashboard').click();
      cy.getBySel('styled-card').eq(1).contains('2 - Sample dashboard').click();
      cy.getBySel('bulk-select-action').eq(0).contains('Delete').click();
      confirmDelete();
      cy.wait('@bulkDelete');
      cy.getBySel('styled-card')
        .eq(0)
        .should('not.contain', '1 - Sample dashboard');
      cy.getBySel('styled-card')
        .eq(1)
        .should('not.contain', '2 - Sample dashboard');

      // bulk deletes in list-view
      setGridMode('list');
      cy.getBySel('table-row').eq(0).contains('3 - Sample dashboard');
      cy.getBySel('table-row').eq(1).contains('4 - Sample dashboard');
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(0).click();
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(1).click();
      cy.getBySel('bulk-select-action').eq(0).contains('Delete').click();
      confirmDelete();
      cy.wait('@bulkDelete');
      cy.getBySel('table-row')
        .eq(0)
        .should('not.contain', '3 - Sample dashboard');
      cy.getBySel('table-row')
        .eq(1)
        .should('not.contain', '4 - Sample dashboard');
    });

    it('should delete correctly', () => {
      interceptDelete();

      // deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').eq(0).contains('1 - Sample dashboard');
      openMenu();
      cy.getBySel('dashboard-card-option-delete-button').click();
      confirmDelete();
      cy.wait('@delete');
      cy.getBySel('styled-card')
        .eq(0)
        .should('not.contain', '1 - Sample dashboard');

      // deletes in list-view
      setGridMode('list');
      cy.getBySel('table-row').eq(0).contains('2 - Sample dashboard');
      cy.getBySel('dashboard-list-trash-icon').eq(0).click();
      confirmDelete();
      cy.wait('@delete');
      cy.getBySel('table-row')
        .eq(0)
        .should('not.contain', '2 - Sample dashboard');
    });

    it('should edit correctly', () => {
      interceptUpdate();

      // edits in card-view
      setGridMode('card');
      orderAlphabetical();
      cy.getBySel('styled-card').eq(0).contains('1 - Sample dashboard');

      // change title
      openProperties();
      cy.getBySel('dashboard-title-input').type(' | EDITED');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('styled-card')
        .eq(0)
        .contains('1 - Sample dashboard | EDITED');

      // edits in list-view
      setGridMode('list');
      cy.getBySel('edit-alt').eq(0).click();
      cy.getBySel('dashboard-title-input').clear().type('1 - Sample dashboard');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('table-row').eq(0).contains('1 - Sample dashboard');
    });
  });
});
