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
  interceptGet as interceptDashboardGet,
  interceptDashboardasync,
} from '../dashboard/utils';

export function interceptFiltering() {
  cy.intercept('GET', `/api/v1/chart/?q=*`).as('filtering');
}

export function interceptBulkDelete() {
  cy.intercept('DELETE', `/api/v1/chart/?q=*`).as('bulkDelete');
}

export function interceptDelete() {
  cy.intercept('DELETE', `/api/v1/chart/*`).as('delete');
}

export function interceptUpdate() {
  cy.intercept('PUT', `/api/v1/chart/*`).as('update');
}

export function interceptPost() {
  cy.intercept('POST', `/api/v1/chart/`).as('post');
}

export function interceptExploreJson() {
  cy.intercept('POST', `/superset/explore_json/**`).as('getJson');
}

export function interceptExploreGet() {
  cy.intercept('GET', `/api/v1/explore/?slice_id=**`).as('getExplore');
}

export function setFilter(filter: string, option: string) {
  interceptFiltering();

  cy.get(`[aria-label="${filter}"]`).first().click();
  cy.get(`[aria-label="${filter}"] [title="${option}"]`).click();

  cy.wait('@filtering');
}

export function saveChartToDashboard(dashboardName: string) {
  interceptDashboardGet();
  interceptDashboardasync();
  interceptUpdate();
  interceptExploreGet();

  cy.getBySel('query-save-button').click();
  cy.wait('@getDashboardasync');
  cy.getBySelLike('chart-modal').should('be.visible');
  cy.get(
    '[data-test="save-chart-modal-select-dashboard-form"] [aria-label="Select a dashboard"]',
  )
    .first()
    .click();
  cy.get(
    '.ant-select-selection-search-input[aria-label="Select a dashboard"]',
  ).type(dashboardName.slice(0, 3));
  cy.get(`.ant-select-item-option[title="${dashboardName}"]`).click();
  cy.getBySel('btn-modal-save').click();

  cy.wait('@update');
  cy.wait('@get');
  cy.wait('@getExplore');
}

export function visitSampleChartFromList(chartName: string) {
  cy.getBySel('table-row').contains(chartName).click();
  cy.intercept('POST', '/superset/explore_json/**').as('getJson');
}
