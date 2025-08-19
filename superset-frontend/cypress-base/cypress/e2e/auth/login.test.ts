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
import { LOGIN } from 'cypress/utils/urls';

function interceptLogin() {
  cy.intercept('POST', '**/login/').as('login');
}

describe('Login view', () => {
  beforeEach(() => {
    cy.visit(LOGIN);
  });

  it('should redirect to login with incorrect username and password', () => {
    interceptLogin();
    cy.getBySel('login-form').should('be.visible');
    cy.getBySel('username-input').type('admin');
    cy.getBySel('password-input').type('wrongpassword');
    cy.getBySel('login-button').click();
    cy.wait('@login');
    cy.url().should('include', LOGIN);
  });

  it('should login with correct username and password', () => {
    interceptLogin();
    cy.getBySel('login-form').should('be.visible');
    cy.getBySel('username-input').type('admin');
    cy.getBySel('password-input').type('general');
    cy.getBySel('login-button').click();
    cy.wait('@login');
    cy.getCookies().should('have.length', 1);
  });
});
