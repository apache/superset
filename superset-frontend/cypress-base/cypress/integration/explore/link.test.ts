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
// ***********************************************
// Tests for links in the explore UI
// ***********************************************

import rison from 'rison';
import shortid from 'shortid';
import { interceptChart } from 'cypress/utils';
import { HEALTH_POP_FORM_DATA_DEFAULTS } from './visualizations/shared.helper';

const apiURL = (endpoint: string, queryObject: Record<string, unknown>) =>
  `${endpoint}?q=${rison.encode(queryObject)}`;

describe('Test explore links', () => {
  beforeEach(() => {
    cy.login();
    interceptChart({ legacy: true }).as('chartData');
  });

  it('Open and close view query modal', () => {
    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('div#query').click();
    cy.get('span').contains('View query').parent().click();
    cy.wait('@chartData').then(() => {
      cy.get('code');
    });
    cy.get('.ant-modal-content').within(() => {
      cy.get('button.ant-modal-close').first().click({ force: true });
    });
  });

  it('Test iframe link', () => {
    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=embed-code-button]').click();
    cy.get('#embed-code-popover').within(() => {
      cy.get('textarea[name=embedCode]').contains('iframe');
    });
  });

  it('Test chart save as AND overwrite', () => {
    interceptChart({ legacy: false }).as('tableChartData');

    const formData = {
      ...HEALTH_POP_FORM_DATA_DEFAULTS,
      viz_type: 'table',
      metrics: ['sum__SP_POP_TOTL'],
      groupby: ['country_name'],
    };
    const newChartName = `Test chart [${shortid.generate()}]`;

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@tableChartData' });
    cy.url().then(() => {
      cy.get('[data-test="query-save-button"]').click();
      cy.get('[data-test="saveas-radio"]').check();
      cy.get('[data-test="new-chart-name"]').type(newChartName);
      cy.get('[data-test="btn-modal-save"]').click();
      cy.verifySliceSuccess({ waitAlias: '@tableChartData' });
      cy.visitChartByName(newChartName);

      // Overwriting!
      cy.get('[data-test="query-save-button"]').click();
      cy.get('[data-test="save-overwrite-radio"]').check();
      cy.get('[data-test="btn-modal-save"]').click();
      cy.verifySliceSuccess({ waitAlias: '@tableChartData' });
      const query = {
        filters: [
          {
            col: 'slice_name',
            opr: 'eq',
            value: newChartName,
          },
        ],
      };

      cy.request(apiURL('/api/v1/chart/', query)).then(response => {
        expect(response.body.count).equals(1);
        cy.request('DELETE', `/api/v1/chart/${response.body.ids[0]}`);
      });
    });
  });

  it('Test chart save as and add to new dashboard', () => {
    const chartName = 'Growth Rate';
    const newChartName = `${chartName} [${shortid.generate()}]`;
    const dashboardTitle = `Test dashboard [${shortid.generate()}]`;

    cy.visitChartByName(chartName);
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test="query-save-button"]').click();
    cy.get('[data-test="saveas-radio"]').check();
    cy.get('[data-test="new-chart-name"]').click().clear().type(newChartName);
    // Add a new option using the "CreatableSelect" feature
    cy.get('[data-test="save-chart-modal-select-dashboard-form"]')
      .find('input[aria-label="Select a dashboard"]')
      .type(`${dashboardTitle}`, { force: true });

    cy.get(`.ant-select-item[label="${dashboardTitle}"]`).click({
      force: true,
    });

    cy.get('[data-test="btn-modal-save"]').click();
    cy.verifySliceSuccess({ waitAlias: '@chartData' });
    let query = {
      filters: [
        {
          col: 'dashboard_title',
          opr: 'eq',
          value: dashboardTitle,
        },
      ],
    };
    cy.request(apiURL('/api/v1/dashboard/', query)).then(response => {
      expect(response.body.count).equals(1);
    });

    cy.visitChartByName(newChartName);
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test="query-save-button"]').click();
    cy.get('[data-test="save-overwrite-radio"]').check();
    cy.get('[data-test="new-chart-name"]').click().clear().type(newChartName);
    // This time around, typing the same dashboard name
    // will select the existing one
    cy.get('[data-test="save-chart-modal-select-dashboard-form"]')
      .find('input[aria-label="Select a dashboard"]')
      .type(`${dashboardTitle}{enter}`, { force: true });

    cy.get(`.ant-select-item[label="${dashboardTitle}"]`).click({
      force: true,
    });

    cy.get('[data-test="btn-modal-save"]').click();
    cy.verifySliceSuccess({ waitAlias: '@chartData' });
    query = {
      filters: [
        {
          col: 'slice_name',
          opr: 'eq',
          value: chartName,
        },
      ],
    };
    cy.request(apiURL('/api/v1/chart/', query)).then(response => {
      expect(response.body.count).equals(1);
    });
    query = {
      filters: [
        {
          col: 'dashboard_title',
          opr: 'eq',
          value: dashboardTitle,
        },
      ],
    };
    cy.request(apiURL('/api/v1/dashboard/', query)).then(response => {
      expect(response.body.count).equals(1);
    });
  });
});
