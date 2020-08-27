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

describe('chart card view', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit(CHART_LIST);
  });

  it('should load cards', () => {
    cy.get('.chart-list-view');
    cy.get('.ant-card').should('be.visible');
    cy.get('.ant-card').should('have.length', 25);
  });

  it('should allow to favorite/unfavorite chart card', () => {
    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-selected']")
      .should('not.exist');
    cy.get(".ant-card .card-actions [data-test='favorite-unselected']")
      .first()
      .click();
    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-selected']")
      .should('exist');
    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-unselected']")
      .should('not.exist');

    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-unselected']")
      .should('not.exist');
    cy.get(".ant-card .card-actions [data-test='favorite-selected']")
      .first()
      .click();
    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-unselected']")
      .should('exist');
    cy.get('.ant-card .card-actions')
      .first()
      .find("[data-test='favorite-selected']")
      .should('not.exist');
  });

  it('should sort correctly', () => {
    // sort Alphabetical
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click();
    cy.get('.Select__menu').contains('Alphabetical').click();
    cy.get('.chart-list-view').should('be.visible');
    cy.get('.ant-card').first().contains('% Rural');

    // sort Recently Modified
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click();
    cy.get('.Select__menu').contains('Recently Modified').click();
    cy.get('.chart-list-view').should('be.visible');
    cy.get('.ant-card').first().contains('Unicode Cloud');
    cy.get('.ant-card').last().contains('Life Expectancy VS Rural %');
  });

  it('should delete correctly', () => {
    // show delete modal
    cy.get('.ant-dropdown-trigger').last().trigger('mouseover');
    cy.get('.ant-dropdown-menu-item').contains('Delete').should('exist');
    cy.get('.ant-dropdown-menu-item').contains('Delete').click();
    cy.get('.modal-dialog').should('be.visible');
    cy.get('.modal-dialog .btn-danger').should('have.attr', 'disabled');
    cy.get(".modal-dialog input[id='delete']").type('DELETE');
    cy.get('.modal-dialog .btn-danger').should('not.have.attr', 'disabled');
    cy.get('.modal-dialog .btn-default').contains('Cancel').click();
  });

  it('should edit correctly', () => {
    // show edit modal
    cy.get('.ant-dropdown-trigger').last().trigger('mouseover');
    cy.get('.ant-dropdown-menu-item').contains('Edit').should('exist');
    cy.get('.ant-dropdown-menu-item').contains('Edit').click();
    cy.get('.modal-dialog').should('be.visible');
    cy.get('.modal-dialog input[name="name"]').should('not.have.value');
    cy.get('.modal-dialog .btn-default').contains('Cancel').click();
  });
});
