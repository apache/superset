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
import { interceptChart, parsePostForm, Slice } from 'cypress/utils';
import { TABBED_DASHBOARD } from './dashboard.helper';

describe('Dashboard tabs', () => {
  let filterId;
  let treemapId;
  let linechartId;
  let boxplotId;

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

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap || '');
      const dashboard = bootstrapData.dashboard_data as { slices: Slice[] };
      filterId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'filter_box',
      )?.slice_id;
      boxplotId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'box_plot',
      )?.slice_id;
      treemapId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'treemap',
      )?.slice_id;
      linechartId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'line',
      )?.slice_id;
      interceptChart({ sliceId: filterId, legacy: true }).as('filterRequest');
      interceptChart({ sliceId: treemapId, legacy: true }).as('treemapRequest');
      interceptChart({ sliceId: linechartId, legacy: true }).as(
        'linechartRequest',
      );
      interceptChart({ sliceId: boxplotId, legacy: false }).as(
        'boxplotRequest',
      );
    });
  });

  it('should switch active tab on click', () => {
    cy.wait('@filterRequest');
    cy.wait('@treemapRequest');

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
    cy.wait('@filterRequest');
    cy.get('[data-test="grid-container"]')
      .find('.filter_box')
      .should('be.visible');
    cy.wait('@treemapRequest');
    cy.get('[data-test="grid-container"]')
      .find('.treemap')
      .should('be.visible');
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

    cy.wait('@linechartRequest');
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

  it('should send new queries when tab becomes visible', () => {
    // landing in first tab
    cy.wait('@filterRequest');
    cy.wait('@treemapRequest');

    // apply filter
    cy.get('.Select__control').first().should('be.visible').click();
    cy.get('.Select__control input[type=text]').first().focus().type('South');
    cy.get('.Select__option').contains('South Asia').click();
    cy.get('.filter_box button:not(:disabled)').contains('Apply').click();

    // send new query from same tab
    cy.wait('@treemapRequest').then(({ request }) => {
      const requestBody = parsePostForm(request.body);
      const requestParams = JSON.parse(requestBody.form_data as string);
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: '==',
        val: 'South Asia',
      });
    });

    // click row level tab, send 1 more query
    cy.get('.ant-tabs-tab').contains('row tab 2').click();

    cy.wait('@linechartRequest').then(({ request }) => {
      const requestBody = parsePostForm(request.body);
      const requestParams = JSON.parse(requestBody.form_data as string);
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: '==',
        val: 'South Asia',
      });
    });

    // click top level tab, send 1 more query
    cy.get('.ant-tabs-tab').contains('Tab B').click();

    cy.wait('@boxplotRequest').then(({ request }) => {
      const requestBody = request.body;
      const requestParams = requestBody.queries[0];
      expect(requestParams.filters[0]).deep.eq({
        col: 'region',
        op: '==',
        val: 'South Asia',
      });
    });

    // navigate to filter and clear filter
    cy.get('.ant-tabs-tab').contains('Tab A').click();
    cy.get('.ant-tabs-tab').contains('row tab 1').click();

    cy.get('.Select__clear-indicator').click();
    cy.get('.filter_box button:not(:disabled)').contains('Apply').click();

    // trigger 1 new query
    cy.wait('@treemapRequest');

    // make sure query API not requested multiple times
    cy.on('fail', err => {
      expect(err.message).to.include('timed out waiting');
      return false;
    });

    cy.wait('@boxplotRequest', { timeout: 1000 }).then(() => {
      throw new Error('Unexpected API call.');
    });
  });
});
