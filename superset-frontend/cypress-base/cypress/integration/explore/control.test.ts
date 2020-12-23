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
// Tests for setting controls in the UI
// ***********************************************
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';

describe('Datasource control', () => {
  const newMetricName = `abc${Date.now()}`;

  // TODO: uncomment when adding metrics from dataset is fixed
  xit('should allow edit dataset', () => {
    let numScripts = 0;

    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test="open-datasource-tab').click({ force: true });
    cy.get('[data-test="datasource-menu-trigger"]').click();

    cy.get('script').then(nodes => {
      numScripts = nodes.length;
    });

    cy.get('[data-test="edit-dataset"]').click();

    // should load additional scripts for the modal
    cy.get('script').then(nodes => {
      expect(nodes.length).to.greaterThan(numScripts);
    });
    cy.get('[data-test="edit-dataset-tabs"]').within(() => {
      cy.contains('Metrics').click();
    });
    // create new metric
    cy.get('[data-test="crud-add-table-item"]', { timeout: 10000 }).click();
    cy.get('[data-test="table-content-rows"]')
      .find('input[value="<new metric>"]')
      .click();
    cy.get('[data-test="table-content-rows"]')
      .find('input[value="<new metric>"]')
      .focus()
      .clear()
      .type(`${newMetricName}{enter}`);
    cy.get('[data-test="datasource-modal-save"]').click();
    cy.get('.ant-modal-confirm-btns button').contains('OK').click();
    // select new metric
    cy.get('[data-test=metrics]')
      .find('.Select__control input')
      .focus()
      .type(newMetricName, { force: true });
    // delete metric
    cy.get('[data-test="datasource-menu-trigger"]').click();
    cy.get('[data-test="edit-dataset"]').click();
    cy.get('.ant-modal-content').within(() => {
      cy.get('[data-test="collection-tab-Metrics"]')
        .contains('Metrics')
        .click();
    });
    cy.get(`input[value="${newMetricName}"]`)
      .closest('tr')
      .find('.fa-trash')
      .click();
    cy.get('[data-test="datasource-modal-save"]').click();
    cy.get('.ant-modal-confirm-btns button').contains('OK').click();
    cy.get('.Select__multi-value__label')
      .contains(newMetricName)
      .should('not.exist');
  });
});

describe('VizType control', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Can change vizType', () => {
    cy.visitChartByName('Daily Totals');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    let numScripts = 0;
    cy.get('script').then(nodes => {
      numScripts = nodes.length;
    });

    cy.get('.Control .label').contains('Table').click();

    cy.get('[role="button"]').contains('Line Chart').click();

    // should load mathjs for line chart
    cy.get('script[src*="mathjs"]').should('have.length', 1);
    cy.get('script').then(nodes => {
      expect(nodes.length).to.greaterThan(numScripts);
    });

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({ waitAlias: '@postJson', chartSelector: 'svg' });
  });
});

describe('Time range filter', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Defaults to the correct tab for time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      metrics: [NUM_METRIC],
      viz_type: 'line',
      time_range: '100 years ago : now',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('.ant-modal-footer')
          .find('button')
          .its('length')
          .should('eq', 3);
        cy.get('.ant-modal-body').within(() => {
          cy.get('input[value="100 years ago"]');
          cy.get('input[value="now"]');
        });
        cy.get('[data-test=modal-cancel-button]').click();
        cy.get('[data-test=time-range-modal]').should('not.be.visible');
      });
  });
});

describe('Groupby control', () => {
  it('Set groupby', () => {
    cy.server();
    cy.login();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=groupby]').within(() => {
      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('state{enter}');
    });
    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({ waitAlias: '@postJson', chartSelector: 'svg' });
  });
});
