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

import { interceptGet as interceptDashboardGet } from '../dashboard/utils';

export function interceptFiltering() {
  cy.intercept('GET', `**/api/v1/chart/?q=*`).as('filtering');
}

export function interceptBulkDelete() {
  cy.intercept('DELETE', `**/api/v1/chart/?q=*`).as('bulkDelete');
}

export function interceptDelete() {
  cy.intercept('DELETE', `**/api/v1/chart/*`).as('delete');
}

export function interceptFavoriteStatus() {
  cy.intercept('GET', '**/api/v1/chart/favorite_status/*').as('favoriteStatus');
}

export function interceptUpdate() {
  cy.intercept('PUT', `**/api/v1/chart/*`).as('update');
}

export const interceptV1ChartData = (alias = 'v1Data') => {
  cy.intercept('**/api/v1/chart/data*').as(alias);
};

export function interceptExploreJson(alias = 'getJson') {
  cy.intercept('POST', `**/superset/explore_json/**`).as(alias);
}

export const interceptFormDataKey = () => {
  cy.intercept('POST', '**/api/v1/explore/form_data').as('formDataKey');
};

export function interceptExploreGet() {
  cy.intercept({
    method: 'GET',
    url: /.*\/api\/v1\/explore\/\?(form_data_key|dashboard_page_id|slice_id)=.*/,
  }).as('getExplore');
}

export function setFilter(filter: string, option: string) {
  interceptFiltering();

  cy.get(`[aria-label^="${filter}"]`).first().click();
  cy.get(`.ant-select-item-option[title="${option}"]`).first().click({
    force: true,
  });

  cy.wait('@filtering');
}

export function saveChartToDashboard(chartName: string, dashboardName: string) {
  interceptDashboardGet();
  interceptUpdate();
  interceptExploreGet();

  cy.getBySel('query-save-button')
    .should('be.enabled')
    .should('not.be.disabled')
    .click({ force: true });

  cy.getBySel('save-modal-body')
    .should('be.visible')
    .then($modal => {
      cy.wait(500);
      cy.wrap($modal)
        .find(
          '.ant-select-selection-search-input[aria-label*="Select a dashboard"]',
        )
        .type(dashboardName, { force: true });
      cy.wrap($modal)
        .find(`.ant-select-item-option[title="${dashboardName}"]`)
        .click();
      cy.getBySel('btn-modal-save').click();
      cy.wait('@update');
    });
  cy.getBySel('save-modal-body').should('not.exist');
  cy.getBySel('query-save-button').should('be.disabled');
  cy.wait('@get');
  cy.wait('@getExplore');
  cy.contains(`was added to dashboard [${dashboardName}]`);
  cy.contains(`Chart [${chartName}] has been overwritten`);
  cy.getBySel('query-save-button').should('be.enabled');
}

export function visitSampleChartFromList(chartName: string) {
  cy.getBySel('table-row').contains(chartName).click();
  cy.intercept('POST', '**/superset/explore_json/**').as('getJson');
}
