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
import { CHART_LIST } from './chart_list.helper';

describe('chart card view filters', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(CHART_LIST);
    cy.get('[aria-label="card-view"]').click();
  });

  it('should filter by owners correctly', () => {
    // filter by owners
    cy.get('[data-test="filters-select"]').first().click();
    cy.get('.rc-virtual-list').contains('alpha user').click();
    cy.get('[data-test="styled-card"]').should('not.exist');
    cy.get('[data-test="filters-select"]').first().click();
    cy.get('.rc-virtual-list').contains('gamma user').click();
    cy.get('[data-test="styled-card"]').should('not.exist');
  });

  it('should filter by created by correctly', () => {
    // filter by created by
    cy.get('[data-test="filters-select"]').eq(1).click();
    cy.get('.rc-virtual-list').contains('alpha user').click();
    cy.get('.ant-card').should('not.exist');
    cy.get('[data-test="filters-select"]').eq(1).click();
    cy.get('.rc-virtual-list').contains('gamma user').click();
    cy.get('[data-test="styled-card"]').should('not.exist');
  });

  xit('should filter by viz type correctly', () => {
    // filter by viz type
    cy.get('[data-test="filters-select"]').eq(2).click();
    cy.get('.rc-virtual-list').contains('area').click({ timeout: 5000 });
    cy.get('[data-test="styled-card"]').its('length').should('be.gt', 0);
    cy.get('[data-test="styled-card"]')
      .contains("World's Pop Growth")
      .should('be.visible');
    cy.get('[data-test="filters-select"]').eq(2).click();
    cy.get('[data-test="filters-select"]').eq(2).type('world_map{enter}');
    cy.get('[data-test="styled-card"]').should('have.length', 1);
    cy.get('[data-test="styled-card"]')
      .contains('% Rural')
      .should('be.visible');
  });

  it('should filter by datasource correctly', () => {
    // filter by datasource
    cy.get('[data-test="filters-select"]').eq(3).click();
    cy.get('.rc-virtual-list').contains('unicode_test').click();
    cy.get('[data-test="styled-card"]').should('have.length', 1);
    cy.get('[data-test="styled-card"]')
      .contains('Unicode Cloud')
      .should('be.visible');
    cy.get('[data-test="filters-select"]').eq(2).click();
    cy.get('[data-test="filters-select"]')
      .eq(2)
      .type('energy_usage{enter}{enter}');
    cy.get('[data-test="styled-card"]').its('length').should('be.gt', 0);
  });
});

describe('chart list view filters', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(CHART_LIST);
    cy.get('[aria-label="list-view"]').click();
  });

  it('should filter by owners correctly', () => {
    // filter by owners
    cy.get('[data-test="filters-select"]').first().click();
    cy.get('.rc-virtual-list').contains('alpha user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
    cy.get('[data-test="filters-select"]').first().click();
    cy.get('.rc-virtual-list').contains('gamma user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
  });

  it('should filter by created by correctly', () => {
    // filter by created by
    cy.get('[data-test="filters-select"]').eq(1).click();
    cy.get('.rc-virtual-list').contains('alpha user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
    cy.get('[data-test="filters-select"]').eq(1).click();
    cy.get('.rc-virtual-list').contains('gamma user').click();
    cy.get('[data-test="table-row"]').should('not.exist');
  });

  // this is flaky, but seems to fail along with the card view test of the same name
  xit('should filter by viz type correctly', () => {
    // filter by viz type
    cy.get('[data-test="filters-select"]').eq(2).click();
    cy.get('.rc-virtual-list').contains('area').click({ timeout: 5000 });
    cy.get('[data-test="table-row"]').its('length').should('be.gt', 0);
    cy.get('[data-test="table-row"]')
      .contains("World's Pop Growth")
      .should('exist');
    cy.get('[data-test="filters-select"]').eq(2).click();
    cy.get('[data-test="filters-select"]').eq(2).type('world_map{enter}');
    cy.get('[data-test="table-row"]').should('have.length', 1);
    cy.get('[data-test="table-row"]').contains('% Rural').should('exist');
  });

  it('should filter by datasource correctly', () => {
    // filter by datasource
    cy.get('[data-test="filters-select"]').eq(3).click();
    cy.get('.rc-virtual-list').contains('unicode_test').click();
    cy.get('[data-test="table-row"]').should('have.length', 1);
    cy.get('[data-test="table-row"]').contains('Unicode Cloud').should('exist');
    cy.get('[data-test="filters-select"]').eq(3).click();
    cy.get('[data-test="filters-select"]')
      .eq(3)
      .type('energy_usage{enter}{enter}');
    cy.get('[data-test="table-row"]').its('length').should('be.gt', 0);
  });
});
