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
import { SAMPLE_DASHBOARD_1 } from 'cypress/utils/urls';
import { interceptFav, interceptUnfav } from './utils';

describe('Dashboard actions', () => {
  beforeEach(() => {
    cy.createSampleDashboards([0]);
    cy.visit(SAMPLE_DASHBOARD_1);
  });
  it('should allow to favorite/unfavorite dashboard', () => {
    interceptFav();
    interceptUnfav();

    // Find and click StarOutlined (adds to favorites)
    cy.getBySel('dashboard-header-container')
      .find("[aria-label='unstarred']")
      .as('starIconOutlined')
      .should('exist')
      .click();

    cy.wait('@select');

    // After clicking, StarFilled should appear
    cy.getBySel('dashboard-header-container')
      .find("[aria-label='starred']")
      .as('starIconFilled')
      .should('exist');

    // Verify the color of the filled star (gold)
    cy.get('@starIconFilled')
      .should('have.css', 'color')
      .and('eq', 'rgb(252, 199, 0)');

    // Click on StarFilled (removes from favorites)
    cy.get('@starIconFilled').click();

    cy.wait('@unselect');

    // After clicking, StarOutlined should reappear
    cy.getBySel('dashboard-header-container')
      .find("[aria-label='unstarred']")
      .as('starIconOutlinedAfter')
      .should('exist');

    // Verify the color of the outlined star (gray)
    cy.get('@starIconOutlinedAfter')
      .should('have.css', 'color')
      .and('eq', 'rgba(0, 0, 0, 0.45)');
  });
});
