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
describe('AdhocFilters', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
    cy.route('GET', '/superset/filter/table/*/name').as('filterValues');
  });

  it('Set simple adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select__control').click();
      cy.get('input[type=text]').focus().type('name{enter}');
    });
    cy.get('#filter-edit-popover').within(() => {
      cy.get('[data-test=adhoc-filter-simple-value]').within(() => {
        cy.get('.Select__control').click();
        cy.get('input[type=text]').focus().type('Any{enter}');
      });
      cy.get('button').contains('Save').click();
    });

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });

  it('Set custom adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select__control').click();
      cy.get('input[type=text]').focus().type('name{enter}');
    });

    cy.wait('@filterValues');

    cy.get('#filter-edit-popover').within(() => {
      cy.get('#adhoc-filter-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type("'Amy' OR name = 'Bob'");
      cy.get('button').contains('Save').click();
    });

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });
});
