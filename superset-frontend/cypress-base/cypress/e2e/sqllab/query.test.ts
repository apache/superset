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
import { nanoid } from 'nanoid';
import { selectResultsTab, assertSQLLabResultsAreEqual } from './sqllab.helper';

function parseClockStr(node: JQuery) {
  return Number.parseFloat(node.text().replace(/:/g, ''));
}

describe('SqlLab query panel', () => {
  beforeEach(() => {
    cy.visit('/sqllab');
  });

  it.skip('supports entering and running a query', () => {
    // row limit has to be < ~10 for us to be able to determine how many rows
    // are fetched below (because React _Virtualized_ does not render all rows)
    let clockTime = 0;

    cy.intercept({
      method: 'POST',
      url: '/api/v1/sqllab/execute/',
    }).as('mockSQLResponse');

    cy.get('.TableSelector .Select:eq(0)').click();
    cy.get('.TableSelector .Select:eq(0) input[type=text]')
      .focus()
      .type('{enter}');

    cy.get('#brace-editor textarea')
      .focus()
      .clear()
      .type(`{selectall}{backspace}SELECT 1`);

    cy.get('#js-sql-toolbar button:eq(0)').eq(0).click();

    // wait for 300 milliseconds
    cy.wait(300);

    // started timer
    cy.get('.sql-toolbar .label-success').then(node => {
      clockTime = parseClockStr(node);
      // should be longer than 0.2s
      expect(clockTime).greaterThan(0.2);
    });

    cy.wait('@mockSQLResponse');

    // timer is increasing
    cy.get('.sql-toolbar .label-success').then(node => {
      const newClockTime = parseClockStr(node);
      expect(newClockTime).greaterThan(0.9);
      clockTime = newClockTime;
    });

    // rerun the query
    cy.get('#js-sql-toolbar button:eq(0)').eq(0).click();

    // should restart the timer
    cy.get('.sql-toolbar .label-success').contains('00:00:00');
    cy.wait('@mockSQLResponse');
    cy.get('.sql-toolbar .label-success').then(node => {
      expect(parseClockStr(node)).greaterThan(0.9);
    });
  });

  it.skip('successfully saves a query', () => {
    cy.intercept('api/v1/database/**/tables/**').as('getTables');
    cy.intercept('savedqueryviewapi/**').as('getSavedQuery');

    const query =
      'SELECT ds, gender, name, num FROM main.birth_names ORDER BY name LIMIT 3';
    const savedQueryTitle = `CYPRESS TEST QUERY ${nanoid()}`;

    // we will assert that the results of the query we save, and the saved query are the same
    let initialResultsTable: HTMLElement | null = null;
    let savedQueryResultsTable = null;

    cy.get('#brace-editor textarea')
      .clear({ force: true })
      .type(`{selectall}{backspace}${query}`, { force: true })
      .focus() // focus => blur is required for updating the query that is to be saved
      .blur();

    // ctrl + r also runs query
    cy.get('#brace-editor textarea').type('{ctrl}r', { force: true });

    cy.wait('@sqlLabQuery');

    // Save results to check against below
    selectResultsTab().then(resultsA => {
      initialResultsTable = resultsA[0];
    });

    cy.get('#js-sql-toolbar button')
      .eq(1) // save query
      .click();

    // Enter name + save into modal
    cy.get('.modal-sm input')
      .clear({ force: true })
      .type(`{selectall}{backspace}${savedQueryTitle}`, {
        force: true,
      });

    cy.get('.modal-sm .modal-body button')
      .eq(0) // save
      .click();

    // first row contains most recent link, follow back to SqlLab
    cy.get('table tr:first-child a[href*="savedQueryId"').click();

    // will timeout without explicitly waiting here
    cy.wait(['@getSavedQuery', '@getTables']);

    // run the saved query
    cy.get('#js-sql-toolbar button')
      .eq(0) // run query
      .click();

    cy.wait('@sqlLabQuery');

    // assert the results of the saved query match the initial results
    selectResultsTab().then(resultsB => {
      savedQueryResultsTable = resultsB[0];

      assertSQLLabResultsAreEqual(initialResultsTable, savedQueryResultsTable);
    });
  });

  it('Create a chart from a query', () => {
    cy.intercept('/api/v1/sqllab/execute/').as('queryFinished');
    cy.intercept('**/api/v1/explore/**').as('explore');
    cy.intercept('**/api/v1/chart/**').as('chart');

    // cypress doesn't handle opening a new tab, override window.open to open in the same tab
    cy.window().then(win => {
      cy.stub(win, 'open', url => {
        // eslint-disable-next-line no-param-reassign
        win.location.href = url;
      });
    });

    const query = 'SELECT gender, name FROM birth_names';

    cy.get('.ace_text-input')
      .focus()
      .clear({ force: true })
      .type(`{selectall}{backspace}${query}`, { force: true });
    cy.get('.sql-toolbar button').contains('Run').click();
    cy.wait('@queryFinished');

    cy.get(
      '.SouthPane .ant-tabs-content > .ant-tabs-tabpane-active > div button:first',
      { timeout: 10000 },
    ).click();

    cy.wait('@explore');
    cy.get('[data-test="datasource-control"] .title-select').contains(query);
    cy.get('.column-option-label').first().contains('gender');
    cy.get('.column-option-label').last().contains('name');

    cy.get(
      '[data-test="all_columns"] [data-test="dnd-labels-container"] > div:first-child',
    ).contains('gender');
    cy.get(
      '[data-test="all_columns"] [data-test="dnd-labels-container"] > div:nth-child(2)',
    ).contains('name');

    cy.wait('@chart');
    cy.get('[data-test="slice-container"] table > thead th')
      .first()
      .contains('gender');
    cy.get('[data-test="slice-container"] table > thead th')
      .last()
      .contains('name');
  });
});
