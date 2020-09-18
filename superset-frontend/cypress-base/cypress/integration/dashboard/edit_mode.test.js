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
    cy.route('POST', '/superset/explore_json/*?dashboard_id=1').as('worldMap');
    cy.get('.dashboard-header [data-test=pencil]').click();
  });

  it('remove, and add chart flow', () => {
    // wait for world map to appear
    cy.wait('@worldMap');
    cy.get('.world_map', { timeout: 60000 })
      .should('have.length', 1)
      .parents('.dashboard-component')
      .should('have.length', 1)
      .then($el => {
        cy.wrap($el).invoke('show').find('.hover-menu .fa.fa-trash').click();
        // world map should be gone
        cy.get('.grid-container .world_map').should('not.exist');
      });

    cy.get('.tabs-components .nav-tabs li a')
      .contains('Charts')
      .should('have.length', 1)
      .click();

    // find world map is available from list
    cy.get('.tabs-components').find('.chart-card-container').contains('Rural');

    drag('.chart-card', 'Rural').to('.grid-row.background--transparent:first');

    // add back to dashboard
    cy.get('.grid-container .world_map').should('be.exist');

    // should show Save changes button
    cy.get('.dashboard-header .button-container').contains('Save');

    // undo 2 steps
    cy.get('.dashboard-header .undo-action').click().click();

    // no changes, can switch to view mode
    cy.get('.dashboard-header .button-container')
      .contains('Discard Changes')
      .click();
  });
});
