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
import { selectResultsTab } from './sqllab.helper';

describe.skip('SqlLab datasource panel', () => {
  beforeEach(() => {
    cy.visit('/sqllab');
  });

  // TODO the test bellow is flaky, and has been disabled for the time being
  // (notice the `it.skip`)
  it('creates a table preview when a database, schema, and table are selected', () => {
    cy.intercept('/superset/table/**').as('tableMetadata');

    // it should have dropdowns to select database, schema, and table
    cy.get('.sql-toolbar .Select').should('have.length', 3);

    cy.get('.sql-toolbar .table-schema').should('not.exist');
    cy.get('[data-test="filterable-table-container"]').should('not.exist');

    cy.get('.sql-toolbar .Select')
      .eq(0) // database select
      .within(() => {
        // note: we have to set force: true because the input is invisible / cypress throws
        cy.get('input').type('main{enter}', { force: true });
      });

    cy.get('.sql-toolbar .Select')
      .eq(1) // schema select
      .within(() => {
        cy.get('input').type('main{enter}', { force: true });
      });

    cy.get('.sql-toolbar .Select')
      .eq(2) // table select
      .within(() => {
        cy.get('input').type('birth_names{enter}', { force: true });
      });

    cy.wait('@tableMetadata');

    cy.get('.sql-toolbar .table-schema').should('have.length', 1);
    selectResultsTab().should('have.length', 1);

    // add another table and check for added schema + preview
    cy.get('.sql-toolbar .Select')
      .eq(2)
      .within(() => {
        cy.get('input').type('logs{enter}', { force: true });
      });

    cy.wait('@tableMetadata');

    cy.get('.sql-toolbar .table-schema').should('have.length', 2);
    selectResultsTab().should('have.length', 2);
  });
});
