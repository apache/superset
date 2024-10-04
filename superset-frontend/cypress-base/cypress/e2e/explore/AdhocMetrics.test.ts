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
describe('AdhocMetrics', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('postJson');
    cy.intercept('GET', '/superset/explore_json/**').as('getJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
  });

  it('Clear metric and set simple adhoc metric', () => {
    const metric = 'sum(num_girls)';
    const metricName = 'Sum Girls';
    cy.get('[data-test=metrics]')
      .find('[data-test="remove-control-button"]')
      .click();

    cy.get('[data-test=metrics]')
      .contains('Drop columns/metrics here or click')
      .click();

    // Title edit for saved metrics is disabled - switch to Simple
    cy.get('[id="adhoc-metric-edit-tabs-tab-SIMPLE"]').click();

    cy.get('[data-test="AdhocMetricEditTitle#trigger"]').click();
    cy.get('[data-test="AdhocMetricEditTitle#input"]').type(metricName);

    cy.get('input[aria-label="Select column"]').click();
    cy.get('input[aria-label="Select column"]').type('num_girls{enter}');
    cy.get('input[aria-label="Select aggregate options"]').click();
    cy.get('input[aria-label="Select aggregate options"]').type('sum{enter}');

    cy.get('[data-test="AdhocMetricEdit#save"]').contains('Save').click();

    cy.get('[data-test="control-label"]').contains(metricName);

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metricName}"`, // SQL statement
      chartSelector: 'svg',
    });
  });

  xit('Switch from simple to custom sql', () => {
    cy.get('[data-test=metrics]')
      .find('[data-test="metric-option"]')
      .should('have.length', 1);

    // select column "num"
    cy.get('[data-test=metrics]').find('.Select__clear-indicator').click();

    cy.get('[data-test=metrics]').find('.Select__control').click();

    cy.get('[data-test=metrics]').find('.Select__control input').type('num');

    cy.get('[data-test=metrics]')
      .find('.option-label')
      .first()
      .should('have.text', 'num')
      .click();

    // add custom SQL
    cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
    cy.get('[data-test=metrics-edit-popover]').within(() => {
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type('/COUNT(DISTINCT name)', { force: true });
      cy.get('[data-test="AdhocMetricEdit#save"]').contains('Save').click();
    });

    cy.get('button[data-test="run-query-button"]').click();

    const metric = 'SUM(num)/COUNT(DISTINCT name)';
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
      chartSelector: 'svg',
    });
  });

  xit('Switch from custom sql tabs to simple', () => {
    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__dropdown-indicator').click();
      cy.get('input[type=text]').type('num_girls{enter}');
    });
    cy.get('[data-test=metrics]')
      .find('[data-test="metric-option"]')
      .should('have.length', 2);

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_identifier').contains('num_girls');
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type('{selectall}{backspace}SUM(num)');
      cy.get('#adhoc-metric-edit-tabs-tab-SIMPLE').click();
      cy.get('.Select__single-value').contains(/^num$/);
      cy.get('button').contains('Save').click();
    });

    cy.get('button[data-test="run-query-button"]').click();

    const metric = 'SUM(num)';
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
      chartSelector: 'svg',
    });
  });
});
