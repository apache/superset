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
  WORLD_HEALTH_CHARTS,
  WORLD_HEALTH_DASHBOARD,
  VIDEO_GAME_SALES_CHARTS,
  waitForChartLoad,
} from './dashboard.helper';

describe('Dashboard SPA navigation', () => {
  before(() => {
    cy.login();
  });

  it('navigates to a dashboard, then to the list page, then another dashboard', () => {
    cy.visit(WORLD_HEALTH_DASHBOARD);
    cy.contains('[data-test="dashboard-header"]', "World Bank's Data");
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    // go to the dashboard list
    cy.contains('.navbar a', 'Dashboards').click();
    cy.get('[data-test="search-input"]')
      .click()
      .type(`Video Game Sales{enter}`);
    // loading search results can unmount the targeted element,
    // screwing up the click, so switch to card view
    cy.get('[data-test="card-view"]').click();
    // go to video games dashboard
    cy.contains('a', 'Video Game Sales').click();
    cy.contains('[data-test="dashboard-header"]', 'Video Game Sales');
    VIDEO_GAME_SALES_CHARTS.forEach(waitForChartLoad);
  });
});
