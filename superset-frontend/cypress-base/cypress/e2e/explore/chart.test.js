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
import { CHART_LIST } from 'cypress/utils/urls';
import { interceptGet as interceptDashboardGet } from 'cypress/e2e/dashboard/utils';
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';
import {
  interceptFiltering,
  saveChartToDashboard,
  visitSampleChartFromList,
} from './utils';

// SEARCH_THRESHOLD is 10. We need to add at least 11 dashboards to show search
const SAMPLE_DASHBOARDS_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function openDashboardsAddedTo() {
  cy.getBySel('actions-trigger').click();
  cy.get('.ant-dropdown-menu-submenu-title')
    .contains('On dashboards')
    .trigger('mouseover', { force: true });
}

function closeDashboardsAddedTo() {
  cy.get('.ant-dropdown-menu-submenu-title')
    .contains('On dashboards')
    .trigger('mouseout', { force: true });
  cy.getBySel('actions-trigger').click();
}

function verifyDashboardsSubmenuItem(dashboardName) {
  cy.get('.ant-dropdown-menu-submenu-popup').contains(dashboardName);
  closeDashboardsAddedTo();
}

function verifyDashboardSearch() {
  openDashboardsAddedTo();
  cy.get('.ant-dropdown-menu-submenu-popup').trigger('mouseover');
  cy.get('.ant-dropdown-menu-submenu-popup')
    .find('input[placeholder="Search"]')
    .type('1');
  cy.get('.ant-dropdown-menu-submenu-popup').contains('1 - Sample dashboard');
  cy.get('.ant-dropdown-menu-submenu-popup')
    .find('input[placeholder="Search"]')
    .type('Blahblah');
  cy.get('.ant-dropdown-menu-submenu-popup').contains('No results found');
  cy.get('.ant-dropdown-menu-submenu-popup')
    .find('[aria-label="close-circle"]')
    .click();
  closeDashboardsAddedTo();
}

function verifyDashboardLink() {
  interceptDashboardGet();
  openDashboardsAddedTo();
  cy.get('.ant-dropdown-menu-submenu-popup').trigger('mouseover');
  cy.get('.ant-dropdown-menu-submenu-popup a')
    .first()
    .invoke('removeAttr', 'target')
    .click();
  cy.wait('@get');
}

function verifyMetabar(text) {
  cy.getBySel('metadata-bar').contains(text);
}

function saveAndVerifyDashboard(number) {
  saveChartToDashboard(`${number} - Sample dashboard`);
  verifyMetabar(
    number > 1 ? `Added to ${number} dashboards` : 'Added to 1 dashboard',
  );
  openDashboardsAddedTo();
  verifyDashboardsSubmenuItem(`${number} - Sample dashboard`);
}

describe('Cross-referenced dashboards', () => {
  beforeEach(() => {
    interceptFiltering();

    cy.createSampleDashboards(SAMPLE_DASHBOARDS_INDEXES);
    cy.createSampleCharts([0]);
    cy.visit(CHART_LIST);
    cy.wait('@filtering');
  });

  it('should show the cross-referenced dashboards', () => {
    visitSampleChartFromList('1 - Sample chart');

    cy.getBySel('metadata-bar').contains('Not added to any dashboard');
    openDashboardsAddedTo();
    verifyDashboardsSubmenuItem('None');

    saveAndVerifyDashboard('1');
    saveAndVerifyDashboard('2');
    saveAndVerifyDashboard('3');
    saveAndVerifyDashboard('4');
    saveAndVerifyDashboard('5');
    saveAndVerifyDashboard('6');
    saveAndVerifyDashboard('7');
    saveAndVerifyDashboard('8');
    saveAndVerifyDashboard('9');
    saveAndVerifyDashboard('10');
    saveAndVerifyDashboard('11');

    verifyDashboardSearch();
    verifyDashboardLink();
  });
});

describe('No Results', () => {
  beforeEach(() => {
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
