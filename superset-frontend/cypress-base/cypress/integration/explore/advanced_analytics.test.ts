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
describe('Advanced analytics', () => {
  beforeEach(() => {
    cy.login();
    cy.intercept('GET', '/superset/explore_json/**').as('getJson');
    cy.intercept('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Create custom time compare', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('.ant-collapse-header').contains('Advanced Analytics').click();

    cy.get('[data-test=time_compare]').find('.ant-select').click();
    cy.get('[data-test=time_compare]')
      .find('input[type=search]')
      .type('28 days{enter}');

    cy.get('[data-test=time_compare]')
      .find('input[type=search]')
      .type('1 year{enter}');

    cy.get('button[data-test="run-query-button"]').click();
    cy.wait('@postJson');
    cy.reload();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });

    cy.get('.ant-collapse-header').contains('Advanced Analytics').click();
    cy.get('[data-test=time_compare]')
      .find('.ant-select-selector')
      .contains('28 days');
    cy.get('[data-test=time_compare]')
      .find('.ant-select-selector')
      .contains('1 year');
  });
});
