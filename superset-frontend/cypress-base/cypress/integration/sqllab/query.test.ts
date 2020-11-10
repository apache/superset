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
import * as shortid from 'shortid';
import { selectResultsTab, assertSQLLabResultsAreEqual } from './sqllab.helper';

function parseClockStr(node: JQuery) {
  return Number.parseFloat(node.text().replace(/:/g, ''));
}

describe('SqlLab query panel', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit('/superset/sqllab');
  });

  it('supports entering and running a query', () => {
    // row limit has to be < ~10 for us to be able to determine how many rows
    // are fetched below (because React _Virtualized_ does not render all rows)
    let clockTime = 0;

    const sampleResponse = {
      status: 'success',
      data: [{ '?column?': 1 }],
      columns: [{ name: '?column?', type: 'INT', is_date: false }],
      selected_columns: [{ name: '?column?', type: 'INT', is_date: false }],
      expanded_columns: [],
    };

    cy.route({
      method: 'POST',
      url: '/superset/sql_json/',
      delay: 2000,
      response: () => sampleResponse,
    }).as('mockSQLResponse');

    cy.get('.ant-tabs-nav-list').children().first().click();
    cy.get('[data-test="sql-editor-left-schema-pane-bar"]').within(() => {
      cy.get('[data-test="database-selector-input"]').type('{enter}');
    });

    cy.get('#brace-editor textarea')
      .focus()
      .clear()
      .type(`{selectall}{backspace}SELECT 1`);

    cy.get('[data-test="sql-editor-run-query-action-button"]').click();

    const actionBar = '[data-test="sql-editor-actions-toolbar"]';
    const timerLabel = `${actionBar} .label-success`;

    // started timer
    cy.get(timerLabel)
      .contains('00:00')
      .then(node => {
        clockTime = parseClockStr(node);
        // should be longer than 0.01s
        expect(clockTime).greaterThan(0.01);
      });

    cy.wait('@mockSQLResponse');

    // timer is increasing
    cy.get(timerLabel).then(node => {
      const newClockTime = parseClockStr(node);
      expect(newClockTime).greaterThan(0.9);
      clockTime = newClockTime;
    });

    // rerun the query
    cy.get('[data-test="sql-editor-run-query-action-button"]').click();

    // should restart the timer
    cy.get(timerLabel).contains('00:00');

    cy.wait('@mockSQLResponse');
    cy.get(timerLabel).then(node => {
      expect(parseClockStr(node)).greaterThan(0.9);
    });
  });

  it.skip('successfully saves a query', () => {
    const query =
      'SELECT ds, gender, name, num FROM birth_names ORDER BY name LIMIT 3';
    const savedQueryTitle = `CYPRESS TEST QUERY ${shortid.generate()}`;

    // we will assert that the results of the query we save, and the saved query are the same
    let initialResultsTable: HTMLElement | null = null;
    let savedQueryResultsTable = null;

    cy.get('[data-test="sql-editor-left-schema-pane-bar"]').within(() => {
      cy.get('[data-test="database-selector-input"]').type('{enter}');
    });
    cy.get('#brace-editor textarea')
      .should('be.visible')
      .clear({ force: true })
      .type(`{selectall}{backspace}${query}`, { force: true })
      .focus() // focus => blur is required for updating the query that is to be saved
      .blur();

    // ctrl + r also runs query
    cy.wait(1000);
    cy.get('#brace-editor textarea').type('{ctrl}r', { force: true });
    cy.get('[data-test="sql-editor-actions-toolbar"]')
      .find('.label-success')
      .should('be.visible');

    // Save results to check agains below
    selectResultsTab().then(resultsA => {
      initialResultsTable = resultsA[0];
    });

    cy.get('[data-test="sql-editor-save-query-action-button"]').click();

    // Enter name + save into modal
    cy.get('.ant-modal-content').within(() => {
      cy.get('input:first')
        .should('have.attr', 'placeholder', 'Label for your query')
        .clear({ force: true })
        .type(`{selectall}{backspace}${savedQueryTitle}`, {
          force: true,
        });
      cy.get('.btn-primary').should('have.text', 'Save').click();
    });

    // visit saved queries
    cy.visit('/sqllab/my_queries/');
    cy.get('[data-test="listview-table"]').within($table => {
      const savedQueriesNumber = Cypress.$($table).find('tr').length;
      cy.visit(`superset/sqllab?savedQueryId=${savedQueriesNumber}`);
    });
    cy.contains(query);
    cy.get('[data-test="sql-editor-run-query-action-button"]')
      .last()
      .should('be.visible')
      .click();
    selectResultsTab().then(resultsB => {
      savedQueryResultsTable = resultsB[0];
      assertSQLLabResultsAreEqual(initialResultsTable, savedQueryResultsTable);
    });
  });
});
