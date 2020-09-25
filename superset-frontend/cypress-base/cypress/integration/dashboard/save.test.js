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
import readResponseBlob from '../../utils/readResponseBlob';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

describe('Dashboard save action', () => {
  let dashboardId;

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      dashboardId = dashboard.id;
      cy.route('POST', `/superset/copy_dash/${dashboardId}/`).as('copyRequest');
    });

    cy.get('#save-dash-split-button').trigger('click', { force: true });
    cy.contains('Save as').trigger('click', { force: true });
    cy.get('.modal-footer').contains('Save').trigger('click', { force: true });
  });

  it('should save as new dashboard', () => {
    cy.wait('@copyRequest').then(xhr => {
      expect(xhr.status).to.eq(200);
      readResponseBlob(xhr.response.body).then(json => {
        expect(json.id).to.be.gt(dashboardId);
      });
    });
  });

  it('should save/overwrite dashboard', () => {
    // should have box_plot chart
    cy.get('.grid-container .box_plot', { timeout: 5000 }); // wait for 5 secs

    // remove box_plot chart from dashboard
    cy.get('.dashboard-header [data-test=edit-alt]').click();
    cy.get('.fa.fa-trash').last().trigger('click', { force: true });
    cy.get('.grid-container .box_plot').should('not.exist');

    cy.route('POST', '/superset/save_dash/**/').as('saveRequest');
    cy.get('.dashboard-header')
      .contains('Save')
      .trigger('click', { force: true });

    // go back to view mode
    cy.wait('@saveRequest');
    cy.get('.dashboard-header [data-test=edit-alt]').click();
    cy.get('.grid-container .box_plot').should('not.exist');
  });
});
