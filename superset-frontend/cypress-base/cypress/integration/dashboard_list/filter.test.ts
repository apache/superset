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
import { DASHBOARD_LIST } from './dashboard_list.helper';

describe('dashboard filters card view', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="card-view"]').click();
  });

  it('should filter by owners correctly', () => {
    // filter by owners
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('alpha user').click();
    cy.get('[data-test="styled-card"]').should('not.exist');
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('gamma user').click();
    cy.get('[data-test="styled-card"]').should('not.exist');
  });

  it('should filter by me correctly', () => {
    // filter by me
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('me').click();
    cy.get('[data-test="styled-card"]').its('length').should('be.gt', 0);
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('me').click();
    cy.get('[data-test="styled-card"]').its('length').should('be.gt', 0);
  });

  it('should filter by created by correctly', () => {
    // filter by created by
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('alpha user').click();
    cy.get('.ant-card').should('not.exist');
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('gamma user').click();
    cy.get('.ant-card').should('not.exist');
  });

  it('should filter by published correctly', () => {
    // filter by published
    cy.get('.Select__control').eq(2).click();
    cy.get('.Select__menu').contains('Published').click({ timeout: 5000 });
    cy.get('[data-test="styled-card"]').should('have.length', 2);
    cy.get('[data-test="styled-card"]')
      .first()
      .contains('USA Births Names')
      .should('be.visible');
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__control').eq(1).type('unpub{enter}');
    cy.get('[data-test="styled-card"]').should('have.length', 2);
  });
});

describe('dashboard filters list view', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="list-view"]').click();
  });

  it('should filter by owners correctly', () => {
    // filter by owners
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('alpha user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('gamma user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
  });

  it('should filter by me correctly', () => {
    // filter by me
    cy.get('.Select__control').first().click();
    cy.get('.Select__menu').contains('me').click();
    cy.get('[data-test="table-row"]').its('length').should('be.gt', 0);
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('me').click();
    cy.get('[data-test="table-row"]').its('length').should('be.gt', 0);
  });

  it('should filter by created by correctly', () => {
    // filter by created by
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('alpha user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
    cy.get('.Select__control').eq(1).click();
    cy.get('.Select__menu').contains('gamma user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
  });

  xit('should filter by published correctly', () => {
    // filter by published
    cy.get('.Select__control').eq(2).click();
    cy.get('.Select__menu').contains('Published').click();
    cy.get('[data-test="table-row"]').should('have.length', 2);
    cy.get('[data-test="table-row"]')
      .first()
      .contains('USA Births Names')
      .should('be.visible');
    cy.get('.Select__control').eq(2).click();
    cy.get('.Select__control').eq(2).type('unpub{enter}');
    cy.get('[data-test="table-row"]').should('have.length', 2);
  });
});
