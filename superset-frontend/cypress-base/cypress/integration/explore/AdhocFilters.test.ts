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
    cy.intercept('GET', '/superset/filter/table/*/name').as('filterValues');
    cy.intercept('POST', '/superset/explore_json/**').as('postJson');
    cy.intercept('GET', '/superset/explore_json/**').as('getJson');
    cy.visitChartByName('Boys'); // a table chart
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
  });

  let numScripts = 0;

  xit('Should load AceEditor scripts when needed', () => {
    cy.get('script').then(nodes => {
      numScripts = nodes.length;
    });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select__control').scrollIntoView().click();
      cy.get('input[type=text]').focus().type('name{enter}');
      cy.get("div[role='button']").first().click();
    });

    // antd tabs do lazy loading, so we need to click on tab with ace editor
    cy.get('#filter-edit-popover').within(() => {
      cy.get('.ant-tabs-tab').contains('Custom SQL').click();
      cy.get('.ant-tabs-tab').contains('Simple').click();
    });

    cy.get('script').then(nodes => {
      // should load new script chunks for SQL editor
      expect(nodes.length).to.greaterThan(numScripts);
    });
  });

  xit('Set simple adhoc filter', () => {
    cy.get('[aria-label="Comparator option"] .Select__control').click();
    cy.get('[data-test=adhoc-filter-simple-value] input[type=text]')
      .focus()
      .type('Jack{enter}', { delay: 20 });

    cy.get('[data-test="adhoc-filter-edit-popover-save-button"]').click();

    cy.get(
      '[data-test=adhoc_filters] .Select__control span.option-label',
    ).contains('name = Jack');

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });

  xit('Set custom adhoc filter', () => {
    const filterType = 'name';
    const filterContent = "'Amy' OR name = 'Donald'";

    cy.get('[data-test=adhoc_filters] .Select__control')
      .scrollIntoView()
      .click();

    // remove previous input
    cy.get('[data-test=adhoc_filters] input[type=text]')
      .focus()
      .type('{backspace}');

    cy.get('[data-test=adhoc_filters] input[type=text]')
      .focus()
      .type(`${filterType}{enter}`);

    cy.wait('@filterValues');

    // selecting a new filter should auto-open the popup,
    // so the tabshould be visible by now
    cy.get('#filter-edit-popover #adhoc-filter-edit-tabs-tab-SQL').click();
    cy.get('#filter-edit-popover .ace_content').click();
    cy.get('#filter-edit-popover .ace_text-input').type(filterContent);
    cy.get('[data-test="adhoc-filter-edit-popover-save-button"]').click();

    // check if the filter was saved correctly
    cy.get(
      '[data-test=adhoc_filters] .Select__control span.option-label',
    ).contains(`${filterType} = ${filterContent}`);

    cy.get('button[data-test="run-query-button"]').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });
});
