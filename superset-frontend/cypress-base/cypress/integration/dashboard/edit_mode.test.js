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
import { WORLD_HEALTH_DASHBOARD, drag } from './dashboard.helper';

describe('Dashboard edit mode', () => {
  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
    cy.get('[data-test="dashboard-header"]')
      .find('[data-test=edit-alt]')
      .click();
  });

  it('remove, and add chart flow', () => {
    // wait for box plot to appear
    cy.get('[data-test="grid-container"]').find('.box_plot', {
      timeout: 10000,
    });
    const elementsCount = 10;

    cy.get('[data-test="dashboard-component-chart-holder"]')
      .find('[data-test="dashboard-delete-component-button"]')
      .last()
      .then($el => {
        cy.wrap($el).invoke('show').click();
        // box plot should be gone
        cy.get('[data-test="grid-container"]')
          .find('.box_plot')
          .should('not.be.visible');
      });

    cy.get('[data-test="dashboard-builder-component-pane-tabs-navigation"]')
      .find('.ant-tabs-tab')
      .last()
      .click();

    // find box plot is available from list
    cy.get('[data-test="dashboard-charts-filter-search-input"]').type(
      'Box plot',
    );
    cy.get('[data-test="card-title"]').should('have.length', 1);

    drag('[data-test="card-title"]', 'Box plot').to(
      '.grid-row.background--transparent:last',
    );

    // add back to dashboard
    cy.get('[data-test="grid-container"]')
      .find('.box_plot')
      .should('be.visible');

    // should show Save changes button
    cy.get('[data-test="header-save-button"]').should('be.visible');

    // undo first step and expect deleted item
    cy.get('[data-test="undo-action"]').click();
    cy.get('[data-test="grid-container"]')
      .find('[data-test="chart-container"]')
      .should('have.length', elementsCount - 1);

    // Box plot chart should be gone
    cy.get('[data-test="grid-container"]')
      .find('.box_plot')
      .should('not.be.visible');

    // undo second step and expect initial items count
    cy.get('[data-test="undo-action"]').click();
    cy.get('[data-test="grid-container"]')
      .find('[data-test="chart-container"]')
      .should('have.length', elementsCount);
    cy.get('[data-test="card-title"]').contains('Box plot', { timeout: 5000 });

    // save changes button should be disabled
    cy.get('[data-test="header-save-button"]').should('be.disabled');

    // no changes, can switch to view mode
    cy.get('[data-test="dashboard-edit-actions"]')
      .find('[data-test="discard-changes-button"]')
      .should('be.visible')
      .click();
    cy.get('[data-test="dashboard-header"]').within(() => {
      cy.get('[data-test="dashboard-edit-actions"]').should('not.be.visible');
      cy.get('[data-test="edit-alt"]').should('be.visible');
    });
  });
});
