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
import { SAMPLE_DASHBOARD_1 } from 'cypress/utils/urls';
import { drag } from 'cypress/utils';
import { interceptGet } from './utils';
import { interceptFiltering as interceptCharts } from '../explore/utils';

function editDashboard() {
  cy.getBySel('edit-dashboard-button').click();
}

function dragComponent(
  component = 'Unicode Cloud',
  target = 'card-title',
  withFiltering = true,
) {
  if (withFiltering) {
    cy.getBySel('dashboard-charts-filter-search-input').type(component, {
      force: true,
    });
    cy.wait('@filtering');
  }
  cy.wait(500);
  drag(`[data-test="${target}"]`, component).to(
    '[data-test="grid-content"] [data-test="dragdroppable-object"]',
  );
}

function visitEdit(sampleDashboard = SAMPLE_DASHBOARD_1) {
  interceptCharts();
  interceptGet();

  if (sampleDashboard === SAMPLE_DASHBOARD_1) {
    cy.createSampleDashboards([0]);
  }

  cy.visit(sampleDashboard);
  cy.wait('@get');
  editDashboard();
  cy.get('.grid-container').should('exist');
  cy.wait('@filtering');
  cy.wait(500);
}

describe('Dashboard edit', () => {
  describe('Components', () => {
    beforeEach(() => {
      visitEdit();
    });

    it('should add charts', () => {
      cy.get('body').then($body => {
        if ($body.find('.ant-modal-wrap').length > 0) {
          cy.get('body').type('{esc}', { force: true });
          cy.wait(1000);
          cy.get('.ant-modal-close').click({ force: true });
          cy.wait(500);
        }
      });
      cy.get('input[type="checkbox"]').scrollIntoView();
      cy.get('input[type="checkbox"]').click({ force: true });
      dragComponent();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
    });
  });
});
