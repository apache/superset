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
    closeModal();
    cy.getBySel('btn-create-database').click();
  });

  it('should open dynamic form', () => {
    // click postgres dynamic form
    cy.get('.preferred > :nth-child(1)').click();

    // make sure all the fields are rendering
    cy.get('input[name="host"]').should('have.value', '');
    cy.get('input[name="port"]').should('have.value', '');
    cy.get('input[name="database"]').should('have.value', '');
    cy.get('input[name="password"]').should('have.value', '');
    cy.get('input[name="database_name"]').should('have.value', '');
  });

  it('should open sqlalchemy form', () => {
    // click postgres dynamic form
    cy.get('.preferred > :nth-child(1)').click();

    cy.getBySel('sqla-connect-btn').click();

    // check if the sqlalchemy form is showing up
    cy.getBySel('database-name-input').should('be.visible');
    cy.getBySel('sqlalchemy-uri-input').should('be.visible');
  });

  it('show error alerts on dynamic form for bad host', () => {
    // click postgres dynamic form
    cy.get('.preferred > :nth-child(1)').click();
    cy.get('input[name="host"]').focus();
    cy.focused().type('badhost', { force: true });
    cy.get('input[name="port"]').focus();
    cy.focused().type('5432', { force: true });
    cy.get('.ant-form-item-explain-error').contains(
      "The hostname provided can't be resolved",
    );
  });

  it('show error alerts on dynamic form for bad port', () => {
    // click postgres dynamic form
    cy.get('.preferred > :nth-child(1)').click();
    cy.get('input[name="host"]').focus();
    cy.focused().type('localhost', { force: true });
    cy.get('input[name="port"]').focus();
    cy.focused().type('123', { force: true });
    cy.get('input[name="database"]').focus();
    cy.get('.ant-form-item-explain-error').contains('The port is closed');
  });
});
