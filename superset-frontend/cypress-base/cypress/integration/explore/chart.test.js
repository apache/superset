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
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';
import { CHART_LIST } from 'cypress/utils/urls';
import {interceptFiltering} from './utils';

function visitSampleChart(id) {
  cy.getBySel('table-row').first().contains(`${id} - Sample chart`).click();
  cy.intercept('POST', '/superset/explore_json/**').as('getJson');
}

function selectDashboard(dashboardName) {
  cy.get(
    '[data-test="save-chart-modal-select-dashboard-form"] [aria-label="Select a dashboard"]',
  )
    .first()
    .click();
  cy.get(`.ant-select-item-option[title="${dashboardName}"]`).click();
}

function saveToDashboard(dashboardName) {
  cy.getBySel("query-save-button").click();
  selectDashboard(dashboardName);
  cy.getBySel("btn-modal-save").click();
}

function openDashboardsAddedTo() {
  cy.getBySel("actions-trigger").click();
  cy.get(".ant-dropdown-menu-submenu-title").first().trigger("mouseover");
}

function verifySubmenuItem(itemName) {
  cy.get(".ant-dropdown-menu-submenu-popup").contains(itemName).trigger("mouseout");
}

function verifyMetabar(text) {
  cy.getBySel("metadata-bar").contains(text);
}

describe('Cross-referenced dashboards', () => {
  beforeEach(() => {
    interceptFiltering();

    cy.preserveLogin();
    cy.visit(CHART_LIST);
    cy.wait("@filtering");
  });

  before(() => {
    cy.createSampleDashboards();
    cy.createSampleCharts();
  });

  it('Shows the cross referenced dashboards', () => {
    visitSampleChart(4);

    cy.getBySel("metadata-bar").contains("Not added to any dashboard");
    openDashboardsAddedTo();
    verifySubmenuItem("None");

    saveToDashboard("1 - Sample dashboard");
    verifyMetabar("Added to 1 dashboard(s)");
    openDashboardsAddedTo();
    verifySubmenuItem("1 - Sample dashboard");

    saveToDashboard("2 - Sample dashboard");
    verifyMetabar("Added to 2 dashboard(s)");
    openDashboardsAddedTo();
    verifySubmenuItem("2 - Sample dashboard");

    saveToDashboard("3 - Sample dashboard");
    verifyMetabar("Added to 3 dashboard(s)");
    openDashboardsAddedTo();
    verifySubmenuItem("3 - Sample dashboard");

    saveToDashboard("4 - Sample dashboard");
    verifyMetabar("Added to 4 dashboard(s)");
    openDashboardsAddedTo();
    verifySubmenuItem("4 - Sample dashboard");

  });
});

describe('No Results', () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  it('No results message shows up', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      metrics: [NUM_METRIC],
      viz_type: 'line',
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'state',
          operator: 'IN',
          comparator: ['Fake State'],
          clause: 'WHERE',
          sqlExpression: null,
        },
      ],
    };

    cy.visitChartByParams(formData);
    cy.wait('@getJson').its('response.statusCode').should('eq', 200);
    cy.get('div.chart-container').contains(
      'No results were returned for this query',
    );
  });
});
