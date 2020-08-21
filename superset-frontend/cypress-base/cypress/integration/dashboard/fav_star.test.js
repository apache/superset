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
import {
  WORLD_HEALTH_DASHBOARD,
  CHECK_DASHBOARD_FAVORITE_ENDPOINT,
} from './dashboard.helper';

describe('Dashboard add to favorite', () => {
  let isFavoriteDashboard = false;

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.route(CHECK_DASHBOARD_FAVORITE_ENDPOINT).as('countFavStar');
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.wait('@countFavStar').then(xhr => {
      isFavoriteDashboard = xhr.response.body.count === 1;
    });
  });

  it('should allow favor/unfavor', () => {
    if (!isFavoriteDashboard) {
      cy.get('a.fave-unfave-icon')
        .find('svg')
        .should('have.attr', 'data-test', 'favorite-unselected');
      cy.get('a.fave-unfave-icon').trigger('click');
      cy.get('a.fave-unfave-icon')
        .find('svg')
        .should('have.attr', 'data-test', 'favorite-selected')
        .and('not.have.attr', 'data-test', 'favorite-unselected');
    } else {
      cy.get('a.fave-unfave-icon')
        .find('svg')
        .should('have.attr', 'data-test', 'favorite-unselected')
        .and('not.have.attr', 'data-test', 'favorite-selected');
      cy.get('a.fave-unfave-icon').trigger('click');
      cy.get('a.fave-unfave-icon')
        .find('svg')
        .should('have.attr', 'data-test', 'favorite-unselected')
        .and('not.have.attr', 'data-test', 'favorite-selected');
    }

    // reset to original fav state
    cy.get('a.fave-unfave-icon').trigger('click');
  });
});
