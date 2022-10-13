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
import { CHART_LIST } from 'cypress/utils/urls';
import { setGridMode, toggleBulkSelect } from 'cypress/utils';
import {
  setFilter,
  interceptBulkDelete,
  interceptUpdate,
  interceptDelete,
} from '../explore/utils';

function orderAlphabetical() {
  setFilter('Sort', 'Alphabetical');
}

function openProperties() {
  cy.get('[aria-label="more-vert"]').eq(1).click();
  cy.getBySel('chart-list-edit-option').click();
}

function openMenu() {
  cy.get('[aria-label="more-vert"]').eq(1).click();
}

function confirmDelete() {
  cy.getBySel('delete-modal-input').type('DELETE');
  cy.getBySel('modal-confirm-button').click();
}

describe('Charts list', () => {
  beforeEach(() => {
    cy.preserveLogin();
  });

  describe('list mode', () => {
    before(() => {
      cy.visit(CHART_LIST);
      setGridMode('list');
    });

    it('should load rows in list mode', () => {
      cy.getBySel('listview-table').should('be.visible');
      cy.getBySel('sort-header').eq(1).contains('Chart');
      cy.getBySel('sort-header').eq(2).contains('Visualization type');
      cy.getBySel('sort-header').eq(3).contains('Dataset');
      cy.getBySel('sort-header').eq(4).contains('Dashboards added to');
      cy.getBySel('sort-header').eq(5).contains('Modified by');
      cy.getBySel('sort-header').eq(6).contains('Last modified');
      cy.getBySel('sort-header').eq(7).contains('Created by');
      cy.getBySel('sort-header').eq(8).contains('Actions');
    });

    it('should sort correctly in list mode', () => {
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('table-row').first().contains('% Rural');
      cy.getBySel('sort-header').eq(1).click();
      cy.getBySel('table-row').first().contains("World's Population");
      cy.getBySel('sort-header').eq(1).click();
    });

    it('should bulk select in list mode', () => {
      toggleBulkSelect();
      cy.get('#header-toggle-all').click();
      cy.get('[aria-label="checkbox-on"]').should('have.length', 26);
      cy.getBySel('bulk-select-copy').contains('25 Selected');
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
      cy.visit(CHART_LIST);
      setGridMode('card');
    });

    it('should load rows in card mode', () => {
      cy.getBySel('listview-table').should('not.exist');
      cy.getBySel('styled-card').should('have.length', 25);
    });

    it('should bulk select in card mode', () => {
      toggleBulkSelect();
      cy.getBySel('styled-card').click({ multiple: true });
      cy.getBySel('bulk-select-copy').contains('25 Selected');
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
      cy.getBySel('styled-card').first().contains('% Rural');
    });
  });

  describe('common actions', () => {
    beforeEach(() => {
      cy.createSampleCharts();
      cy.visit(CHART_LIST);
    });

    it('should allow to favorite/unfavorite', () => {
      cy.intercept(`/superset/favstar/slice/*/select/`).as('select');
      cy.intercept(`/superset/favstar/slice/*/unselect/`).as('unselect');

      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').first().contains('% Rural');
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

      cy.getBySel('styled-card').eq(1).contains('1 - Sample chart').click();
      cy.getBySel('styled-card').eq(2).contains('2 - Sample chart').click();
      cy.getBySel('bulk-select-action').eq(0).contains('Delete').click();
      confirmDelete();
      cy.wait('@bulkDelete');
      cy.getBySel('styled-card')
        .eq(1)
        .should('not.contain', '1 - Sample chart');
      cy.getBySel('styled-card')
        .eq(2)
        .should('not.contain', '2 - Sample chart');

      // bulk deletes in list-view
      setGridMode('list');
      cy.getBySel('table-row').eq(1).contains('3 - Sample chart');
      cy.getBySel('table-row').eq(2).contains('4 - Sample chart');
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(1).click();
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(2).click();
      cy.getBySel('bulk-select-action').eq(0).contains('Delete').click();
      confirmDelete();
      cy.wait('@bulkDelete');
      cy.getBySel('table-row').eq(1).should('not.contain', '3 - Sample chart');
      cy.getBySel('table-row').eq(2).should('not.contain', '4 - Sample chart');
    });

    it('should delete correctly', () => {
      interceptDelete();

      // deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').eq(1).contains('1 - Sample chart');
      openMenu();
      cy.getBySel('chart-list-delete-option').click();
      confirmDelete();
      cy.wait('@delete');
      cy.getBySel('styled-card')
        .eq(1)
        .should('not.contain', '1 - Sample chart');

      // deletes in list-view
      setGridMode('list');
      cy.getBySel('table-row').eq(1).contains('2 - Sample chart');
      cy.getBySel('trash').eq(1).click();
      confirmDelete();
      cy.wait('@delete');
      cy.getBySel('table-row').eq(1).should('not.contain', '2 - Sample chart');
    });

    it('should edit correctly', () => {
      interceptUpdate();

      // edits in card-view
      setGridMode('card');
      orderAlphabetical();
      cy.getBySel('styled-card').eq(1).contains('1 - Sample chart');

      // change title
      openProperties();
      cy.getBySel('properties-modal-name-input').type(' | EDITED');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('styled-card').eq(1).contains('1 - Sample chart | EDITED');

      // edits in list-view
      setGridMode('list');
      cy.getBySel('edit-alt').eq(1).click();
      cy.getBySel('properties-modal-name-input')
        .clear()
        .type('1 - Sample chart');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('table-row').eq(1).contains('1 - Sample chart');
    });
  });
});
