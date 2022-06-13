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
import '@cypress/code-coverage/support';
import '@applitools/eyes-cypress/commands';

const BASE_EXPLORE_URL = '/superset/explore/?form_data=';
const TokenName = Cypress.env('TOKEN_NAME');

require('cy-verify-downloads').addCustomCommand();

/* eslint-disable consistent-return */
Cypress.on('uncaught:exception', err => {
  // ignore ResizeObserver client errors, as they are unrelated to operation
  // and causing flaky test failures in CI
  if (err.message && /ResizeObserver loop limit exceeded/.test(err.message)) {
    // returning false here prevents Cypress from failing the test
    return false;
  }
});
/* eslint-enable consistent-return */

Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: '/login/',
    body: { username: 'admin', password: 'general' },
  }).then(response => {
    expect(response.status).to.eq(200);
  });
});

Cypress.Commands.add('visitChartByName', name => {
  cy.request(`/chart/api/read?_flt_3_slice_name=${name}`).then(response => {
    cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${response.body.pks[0]}}`);
  });
});

Cypress.Commands.add('visitChartById', chartId =>
  cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${chartId}}`),
);

Cypress.Commands.add('visitChartByParams', params => {
  const queryString =
    typeof params === 'string' ? params : JSON.stringify(params);
  const url = `${BASE_EXPLORE_URL}${queryString}`;
  return cy.visit(url);
});

Cypress.Commands.add('verifySliceContainer', chartSelector => {
  // After a wait response check for valid slice container
  cy.get('.slice_container')
    .should('be.visible')
    .within(() => {
      if (chartSelector) {
        cy.get(chartSelector)
          .should('be.visible')
          .then(chart => {
            expect(chart[0].clientWidth).greaterThan(0);
            expect(chart[0].clientHeight).greaterThan(0);
          });
      }
    });
  return cy;
});

Cypress.Commands.add(
  'verifySliceSuccess',
  ({
    waitAlias,
    querySubstring,
    chartSelector,
  }: {
    waitAlias: string;
    chartSelector: JQuery.Selector;
    querySubstring?: string | RegExp;
  }) => {
    cy.wait(waitAlias).then(({ response }) => {
      cy.verifySliceContainer(chartSelector);
      const responseBody = response?.body;
      if (querySubstring) {
        const query: string =
          responseBody.query || responseBody.result[0].query || '';
        if (querySubstring instanceof RegExp) {
          expect(query).to.match(querySubstring);
        } else {
          expect(query).to.contain(querySubstring);
        }
      }
    });
    return cy;
  },
);

Cypress.Commands.add('deleteDashboardByName', (name: string) =>
  cy.getDashboards().then((dashboards: any) => {
    dashboards?.forEach((element: any) => {
      if (element.dashboard_title === name) {
        const elementId = element.id;
        cy.deleteDashboard(elementId);
      }
    });
  }),
);

Cypress.Commands.add('deleteDashboard', (id: number) =>
  cy
    .request({
      method: 'DELETE',
      url: `api/v1/dashboard/${id}`,
      headers: {
        Cookie: `csrf_access_token=${window.localStorage.getItem(
          'access_token',
        )}`,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TokenName}`,
        'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
        Referer: `${Cypress.config().baseUrl}/`,
      },
    })
    .then(resp => resp),
);

Cypress.Commands.add('getDashboards', () =>
  cy
    .request({
      method: 'GET',
      url: `api/v1/dashboard/`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TokenName}`,
      },
    })
    .then(resp => resp.body.result),
);

Cypress.Commands.add('deleteChart', (id: number) =>
  cy
    .request({
      method: 'DELETE',
      url: `api/v1/chart/${id}`,
      headers: {
        Cookie: `csrf_access_token=${window.localStorage.getItem(
          'access_token',
        )}`,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TokenName}`,
        'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
        Referer: `${Cypress.config().baseUrl}/`,
      },
      failOnStatusCode: false,
    })
    .then(resp => resp),
);

Cypress.Commands.add('getCharts', () =>
  cy
    .request({
      method: 'GET',
      url: `api/v1/chart/`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TokenName}`,
      },
    })
    .then(resp => resp.body.result),
);

Cypress.Commands.add('deleteChartByName', (name: string) =>
  cy.getCharts().then((slices: any) => {
    slices?.forEach((element: any) => {
      if (element.slice_name === name) {
        const elementId = element.id;
        cy.deleteChart(elementId);
      }
    });
  }),
);
