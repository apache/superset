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

describe('Datasource control', () => {
  const newMetricName = `abc${Date.now()}`;

  it('should allow edit dataset', () => {
    interceptChart({ legacy: false }).as('chartData');

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test="datasource-menu-trigger"]').click();

    cy.get('[data-test="edit-dataset"]').click();

    cy.get('[data-test="edit-dataset-tabs"]').within(() => {
      cy.contains('Metrics').click();
    });
    // create new metric
    cy.get('[data-test="crud-add-table-item"]', { timeout: 10000 }).click();
    cy.wait(1000);
    cy.get(
      '[data-test="table-content-rows"] [data-test="editable-title-input"]',
    )
      .first()
      .click();

    cy.get(
      '[data-test="table-content-rows"] [data-test="editable-title-input"]',
    )
      .first()
      .focus();
    cy.focused().clear({ force: true });
    cy.focused().type(`${newMetricName}{enter}`, { force: true });

    cy.get('[data-test="datasource-modal-save"]').click();
    cy.get('.antd5-modal-confirm-btns button').contains('OK').click();
    // select new metric
    cy.get('[data-test=metrics]')
      .contains('Drop columns/metrics here or click')
      .click();

    cy.get('input[aria-label="Select saved metrics"]').type(
      `${newMetricName}{enter}`,
    );
    // delete metric
    cy.get('[data-test="datasource-menu-trigger"]').click();
    cy.get('[data-test="edit-dataset"]').click();
    cy.get('.antd5-modal-content').within(() => {
      cy.get('[data-test="collection-tab-Metrics"]')
        .contains('Metrics')
        .click();
    });
    cy.get(`input[value="${newMetricName}"]`)
      .closest('tr')
      .find('[data-test="crud-delete-icon"]')
      .click();
    cy.get('[data-test="datasource-modal-save"]').click();
    cy.get('.antd5-modal-confirm-btns button').contains('OK').click();
    cy.get('[data-test="metrics"]').contains(newMetricName).should('not.exist');
  });
});

describe('Color scheme control', () => {
  beforeEach(() => {
    interceptChart({ legacy: false }).as('chartData');

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });
  });

  it('should show color options with and without tooltips', () => {
    cy.get('#controlSections-tab-display').click();
    cy.get('.ant-select-selection-item .color-scheme-label').contains(
      'Superset Colors',
    );
    cy.get('.ant-select-selection-item .color-scheme-label').trigger(
      'mouseover',
    );
    cy.get('.color-scheme-tooltip').should('be.visible');
    cy.get('.color-scheme-tooltip').contains('Superset Colors');
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]').focus();
    cy.focused().type('lyftColors');
    cy.getBySel('lyftColors').should('exist');
    cy.getBySel('lyftColors').trigger('mouseover');
    cy.get('.color-scheme-tooltip').should('not.exist');
  });
});
describe('VizType control', () => {
  beforeEach(() => {
    interceptChart({ legacy: false }).as('tableChartData');
    interceptChart({ legacy: false }).as('bigNumberChartData');
  });

  it('Can change vizType', () => {
    cy.visitChartByName('Daily Totals');
    cy.verifySliceSuccess({ waitAlias: '@tableChartData' });

    cy.contains('View all charts').click();

    cy.get('.antd5-modal-content').within(() => {
      cy.get('button').contains('KPI').click(); // change categories
      cy.get('[role="button"]').contains('Big Number').click();
      cy.get('button').contains('Select').click();
    });

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@bigNumberChartData',
    });
  });
});

describe('Test datatable', () => {
  beforeEach(() => {
    interceptChart({ legacy: false }).as('tableChartData');
    interceptChart({ legacy: false }).as('lineChartData');
    cy.visitChartByName('Daily Totals');
  });
  it('Data Pane opens and loads results', () => {
    cy.contains('Results').click();
    cy.get('[data-test="row-count-label"]').contains('26 rows');
    cy.get('.ant-empty-description').should('not.exist');
  });
  it('Datapane loads view samples', () => {
    cy.intercept(
      'datasource/samples?force=false&datasource_type=table&datasource_id=*',
    ).as('Samples');
    cy.contains('Samples').click();
    cy.wait('@Samples');
    cy.get('.ant-tabs-tab-active').contains('Samples');
    cy.get('[data-test="row-count-label"]').contains('1k rows');
    cy.get('.ant-empty-description').should('not.exist');
  });
});

describe('Groupby control', () => {
  it('Set groupby', () => {
    interceptChart({ legacy: false }).as('chartData');

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('[data-test=groupby]')
      .contains('Drop columns here or click')
      .click();
    cy.get('[id="adhoc-metric-edit-tabs-tab-simple"]').click();
    cy.get('input[aria-label="Column"]').click();
    cy.get('input[aria-label="Column"]').type('state{enter}');
    cy.get('[data-test="ColumnEdit#save"]').contains('Save').click();

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({ waitAlias: '@chartData' });
  });
});
