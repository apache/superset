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
import { DATABASE_LIST } from 'cypress/utils/urls';

function closeModal() {
  cy.get('body').then($body => {
    if ($body.find('[data-test="database-modal"]').length) {
      cy.get('[aria-label="Close"]').eq(1).click();
    }
  });
}

describe('Add database', () => {
  before(() => {
    cy.visit(DATABASE_LIST);
  });

  beforeEach(() => {
    cy.intercept('POST', '**/api/v1/database/validate_parameters/**').as(
      'validateParams',
    );
    cy.intercept('POST', '**/api/v1/database/').as('createDb');

    closeModal();
    cy.getBySel('btn-create-database').click();
  });

  it('should open dynamic form', () => {
    cy.get('.preferred > :nth-child(1)').click();

    cy.get('input[name="host"]').should('have.value', '');
    cy.get('input[name="port"]').should('have.value', '');
    cy.get('input[name="database"]').should('have.value', '');
    cy.get('input[name="username"]').should('have.value', '');
    cy.get('input[name="password"]').should('have.value', '');
    cy.get('input[name="database_name"]').should('have.value', '');
  });

  it('should open sqlalchemy form', () => {
    cy.get('.preferred > :nth-child(1)').click();
    cy.getBySel('sqla-connect-btn').click();

    cy.getBySel('database-name-input').should('be.visible');
    cy.getBySel('sqlalchemy-uri-input').should('be.visible');
  });

  it('show error alerts on dynamic form for bad host', () => {
    cy.get('.preferred > :nth-child(1)').click();

    cy.get('input[name="host"]').type('badhost', { force: true });
    cy.get('input[name="port"]').type('5432', { force: true });
    cy.get('input[name="username"]').type('testusername', { force: true });
    cy.get('input[name="database"]').type('testdb', { force: true });
    cy.get('input[name="password"]').type('testpass', { force: true });

    cy.get('body').click(0, 0);

    cy.wait('@validateParams', { timeout: 30000 });

    cy.getBySel('btn-submit-connection').should('not.be.disabled');
    cy.getBySel('btn-submit-connection').click({ force: true });

    cy.wait('@validateParams', { timeout: 30000 }).then(() => {
      cy.wait('@createDb', { timeout: 60000 }).then(() => {
        cy.contains(
          '.ant-form-item-explain-error',
          "The hostname provided can't be resolved",
        ).should('exist');
      });
    });
  });

  it('show error alerts on dynamic form for bad port', () => {
    cy.get('.preferred > :nth-child(1)').click();

    cy.get('input[name="host"]').type('localhost', { force: true });
    cy.get('body').click(0, 0);
    cy.wait('@validateParams', { timeout: 30000 });

    cy.get('input[name="port"]').type('5430', { force: true });
    cy.get('input[name="database"]').type('testdb', { force: true });
    cy.get('input[name="username"]').type('testusername', { force: true });

    cy.wait('@validateParams', { timeout: 30000 });

    cy.get('input[name="password"]').type('testpass', { force: true });
    cy.wait('@validateParams');

    cy.getBySel('btn-submit-connection').should('not.be.disabled');
    cy.getBySel('btn-submit-connection').click({ force: true });
    cy.wait('@validateParams', { timeout: 30000 }).then(() => {
      cy.get('body').click(0, 0);
      cy.getBySel('btn-submit-connection').click({ force: true });
      cy.wait('@createDb', { timeout: 60000 }).then(() => {
        cy.contains(
          '.ant-form-item-explain-error',
          'The port is closed',
        ).should('exist');
      });
    });
  });
});
