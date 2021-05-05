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

import { DASHBOARD_LIST } from '../dashboard_list/dashboard_list.helper';
import { drag, waitForChartLoad } from './dashboard.helper';

describe('creating a dashboard', () => {
  before(() => {
    cy.login();
  });

  it('should create the dashboard', () => {
    cy.visit(DASHBOARD_LIST);
    cy.contains('.navbar-right button', 'Dashboard').click();
    cy.get('[data-test="editable-title-input"]')
      .click()
      .clear()
      .type('Dashboard Created By Test{enter}');
    // add a chart
    cy.get('[data-test="dashboard-builder-component-pane-tabs-navigation"]')
      .find('.ant-tabs-tab')
      .last()
      .click();
    // find a chart from the list
    cy.get('[data-test="dashboard-charts-filter-search-input"]').type(
      'Daily Totals',
    );
    // https://www.cypress.io/blog/2020/07/22/do-not-get-too-detached/
    cy.get('[data-test="card-title"]').should('have.length', 1);
    // drag the chart onto the page
    drag('[data-test="card-title"]', 'Daily Totals').to(
      '.dashboard-grid .dragdroppable.empty-droptarget',
    );
    cy.contains('[data-test="header-save-button"]', 'Save').click();
    waitForChartLoad({
      name: 'Daily Totals',
      viz: 'table',
    });
    cy.contains(
      '[data-test="editable-title-input"]',
      'Dashboard Created By Test',
    );
  });
});
