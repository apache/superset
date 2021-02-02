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
import { interceptChart } from 'cypress/utils';
import { FORM_DATA_DEFAULTS, NUM_METRIC } from '../visualizations/constants';

function changeDatasetTo(target: string) {
  // change to a non-timeseries dataset
  cy.get('[data-test=datasource-menu-trigger]').click();
  cy.get('[role=menu] li').contains('Change dataset').click();
  cy.get('[data-test=datasource-link]').contains(target).click({ force: true });
  cy.get('button').contains('Proceed').click();
}

describe('Time column and time granularity', () => {
  beforeEach(() => {
    cy.login();
    interceptChart({ legacy: false }).as('chartData');
    interceptChart({ legacy: true }).as('legacyChartData');
  });

  it('Show time section for Table and FilterBox chart', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      metrics: [NUM_METRIC],
    };
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData' });

    cy.get('.control-panel-section').should('contain', 'Time');
    cy.get('[data-test=granularity_sqla]').contains('Time Column');

    // change to FilterBox
    cy.get('[data-test=visualization-type]').click();
    cy.get('.viztype-selector-container ').contains('Filter box').click();
    // time sections should still be visible, check Filter configuration section
    // exists first to make sure viz type switch was successful
    cy.get('.control-panel-section').contains('Filters configuration');
    cy.get('[data-test=granularity_sqla]').contains('Time Column');

    changeDatasetTo('energy_usage');
    cy.get('[data-test=granularity_sqla]').should('not.exist');
    cy.get('.control-panel-section').should('not.contain', 'Time');

    // change back to a timeseries dataset should add back time section
    changeDatasetTo('birth_names');
    cy.get('[data-test=granularity_sqla]').should('exist');
    cy.get('.control-panel-section').should('contain', 'Time');
  });
});
