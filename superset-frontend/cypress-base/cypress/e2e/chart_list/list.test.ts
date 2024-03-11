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
  visitSampleChartFromList,
  saveChartToDashboard,
  interceptFiltering,
} from '../explore/utils';
import { interceptGet as interceptDashboardGet } from '../dashboard/utils';

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

function visitChartList() {
  interceptFiltering();
  cy.visit(CHART_LIST);
  cy.wait('@filtering');
}

describe('Charts list', () => {
  describe.skip('Cross-referenced dashboards', () => {
    beforeEach(() => {
      cy.createSampleDashboards([0, 1, 2, 3]);
      cy.createSampleCharts([0]);
      visitChartList();
    });

    it('should show the cross-referenced dashboards in the table cell', () => {
      interceptDashboardGet();
      cy.getBySel('table-row')
        .first()
        .find('[data-test="table-row-cell"]')
        .find('[data-test="crosslinks"]')
        .should('be.empty');
      cy.getBySel('table-row')
        .eq(10)
        .find('[data-test="table-row-cell"]')
        .find('[data-test="crosslinks"]')
        .contains('Supported Charts Dashboard')
        .invoke('removeAttr', 'target')
        .click();
      cy.wait('@get');
    });

    it('should show the newly added dashboards in a tooltip', () => {
      interceptDashboardGet();
      visitSampleChartFromList('1 - Sample chart');
      saveChartToDashboard('1 - Sample dashboard');
      saveChartToDashboard('2 - Sample dashboard');
      saveChartToDashboard('3 - Sample dashboard');
      visitChartList();
      cy.getBySel('count-crosslinks').should('be.visible');
      cy.getBySel('crosslinks')
        .first()
        .trigger('mouseover')
        .then(() => {
          cy.get('.ant-tooltip')
            .contains('3 - Sample dashboard')
            .invoke('removeAttr', 'target')
            .click();
          cy.wait('@get');
        });
    });
  });

  describe('list mode', () => {
    before(() => {
      cy.createSampleDashboards([0, 1, 2, 3]);
      cy.createSampleCharts([0]);
      visitChartList();
      setGridMode('list');
    });

    it('should load rows in list mode', () => {
      cy.getBySel('listview-table').should('be.visible');
      cy.getBySel('sort-header').eq(1).contains('Name');
      cy.getBySel('sort-header').eq(2).contains('Type');
      cy.getBySel('sort-header').eq(3).contains('Dataset');
      cy.getBySel('sort-header').eq(4).contains('Owners');
      cy.getBySel('sort-header').eq(5).contains('Last modified');
      cy.getBySel('sort-header').eq(6).contains('Actions');
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
      visitChartList();
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

    it('should preserve other filters when sorting', () => {
      cy.getBySel('styled-card').should('have.length', 25);
      setFilter('Type', 'Big Number');
      setFilter('Sort', 'Least recently modified');
      cy.getBySel('styled-card').should('have.length', 3);
    });
  });

  describe('common actions', () => {
    beforeEach(() => {
      cy.createSampleCharts([0, 1, 2, 3]);
      visitChartList();
    });

    it('should allow to favorite/unfavorite', () => {
      cy.intercept({ url: `/api/v1/chart/*/favorites/`, method: 'POST' }).as(
        'select',
      );
      cy.intercept({ url: `/api/v1/chart/*/favorites/`, method: 'DELETE' }).as(
        'unselect',
      );

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
