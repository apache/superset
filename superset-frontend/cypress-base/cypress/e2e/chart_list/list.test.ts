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
  interceptFavoriteStatus,
} from '../explore/utils';
import { interceptGet as interceptDashboardGet } from '../dashboard/utils';

function orderAlphabetical() {
  setFilter('Sort', 'Alphabetical');
}

function openProperties() {
  cy.get('[aria-label="more"]').eq(0).click();
  cy.getBySel('chart-list-edit-option').click();
}

function openMenu() {
  cy.get('[aria-label="more"]').eq(0).click();
}

function confirmDelete() {
  cy.getBySel('delete-modal-input').type('DELETE');
  cy.getBySel('modal-confirm-button').click();
}

function visitChartList() {
  interceptFiltering();
  interceptFavoriteStatus();
  cy.visit(CHART_LIST);
  cy.wait('@filtering');
  cy.wait('@favoriteStatus');
}

describe('Charts list', () => {
  describe('Cross-referenced dashboards', () => {
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
      saveChartToDashboard('1 - Sample chart', '1 - Sample dashboard');
      saveChartToDashboard('1 - Sample chart', '2 - Sample dashboard');
      saveChartToDashboard('1 - Sample chart', '3 - Sample dashboard');
      saveChartToDashboard('1 - Sample chart', '4 - Sample dashboard');
      visitChartList();

      cy.getBySel('count-crosslinks').should('be.visible');
    });
  });

  describe('card mode', () => {
    before(() => {
      visitChartList();
      setGridMode('card');
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
      visitChartList();
    });

    it('should bulk delete correctly', () => {
      cy.createSampleCharts([0, 1, 2, 3]);

      interceptBulkDelete();
      toggleBulkSelect();

      // bulk deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('skeleton-card').should('not.exist');
      cy.getBySel('styled-card').contains('1 - Sample chart').click();
      cy.getBySel('styled-card').contains('2 - Sample chart').click();
      cy.getBySel('bulk-select-action').contains('Delete').click();
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
      cy.get('.loading').should('not.exist');
      cy.getBySel('table-row').contains('3 - Sample chart').should('exist');
      cy.getBySel('table-row').contains('4 - Sample chart').should('exist');
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(0).click();
      cy.get('[data-test="table-row"] input[type="checkbox"]').eq(1).click();
      cy.getBySel('bulk-select-action').eq(0).contains('Delete').click();
      confirmDelete();
      cy.wait('@bulkDelete');
      cy.get('.loading').should('exist');
      cy.get('.loading').should('not.exist');
      cy.getBySel('table-row').eq(0).should('not.contain', '3 - Sample chart');
      cy.getBySel('table-row').eq(1).should('not.contain', '4 - Sample chart');
    });

    it('should delete correctly in card mode', () => {
      cy.createSampleCharts([0, 1]);
      interceptDelete();

      // deletes in card-view
      setGridMode('card');
      orderAlphabetical();

      cy.getBySel('styled-card').contains('1 - Sample chart');
      openMenu();
      cy.getBySel('chart-list-delete-option').click();
      confirmDelete();
      cy.wait('@delete');
      cy.getBySel('styled-card')
        .contains('1 - Sample chart')
        .should('not.exist');
    });

    it('should delete correctly in list mode', () => {
      cy.createSampleCharts([2, 3]);
      interceptDelete();
      cy.getBySel('sort-header').contains('Name').click();

      // Modal closes immediatly without this
      cy.wait(2000);

      cy.getBySel('table-row').eq(0).contains('3 - Sample chart');
      cy.getBySel('delete').eq(0).click();
      confirmDelete();
      cy.wait('@delete');
      cy.get('.loading').should('exist');
      cy.get('.loading').should('not.exist');
      cy.getBySel('table-row').eq(0).should('not.contain', '3 - Sample chart');
    });

    it('should edit correctly', () => {
      cy.createSampleCharts([0]);
      interceptUpdate();

      // edits in card-view
      setGridMode('card');
      orderAlphabetical();
      cy.getBySel('skeleton-card').should('not.exist');
      cy.getBySel('styled-card').eq(0).contains('1 - Sample chart');

      // change title
      openProperties();
      cy.getBySel('properties-modal-name-input').type(' | EDITED');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('styled-card').eq(0).contains('1 - Sample chart | EDITED');

      // edits in list-view
      setGridMode('list');
      cy.getBySel('edit-alt').eq(1).click();
      cy.getBySel('properties-modal-name-input').clear();
      cy.getBySel('properties-modal-name-input').type('1 - Sample chart');
      cy.get('button:contains("Save")').click();
      cy.wait('@update');
      cy.getBySel('table-row').eq(1).contains('1 - Sample chart');
    });
  });
});
