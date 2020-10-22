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
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Clear metric and set simple adhoc metric', () => {
    const metric = 'sum(sum_girls)';
    const metricName = 'Sum Girls';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=metrics]').find('.Select__clear-indicator').click();

    cy.get('[data-test=metrics]')
      .find('.Select__control input')
      .type('sum_girls', { force: true });

    cy.get('[data-test=metrics]')
      .find('.Select__option--is-focused')
      .trigger('mousedown')
      .click();

    cy.get('[data-test="option-label"]').first().click();
    cy.get('[data-test="AdhocMetricEditTitle#trigger"]').click();
    cy.get('[data-test="AdhocMetricEditTitle#input"]').type(metricName);
    cy.get('[data-test="AdhocMetricEdit#save"]').contains('Save').click();

    cy.get('.metrics-select .metric-option').contains(metricName);

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metricName}"`, // SQL statement
      chartSelector: 'svg',
    });
  });

  xit('Switch from simple to custom sql', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    // select column "num"
    cy.get('[data-test=metrics]').find('.Select__clear-indicator').click();

    cy.get('[data-test=metrics]').find('.Select__control').click();

    cy.get('[data-test=metrics]').find('.Select__control input').type('num');

    cy.get('[data-test=metrics]').find('.option-label').last().click();

    // add custom SQL
    cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
    cy.get('#metrics-edit-popover').find('.ace_content').click();
    cy.get('#metrics-edit-popover')
      .find('.ace_text-input')
      .type('/COUNT(DISTINCT name)', { force: true });
    cy.get('#metrics-edit-popover').find('button').contains('Save').click();

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
      cy.get('input[type=text]').type('sum_girls{enter}');
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_identifier').contains('sum_girls');
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

  xit('Typing starts with aggregate function name', () => {
    // select column "num"
    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__dropdown-indicator').click();
      cy.get('.Select__control input[type=text]').type('avg(');
      cy.get('.Select__option').contains('ds');
      cy.get('.Select__option').contains('name');
      cy.get('.Select__option').contains('sum_boys').click();
    });

    const metric = 'AVG(sum_boys)';
    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
      chartSelector: 'svg',
    });
  });
});
