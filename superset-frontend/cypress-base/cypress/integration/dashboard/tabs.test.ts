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
import { parsePostForm } from 'cypress/utils';
import {
  TABBED_DASHBOARD,
  waitForChartLoad,
  getChartAliasBySpec,
} from './dashboard.helper';

const TREEMAP = { name: 'Treemap', viz: 'treemap' };
const FILTER_BOX = { name: 'Region Filter', viz: 'filter_box' };
const LINE_CHART = { name: 'Growth Rate', viz: 'line' };
const BOX_PLOT = { name: 'Box plot', viz: 'box_plot' };

describe('Dashboard tabs', () => {
  // cypress can not handle window.scrollTo
  // https://github.com/cypress-io/cypress/issues/2761
  // add this exception handler to pass test
  const handleException = () => {
    // return false to prevent the error from
    // failing this test
    cy.on('uncaught:exception', () => false);
  };

  beforeEach(() => {
    cy.login();

    cy.visit(TABBED_DASHBOARD);
  });

  it('should switch active tab on click', () => {
    waitForChartLoad(FILTER_BOX);
    waitForChartLoad(TREEMAP);

    cy.get('[data-test="dashboard-component-tabs"]')
      .first()
      .find('[data-test="nav-list"] .ant-tabs-nav-list > .ant-tabs-tab')
      .as('top-level-tabs');

    cy.get('@top-level-tabs')
      .first()
      .click()
      .should('have.class', 'ant-tabs-tab-active');
    cy.get('@top-level-tabs')
      .last()
      .should('not.have.class', 'ant-tabs-tab-active');

    cy.get('@top-level-tabs')
      .last()
      .click()
      .should('have.class', 'ant-tabs-tab-active');
    cy.get('@top-level-tabs')
      .first()
      .should('not.have.class', 'ant-tabs-tab-active');
  });

  it('should load charts when tab is visible', () => {
    // landing in first tab, should see 2 charts
    waitForChartLoad(FILTER_BOX);
    waitForChartLoad(TREEMAP);
    cy.get('[data-test="grid-container"]')
      .find('.box_plot')
      .should('not.exist');
    cy.get('[data-test="grid-container"]').find('.line').should('not.exist');

    // click row level tab, see 1 more chart
    cy.get('[data-test="dashboard-component-tabs"]')
      .last()
      .find('[data-test="nav-list"] .ant-tabs-nav-list > .ant-tabs-tab')
      .as('row-level-tabs');

    cy.get('@row-level-tabs').last().click();

    waitForChartLoad(LINE_CHART);
    cy.get('[data-test="grid-container"]').find('.line').should('be.visible');

    // click top level tab, see 1 more chart
    handleException();
    cy.get('[data-test="dashboard-component-tabs"]')
      .first()
      .find('[data-test="nav-list"] .ant-tabs-nav-list > .ant-tabs-tab')
      .as('top-level-tabs');

    cy.get('@top-level-tabs').last().click();

    // should exist a visible box_plot element
    cy.get('[data-test="grid-container"]').find('.box_plot');
  });

  xit('should send new queries when tab becomes visible', () => {
    // landing in first tab
    waitForChartLoad(FILTER_BOX);
    waitForChartLoad(TREEMAP);

    getChartAliasBySpec(TREEMAP).then(treemapAlias => {
      // apply filter
      cy.get('.Select__control').first().should('be.visible').click();
      cy.get('.Select__control input[type=text]').first().focus().type('South');
      cy.get('.Select__option').contains('South Asia').click();
      cy.get('.filter_box button:not(:disabled)').contains('Apply').click();

      // send new query from same tab
      cy.wait(treemapAlias).then(({ request }) => {
        const requestBody = parsePostForm(request.body);
        const requestParams = JSON.parse(requestBody.form_data as string);
        expect(requestParams.extra_filters[0]).deep.eq({
          col: 'region',
          op: 'IN',
          val: ['South Asia'],
        });
      });
    });

    cy.intercept('/superset/explore_json/?*').as('legacyChartData');
    // click row level tab, send 1 more query
    cy.get('.ant-tabs-tab').contains('row tab 2').click();

    cy.wait('@legacyChartData').then(({ request }) => {
      const requestBody = parsePostForm(request.body);
      const requestParams = JSON.parse(requestBody.form_data as string);
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: 'IN',
        val: ['South Asia'],
      });
      expect(requestParams.viz_type).eq(LINE_CHART.viz);
    });

    cy.intercept('POST', '/api/v1/chart/data?*').as('v1ChartData');

    // click top level tab, send 1 more query
    cy.get('.ant-tabs-tab').contains('Tab B').click();

    cy.wait('@v1ChartData').then(({ request }) => {
      expect(request.body.queries[0].filters[0]).deep.eq({
        col: 'region',
        op: 'IN',
        val: ['South Asia'],
      });
    });

    getChartAliasBySpec(BOX_PLOT).then(boxPlotAlias => {
      // navigate to filter and clear filter
      cy.get('.ant-tabs-tab').contains('Tab A').click();
      cy.get('.ant-tabs-tab').contains('row tab 1').click();

      cy.get('.Select__clear-indicator').click();
      cy.get('.filter_box button:not(:disabled)').contains('Apply').click();

      // trigger 1 new query
      waitForChartLoad(TREEMAP);
      // make sure query API not requested multiple times
      cy.on('fail', err => {
        expect(err.message).to.include('timed out waiting');
        return false;
      });

      cy.wait(boxPlotAlias, { timeout: 1000 }).then(() => {
        throw new Error('Unexpected API call.');
      });
    });
  });
});
