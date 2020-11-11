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
import { DATABASE_LIST } from './helper';

describe('Add database', () => {
  beforeEach(() => {
    cy.server();
    cy.login();
  });

  it('should keep create modal open when error', () => {
    cy.visit(DATABASE_LIST);

    // open modal
    cy.get('[data-test="btn-create-database"]').click();

    // type values
    cy.get('[data-test="database-modal"] input[name="database_name"]')
      .focus()
      .type('cypress');
    cy.get('[data-test="database-modal"] input[name="sqlalchemy_uri"]')
      .focus()
      .type('bad_db_uri');

    // click save
    cy.get('[data-test="modal-confirm-button"]:not(:disabled)').click();

    // should show error alerts and keep modal open
    cy.get('.toast').contains('error');
    cy.wait(1000); // wait for potential (incorrect) closing annimation
    cy.get('[data-test="database-modal"]').should('be.visible');

    // should be able to close modal
    cy.get('[data-test="modal-cancel-button"]').click();
    cy.get('[data-test="database-modal"]').should('not.be.visible');
  });

  it('should keep update modal open when error', () => {
    // open modal
    cy.get('[data-test="database-edit"]:last').click();

    cy.get('[data-test="database-modal"]:last input[name="sqlalchemy_uri"]')
      .focus()
      .dblclick()
      .type('{selectall}{backspace}bad_uri');

    // click save
    cy.get('[data-test="modal-confirm-button"]:not(:disabled)').click();

    // should show error alerts
    cy.get('.toast').contains('error').should('be.visible');

    // modal should still be open
    cy.wait(1000); // wait for potential (incorrect) closing annimation
    cy.get('[data-test="database-modal"]').should('be.visible');
  });
});
