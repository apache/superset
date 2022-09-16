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
    cy.createSampleDashboards();
    cy.visit(SAMPLE_DASHBOARD_1);
  });

  it('should allow to favorite/unfavorite dashboard', () => {
    interceptFav();
    interceptUnfav();

    cy.getBySel('dashboard-header-container')
      .find("[aria-label='favorite-unselected']")
      .click();
    cy.wait('@select');
    cy.getBySel('dashboard-header-container')
      .find("[aria-label='favorite-selected']")
      .click();
    cy.wait('@unselect');
    cy.getBySel('dashboard-header-container')
      .find("[aria-label='favorite-selected']")
      .should('not.exist');
  });
});
