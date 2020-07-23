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
import { TABBED_DASHBOARD } from './dashboard.helper';

describe('Dashboard tabs', () => {
  let filterId;
  let treemapId;
  let linechartId;
  let boxplotId;
  let dashboardId;

  // cypress can not handle window.scrollTo
  // https://github.com/cypress-io/cypress/issues/2761
  // add this exception handler to pass test
  const handleException = () => {
    // return false to prevent the error from
    // failing this test
    cy.on('uncaught:exception', () => false);
  };

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(TABBED_DASHBOARD);

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      dashboardId = dashboard.id;
      filterId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'filter_box',
      ).slice_id;
      boxplotId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'box_plot',
      ).slice_id;
      treemapId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'treemap',
      ).slice_id;
      linechartId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'line',
      ).slice_id;

      const filterFormdata = {
        slice_id: filterId,
      };
      const filterRequest = `/superset/explore_json/?form_data=${JSON.stringify(
        filterFormdata,
      )}&dashboard_id=${dashboardId}`;
      cy.route('POST', filterRequest).as('filterRequest');

      const treemapFormdata = {
        slice_id: treemapId,
      };
      const treemapRequest = `/superset/explore_json/?form_data=${JSON.stringify(
        treemapFormdata,
      )}&dashboard_id=${dashboardId}`;
      cy.route('POST', treemapRequest).as('treemapRequest');

      const linechartFormdata = {
        slice_id: linechartId,
      };
      const linechartRequest = `/superset/explore_json/?form_data=${JSON.stringify(
        linechartFormdata,
      )}&dashboard_id=${dashboardId}`;
      cy.route('POST', linechartRequest).as('linechartRequest');

      const boxplotFormdata = {
        slice_id: boxplotId,
      };
      const boxplotRequest = `/superset/explore_json/?form_data=${JSON.stringify(
        boxplotFormdata,
      )}&dashboard_id=${dashboardId}`;
      cy.route('POST', boxplotRequest).as('boxplotRequest');
    });
  });

  it('should load charts when tab is visible', () => {
    // landing in first tab, should see 2 charts
    cy.wait('@filterRequest');
    cy.get('.grid-container .filter_box').should('be.exist');
    cy.wait('@treemapRequest');
    cy.get('.grid-container .treemap').should('be.exist');
    cy.get('.grid-container .box_plot').should('not.be.exist');
    cy.get('.grid-container .line').should('not.be.exist');

    // click row level tab, see 1 more chart
    cy.get('.tab-content ul.nav.nav-tabs li')
      .last()
      .find('.editable-title input')
      .click();
    cy.wait('@linechartRequest');
    cy.get('.grid-container .line').should('be.exist');

    // click top level tab, see 1 more chart
    handleException();
    cy.get('.dashboard-component-tabs')
      .first()
      .find('ul.nav.nav-tabs li')
      .last()
      .find('.editable-title input')
      .click();

    // should exist a visible box_plot element
    cy.get('.grid-container .box_plot');
  });

  it('should send new queries when tab becomes visible', () => {
    // landing in first tab
    cy.wait('@filterRequest');
    cy.wait('@treemapRequest');

    // apply filter
    cy.get('.Select__control').first().should('be.visible');
    cy.get('.Select__control').first().click({ force: true });
    cy.get('.Select__control input[type=text]')
      .first()
      .should('be.visible')
      .type('South Asia{enter}', { force: true });

    // send new query from same tab
    cy.wait('@treemapRequest').then(xhr => {
      const requestFormData = xhr.request.body;
      const requestParams = JSON.parse(requestFormData.get('form_data'));
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: 'in',
        val: ['South Asia'],
      });
    });

    // click row level tab, send 1 more query
    cy.get('.tab-content ul.nav.nav-tabs li').last().click();
    cy.wait('@linechartRequest').then(xhr => {
      const requestFormData = xhr.request.body;
      const requestParams = JSON.parse(requestFormData.get('form_data'));
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: 'in',
        val: ['South Asia'],
      });
    });

    // click top level tab, send 1 more query
    handleException();
    cy.get('.dashboard-component-tabs')
      .first()
      .find('ul.nav.nav-tabs li')
      .last()
      .find('.editable-title input')
      .click();

    cy.wait('@boxplotRequest').then(xhr => {
      const requestFormData = xhr.request.body;
      const requestParams = JSON.parse(requestFormData.get('form_data'));
      expect(requestParams.extra_filters[0]).deep.eq({
        col: 'region',
        op: 'in',
        val: ['South Asia'],
      });
    });

    // navigate to filter and clear filter
    cy.get('.dashboard-component-tabs')
      .first()
      .find('ul.nav.nav-tabs li')
      .first()
      .click();
    cy.get('.tab-content ul.nav.nav-tabs li')
      .first()
      .should('be.visible')
      .click();
    cy.get('.Select__clear-indicator').click();

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
