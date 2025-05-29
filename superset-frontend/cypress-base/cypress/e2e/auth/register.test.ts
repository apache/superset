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

import { REGISTER } from 'cypress/utils/urls';

describe('Register view', () => {
  beforeEach(() => {
    cy.visit(REGISTER);
  });

  it('should load register page', () => {
    cy.getBySel('register-form').should('be.visible');
    cy.getBySel('username-input').should('be.visible');
    cy.getBySel('first-name-input').should('be.visible');
    cy.getBySel('last-name-input').should('be.visible');
    cy.getBySel('email-input').should('be.visible');
    cy.getBySel('password-input').should('be.visible');
    cy.getBySel('confirm-password-input').should('be.visible');
    cy.getBySel('register-button').should('be.visible');
  });
});
