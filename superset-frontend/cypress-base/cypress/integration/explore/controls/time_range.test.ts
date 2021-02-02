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
