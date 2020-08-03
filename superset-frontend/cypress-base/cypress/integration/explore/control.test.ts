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

  before(() => {
    cy.server();
    cy.login();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('should allow edit datasource', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    cy.get('#datasource_menu').click();
    cy.get('a').contains('Edit Datasource').click();
    // create new metric
    cy.get('button').contains('Add Item').click();
    cy.get('input[value="<new metric>"]').click();
    cy.get('input[value="<new metric>"]')
      .focus()
      .clear()
      .type(`${newMetricName}{enter}`);
    cy.get('.modal-footer button').contains('Save').click();
    cy.get('.modal-footer button').contains('OK').click();
    // select new metric
    cy.get('[data-test=metrics]')
      .find('.Select__control input')
      .focus()
      .type(newMetricName, { force: true });
    // delete metric
    cy.get('#datasource_menu').click();
    cy.get('a').contains('Edit Datasource').click();
    cy.get(`input[value="${newMetricName}"]`)
      .closest('tr')
      .find('.fa-close')
      .click();
    cy.get('.modal-footer button').contains('Save').click();
    cy.get('.modal-footer button').contains('OK').click();
    cy.get('.Select__multi-value__label')
      .contains(newMetricName)
      .should('not.exist');
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
    cy.get('button.query').click();
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

    cy.get('[data-test=time_range]').within(() => {
      cy.get('span.label').click();
    });

    cy.get('#filter-popover').within(() => {
      cy.get('div.tab-pane.active').within(() => {
        cy.get('div.PopoverSection :not(.dimmed)').within(() => {
          cy.get('input[value="100 years ago"]');
          cy.get('input[value="now"]');
        });
      });
    });
    cy.get('#filter-popover button').contains('Ok').click();
    cy.get('#filter-popover').should('not.exist');
  });
});
