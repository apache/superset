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

export default () =>
  describe('favorite dashboard', () => {
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
        cy.get('.favstar').find('i').should('have.class', 'fa-star-o');
        cy.get('.favstar').trigger('click');
        cy.get('.favstar')
          .find('i')
          .should('have.class', 'fa-star')
          .and('not.have.class', 'fa-star-o');
      } else {
        cy.get('.favstar')
          .find('i')
          .should('have.class', 'fa-star')
          .and('not.have.class', 'fa-star-o');
        cy.get('.favstar').trigger('click');
        cy.get('.fave-unfave-icon')
          .find('i')
          .should('have.class', 'fa-star-o')
          .and('not.have.class', 'fa-star');
      }

      // reset to original fav state
      cy.get('.favstar').trigger('click');
    });
  });
