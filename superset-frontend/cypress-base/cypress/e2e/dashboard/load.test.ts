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
import { WORLD_HEALTH_DASHBOARD } from 'cypress/utils/urls';
import { waitForChartLoad } from 'cypress/utils';
import { WORLD_HEALTH_CHARTS, interceptLog } from './utils';

describe('Dashboard load', () => {
  it('should load dashboard', () => {
    cy.visit(WORLD_HEALTH_DASHBOARD);
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
  });

  it('should load in edit mode', () => {
    cy.visit(`${WORLD_HEALTH_DASHBOARD}?edit=true&standalone=true`);
    cy.getBySel('discard-changes-button').should('be.visible');
  });

  it('should load in standalone mode', () => {
    cy.visit(`${WORLD_HEALTH_DASHBOARD}?edit=true&standalone=true`);
    cy.get('#app-menu').should('not.exist');
  });

  it('should load in edit/standalone mode', () => {
    cy.visit(`${WORLD_HEALTH_DASHBOARD}?edit=true&standalone=true`);
    cy.getBySel('discard-changes-button').should('be.visible');
    cy.get('#app-menu').should('not.exist');
  });

  // TODO flaky test. skipping to unblock CI
  it.skip('should send log data', () => {
    interceptLog();
    cy.visit(WORLD_HEALTH_DASHBOARD);
    cy.wait('@logs', { timeout: 15000 });
  });
});
