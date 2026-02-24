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
  cy.get('[aria-label="more"]').first().click();
  cy.getBySel('dashboard-card-option-edit-button').click();
}

function openMenu() {
  cy.get('[aria-label="more"]').first().click();
}

function confirmSingleDelete() {
  interceptDelete();

  // Wait for modal dialog to be present and visible
  cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
  cy.getBySel('delete-modal-input')
    .should('be.visible')
    .then($input => {
      cy.wrap($input).clear();
      cy.wrap($input).type('DELETE');
    });
  cy.getBySel('modal-confirm-button').should('be.visible').click();
  cy.wait('@delete');
}

function confirmBulkDelete() {
  interceptBulkDelete();

  // Wait for modal dialog to be present and visible
  cy.get('[role="dialog")[aria-modal="true"]').should('be.visible');
  cy.getBySel('delete-modal-input')
    .should('be.visible')
    .then($input => {
      cy.wrap($input).clear();
      cy.wrap($input).type('DELETE');
    });
  cy.getBySel('modal-confirm-button').should('be.visible').click();
  cy.wait('@bulkDelete');
}

describe('Dashboards list', () => {
  describe('list mode', () => {
    before(() => {
      cy.visit(DASHBOARD_LIST);
      setGridMode('list');
    });

    it('should sort correctly in list mode', () => {
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('loading-indicator').should('not.exist');
      cy.getBySel('table-row').first().contains('Supported Charts Dashboard');
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('loading-indicator').should('not.exist');
      cy.getBySel('table-row').first().contains("World Bank's Data");
      cy.getBySel('sort-header').eq(1).click();
    });
  });

  describe('card mode', () => {
    before(() => {
      cy.visit(DASHBOARD_LIST);
      setGridMode('card');
    });

    it('should sort in card mode', () => {
      orderAlphabetical();
      cy.getBySel('styled-card').first().contains('Supported Charts Dashboard');
    });

    it('should preserve other filters when sorting', () => {
      cy.getBySel('styled-card').should('have.length', 5);
      setFilter('Status', 'Published');
      setFilter('Sort', 'Least recently modified');
      cy.getBySel('styled-card').should('have.length', 3);
    });
  });

  describe('common actions', () => {
    beforeEach(() => {
      cy.createSampleDashboards([0, 1, 2, 3]);
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
        .find("[aria-label='unstarred']")
        .click();
      cy.wait('@select');
      cy.getBySel('styled-card').first().find("[aria-label='starred']").click();
      cy.wait('@unselect');
      cy.getBySel('styled-card')
        .first()
        .find("[aria-label='starred']")
        .should('not.exist');
    });

    it('should bulk delete correctly', () => {
      toggleBulkSelect();

      // bulk deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').eq(0).contains('1 - Sample dashboard').click();
      cy.getBySel('styled-card').eq(1).contains('2 - Sample dashboard').click();

      cy.getBySel('bulk-select-action').trigger('mouseenter');
      cy.contains('Delete').click();
      confirmBulkDelete();
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

      cy.getBySel('bulk-select-action').trigger('mouseenter');
      cy.contains('Delete').click();
      confirmBulkDelete();
      cy.getBySel('loading-indicator').should('exist');
      cy.getBySel('loading-indicator').should('not.exist');
      cy.getBySel('table-row')
        .eq(0)
        .should('not.contain', '3 - Sample dashboard');
      cy.getBySel('table-row')
        .eq(1)
        .should('not.contain', '4 - Sample dashboard');
    });

    it.skip('should delete correctly in list mode', () => {
      // deletes in list-view
      setGridMode('list');

      cy.getBySel('table-row')
        .eq(0)
        .contains('4 - Sample dashboard')
        .should('exist');
      cy.getBySel('dashboard-list-trash-icon').eq(0).click();
      confirmSingleDelete();
      cy.getBySel('table-row')
        .eq(0)
        .should('not.contain', '4 - Sample dashboard');
    });

    it('should delete correctly in card mode', () => {
      // deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card')
        .eq(0)
        .contains('1 - Sample dashboard')
        .should('exist');
      openMenu();
      cy.getBySel('dashboard-card-option-delete-button').click();
      confirmSingleDelete();
      cy.getBySel('styled-card')
        .eq(0)
        .should('not.contain', '1 - Sample dashboard');
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
      cy.getBySel('dashboard-title-input').clear();
      cy.getBySel('dashboard-title-input').type('1 - Sample dashboard');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('table-row').eq(0).contains('1 - Sample dashboard');
    });
  });
});
