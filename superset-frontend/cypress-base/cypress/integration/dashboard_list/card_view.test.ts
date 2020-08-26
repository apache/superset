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

describe('Dashboard card view', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit(DASHBOARD_LIST);
  });

  it('should load cards', () => {
    cy.get('.dashboard-list-view');
    cy.get('.ant-card').should('be.visible');
    cy.get('.ant-card').should('have.length', 4);
  });

  it('should allow to favorite/unfavorite dashboard card', () => {
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
    // sort alphabetical
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click({ force: true });
    cy.get('.Select__menu').contains('Alphabetical').click();
    cy.get('.dashboard-list-view').should('be.visible');
    cy.get('.ant-card').first().contains('Tabbed Dashboard');
    cy.get('.ant-card').last().contains("World Bank's Data");

    // sort recently modified
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click({ force: true });
    cy.get('.Select__menu').contains('Recently Modified').click();
    cy.get('.dashboard-list-view').should('be.visible');
    cy.get('.ant-card').first().contains('Tabbed Dashboard');
    cy.get('.ant-card').last().contains("World Bank's Data");
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
    cy.get('.modal-dialog input[name="dashboard_title"]').should(
      'not.have.value',
    );
    cy.get('.modal-dialog input[name="slug"]').should('not.have.value');
    cy.get('.modal-dialog .btn-default').contains('Cancel').click();
  });
});
