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
import { interceptChart } from 'cypress/utils';
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';

describe('Datasource control', () => {
  const newMetricName = `abc${Date.now()}`;

  // TODO: uncomment when adding metrics from dataset is fixed
  xit('should allow edit dataset', () => {
    let numScripts = 0;

    cy.login();
    interceptChart({ legacy: false }).as('chartData');

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

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
    interceptChart({ legacy: false }).as('tableChartData');
    interceptChart({ legacy: true }).as('lineChartData');
  });

  it('Can change vizType', () => {
    cy.visitChartByName('Daily Totals');
    cy.verifySliceSuccess({ waitAlias: '@tableChartData' });

    cy.get('[data-test="visualization-type"]').contains('Table').click();

    cy.get('button').contains('Evolution').click(); // change categories
    cy.get('[role="button"]').contains('Line Chart').click();
    cy.get('button').contains('Select').click();

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@lineChartData',
      chartSelector: 'svg',
    });
  });
});

describe('Test datatable', () => {
  beforeEach(() => {
    cy.login();
    interceptChart({ legacy: false }).as('tableChartData');
    interceptChart({ legacy: true }).as('lineChartData');
    cy.visitChartByName('Daily Totals');
  });
  it('Data Pane opens and loads results', () => {
    cy.get('[data-test="data-tab"]').click();
    cy.get('[data-test="row-count-label"]').contains('26 rows retrieved');
    cy.contains('View results');
    cy.get('.ant-empty-description').should('not.exist');
  });
  it('Datapane loads view samples', () => {
    cy.get('[data-test="data-tab"]').click();
    cy.contains('View samples').click();
    cy.get('[data-test="row-count-label"]').contains('10k rows retrieved');
    cy.get('.ant-empty-description').should('not.exist');
  });
});

describe('Time range filter', () => {
  beforeEach(() => {
    cy.login();
    interceptChart({ legacy: true }).as('chartData');
  });

  it('Advanced time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'line',
      time_range: '100 years ago : now',
      metrics: [NUM_METRIC],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('.footer').find('button').its('length').should('eq', 2);
        cy.get('.ant-popover-content').within(() => {
          cy.get('input[value="100 years ago"]');
          cy.get('input[value="now"]');
        });
        cy.get('[data-test=cancel-button]').click();
        cy.get('.ant-popover').should('not.be.visible');
      });
  });

  it('Common time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'line',
      metrics: [NUM_METRIC],
      time_range: 'Last year',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('.ant-radio-group').children().its('length').should('eq', 5);
        cy.get('.ant-radio-checked + span').contains('last year');
        cy.get('[data-test=cancel-button]').click();
      });
  });

  it('Previous time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'line',
      metrics: [NUM_METRIC],
      time_range: 'previous calendar month',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('.ant-radio-group').children().its('length').should('eq', 3);
        cy.get('.ant-radio-checked + span').contains('previous calendar month');
        cy.get('[data-test=cancel-button]').click();
      });
  });

  it('Custom time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'line',
      metrics: [NUM_METRIC],
      time_range: 'DATEADD(DATETIME("today"), -7, day) : today',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('[data-test=custom-frame]').then(() => {
          cy.get('.ant-input-number-input-wrap > input')
            .invoke('attr', 'value')
            .should('eq', '7');
        });
        cy.get('[data-test=cancel-button]').click();
      });
  });

  it('No filter time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'line',
      metrics: [NUM_METRIC],
      time_range: 'No filter',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=time-range-trigger]')
      .click()
      .then(() => {
        cy.get('[data-test=no-filter]');
      });
    cy.get('[data-test=cancel-button]').click();
  });
});

describe('Groupby control', () => {
  it('Set groupby', () => {
    cy.login();
    interceptChart({ legacy: true }).as('chartData');

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=groupby]').within(() => {
      cy.get('.ant-select').click();
      cy.get('input[type=search]').type('state{enter}');
    });
    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'svg' });
  });
});
