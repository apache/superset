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
import failOnConsoleError from 'cypress-fail-on-console-error';
import { expect } from 'chai';
import rison from 'rison';

/* eslint-disable @typescript-eslint/no-explicit-any */

require('cy-verify-downloads').addCustomCommand();

// fail on console error, allow config to override individual tests
// these exceptions are a little pile of tech debt
//

// DISABLING FOR NOW
/*
const { getConfig, setConfig } = failOnConsoleError({
  consoleMessages: [
    /\[webpack-dev-server\]/,
    'The pseudo class ":first-child" is potentially unsafe when doing server-side rendering. Try changing it to ":first-of-type".',
    'The pseudo class ":nth-child" is potentially unsafe when doing server-side rendering. Try changing it to ":nth-of-type".',
    'Error: Unknown Error',
    /Unable to infer path to ace from script src/,
  ],
  includeConsoleTypes: ['error'],
});
*/

// Set individual tests to allow certain console errors to NOT fail, e.g
// cy.allowConsoleErrors(['foo', /^some bar-regex.*/]);
// This will be reset between tests.
Cypress.Commands.addAll({
  getConsoleMessages: () => cy.wrap(getConfig()?.consoleMessages),
  allowConsoleErrors: (consoleMessages: (string | RegExp)[]) =>
    setConfig({ ...getConfig(), consoleMessages }),
});

const BASE_EXPLORE_URL = '/explore/?form_data=';
let DASHBOARD_FIXTURES: Record<string, any>[] = [];
let CHART_FIXTURES: Record<string, any>[] = [];

Cypress.Commands.add('loadChartFixtures', () =>
  cy.fixture('charts.json').then(charts => {
    CHART_FIXTURES = charts;
  }),
);

Cypress.Commands.add('loadDashboardFixtures', () =>
  cy.fixture('dashboards.json').then(dashboards => {
    DASHBOARD_FIXTURES = dashboards;
  }),
);

before(() => {
  cy.login();
  Cypress.Cookies.defaults({ preserve: 'session' });
  cy.loadChartFixtures();
  cy.loadDashboardFixtures();
});

beforeEach(() => {
  cy.cleanDashboards();
  cy.cleanCharts();
});

Cypress.Commands.add('cleanDashboards', () => {
  cy.getDashboards().then((sampleDashboards?: Record<string, any>[]) => {
    const deletableDashboards = [];
    for (let i = 0; i < DASHBOARD_FIXTURES.length; i += 1) {
      const fixture = DASHBOARD_FIXTURES[i];
      const isInDb = sampleDashboards?.find(
        d => d.dashboard_title === fixture.dashboard_title,
      );
      if (isInDb) {
        deletableDashboards.push(isInDb.id);
      }
    }
    if (deletableDashboards.length) {
      cy.request({
        failOnStatusCode: false,
        method: 'DELETE',
        url: `api/v1/dashboard/?q=!(${deletableDashboards.join(',')})`,
        headers: {
          Cookie: `csrf_access_token=${window.localStorage.getItem(
            'access_token',
          )}`,
          'Content-Type': 'application/json',
          'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
          Referer: `${Cypress.config().baseUrl}/`,
        },
      }).then(resp => resp);
    }
  });
});

Cypress.Commands.add('cleanCharts', () => {
  cy.getCharts().then((sampleCharts?: Record<string, any>[]) => {
    const deletableCharts = [];
    for (let i = 0; i < CHART_FIXTURES.length; i += 1) {
      const fixture = CHART_FIXTURES[i];
      const isInDb = sampleCharts?.find(
        c => c.slice_name === fixture.slice_name,
      );
      if (isInDb) {
        deletableCharts.push(isInDb.id);
      }
    }
    if (deletableCharts.length) {
      cy.request({
        failOnStatusCode: false,
        method: 'DELETE',
        url: `api/v1/chart/?q=!(${deletableCharts.join(',')})`,
        headers: {
          Cookie: `csrf_access_token=${window.localStorage.getItem(
            'access_token',
          )}`,
          'Content-Type': 'application/json',
          'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
          Referer: `${Cypress.config().baseUrl}/`,
        },
      }).then(resp => resp);
    }
  });
});

Cypress.Commands.add('getBySel', (selector, ...args) =>
  cy.get(`[data-test=${selector}]`, ...args),
);

Cypress.Commands.add('getBySelLike', (selector, ...args) =>
  cy.get(`[data-test*=${selector}]`, ...args),
);

/* eslint-disable consistent-return */
Cypress.on('uncaught:exception', err => {
  // ignore ResizeObserver client errors, as they are unrelated to operation
  // and causing flaky test failures in CI
  if (err.message && /ResizeObserver loop limit exceeded/.test(err.message)) {
    // returning false here prevents Cypress from failing the test
    return false;
  }

  return false; // TODO:@geido remove
});
/* eslint-enable consistent-return */

Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: '/login/',
    body: { username: 'admin', password: 'general' },
  }).then(response => {
    if (response.status === 302) {
      // If there's a redirect, follow it manually
      const redirectUrl = response.headers.location;
      cy.request({
        method: 'GET',
        url: redirectUrl,
      }).then(finalResponse => {
        expect(finalResponse.status).to.eq(200);
      });
    } else {
      expect(response.status).to.eq(200);
    }
  });
});

Cypress.Commands.add('visitChartByName', name => {
  const query = rison.encode({
    columns: ['id'],
    filters: [{ col: 'slice_name', opr: 'eq', value: name }],
  });
  cy.request(`/api/v1/chart?q=${query}`).then(response => {
    cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${response.body.result[0].id}}`);
  });
});

Cypress.Commands.add('visitChartById', chartId =>
  cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${chartId}}`),
);

Cypress.Commands.add(
  'visitChartByParams',
  (formData: {
    datasource?: string;
    datasource_id?: number;
    datasource_type?: string;
    [key: string]: unknown;
  }) => {
    let datasource_id;
    let datasource_type;
    if (formData.datasource_id && formData.datasource_type) {
      ({ datasource_id, datasource_type } = formData);
    } else {
      [datasource_id, datasource_type] = formData.datasource?.split('__') || [];
    }
    const accessToken = window.localStorage.getItem('access_token');
    cy.request({
      method: 'POST',
      url: 'api/v1/explore/form_data',
      body: {
        datasource_id,
        datasource_type,
        form_data: JSON.stringify(formData),
      },
      headers: {
        ...(accessToken && {
          Cookie: `csrf_access_token=${accessToken}`,
          'X-CSRFToken': accessToken,
        }),
        'Content-Type': 'application/json',
        Referer: `${Cypress.config().baseUrl}/`,
      },
    }).then(response => {
      const formDataKey = response.body.key;
      const url = `/explore/?form_data_key=${formDataKey}`;
      cy.visit(url);
    });
  },
);

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

Cypress.Commands.add('createSampleDashboards', (indexes?: number[]) =>
  cy.cleanDashboards().then(() => {
    for (let i = 0; i < DASHBOARD_FIXTURES.length; i += 1) {
      if (indexes?.includes(i) || !indexes) {
        cy.request({
          method: 'POST',
          url: `/api/v1/dashboard/`,
          body: DASHBOARD_FIXTURES[i],
          failOnStatusCode: false,
          headers: {
            Cookie: `csrf_access_token=${window.localStorage.getItem(
              'access_token',
            )}`,
            'Content-Type': 'application/json',
            'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
            Referer: `${Cypress.config().baseUrl}/`,
          },
        });
      }
    }
  }),
);

Cypress.Commands.add('createSampleCharts', (indexes?: number[]) =>
  cy.cleanCharts().then(() => {
    for (let i = 0; i < CHART_FIXTURES.length; i += 1) {
      if (indexes?.includes(i) || !indexes) {
        cy.request({
          method: 'POST',
          url: `/api/v1/chart/`,
          body: CHART_FIXTURES[i],
          failOnStatusCode: false,
          headers: {
            Cookie: `csrf_access_token=${window.localStorage.getItem(
              'access_token',
            )}`,
            'Content-Type': 'application/json',
            'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
            Referer: `${Cypress.config().baseUrl}/`,
          },
        });
      }
    }
  }),
);

Cypress.Commands.add(
  'deleteDashboardByName',
  (dashboardName: string, failOnStatusCode = false) =>
    cy.getDashboards().then((sampleDashboards?: Record<string, any>[]) => {
      const dashboard = sampleDashboards?.find(
        d => d.dashboard_title === dashboardName,
      );
      if (dashboard) {
        cy.deleteDashboard(dashboard.id, failOnStatusCode);
      }
    }),
);

Cypress.Commands.add(
  'deleteDashboard',
  (id: number, failOnStatusCode = false) =>
    cy
      .request({
        failOnStatusCode,
        method: 'DELETE',
        url: `api/v1/dashboard/${id}`,
        headers: {
          Cookie: `csrf_access_token=${window.localStorage.getItem(
            'access_token',
          )}`,
          'Content-Type': 'application/json',
          'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
          Referer: `${Cypress.config().baseUrl}/`,
        },
      })
      .then(resp => resp),
);

Cypress.Commands.add('getDashboards', () => {
  cy.request({
    method: 'GET',
    url: `api/v1/dashboard/`,
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(resp => resp.body.result);
});

Cypress.Commands.add('getDashboard', (dashboardId: string | number) =>
  cy
    .request({
      method: 'GET',
      url: `api/v1/dashboard/${dashboardId}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(resp => resp.body.result),
);

Cypress.Commands.add(
  'updateDashboard',
  (dashboardId: number, body: Record<string, any>) =>
    cy
      .request({
        method: 'PUT',
        url: `api/v1/dashboard/${dashboardId}`,
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .then(resp => resp.body.result),
);

Cypress.Commands.add('deleteChart', (id: number, failOnStatusCode = false) =>
  cy
    .request({
      failOnStatusCode,
      method: 'DELETE',
      url: `api/v1/chart/${id}`,
      headers: {
        Cookie: `csrf_access_token=${window.localStorage.getItem(
          'access_token',
        )}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': `${window.localStorage.getItem('access_token')}`,
        Referer: `${Cypress.config().baseUrl}/`,
      },
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
      },
    })
    .then(resp => resp.body.result),
);

Cypress.Commands.add(
  'deleteChartByName',
  (sliceName: string, failOnStatusCode = false) =>
    cy.getCharts().then((sampleCharts?: Record<string, any>[]) => {
      const chart = sampleCharts?.find(c => c.slice_name === sliceName);
      if (chart) {
        cy.deleteChart(chart.id, failOnStatusCode);
      }
    }),
);
