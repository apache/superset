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
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';
import readResponseBlob from '../../utils/readResponseBlob';
import { getChartAliases, isLegacyChart } from '../../utils/vizPlugins';

describe('Dashboard top-level controls', () => {
  let mapId;
  let aliases;

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      mapId = dashboard.slices.find(
        slice => slice.form_data.viz_type === 'world_map',
      ).slice_id;
      aliases = getChartAliases(dashboard.slices);
    });
  });

  it('should allow chart level refresh', () => {
    cy.wait(aliases);
    cy.get('[data-test="grid-container"]')
      .find('.world_map')
      .should('be.exist');
    cy.get(`#slice_${mapId}-controls`).click();
    cy.get(`[data-test="slice_${mapId}-menu"]`)
      .should('be.visible')
      .find('[data-test="refresh-chart-menu-item"]')
      .click({ force: true });

    // not allow chart level force refresh when it is loading
    cy.get(`[data-test="slice_${mapId}-menu"]`)
      .find('[data-test="refresh-chart-menu-item"]')
      .should('be.visible')
      .and('have.class', 'ant-dropdown-menu-item-disabled');

    cy.wait(`@getJson_${mapId}`);
    cy.get('[data-test="refresh-chart-menu-item"]')
      .should('be.visible')
      .and('not.have.class', 'ant-dropdown-menu-item-disabled');
  });

  it('should allow dashboard level force refresh', () => {
    // when charts are not start loading, for example, under a secondary tab,
    // should allow force refresh
    cy.get('[data-test="more-horiz"]').click();
    cy.get('[data-test="refresh-dashboard-menu-item"]')
      .should('be.visible')
      .and('not.have.class', 'ant-dropdown-menu-item-disabled');

    // wait the all dash finish loading.
    cy.wait(aliases);
    cy.get('[data-test="refresh-dashboard-menu-item"]').click({ force: true });
    cy.get('[data-test="refresh-dashboard-menu-item"]')
      .should('be.visible')
      .and('have.class', 'ant-dropdown-menu-item-disabled');

    // wait all charts force refreshed
    cy.wait(aliases, { responseTimeout: 15000 }).then(xhrs => {
      // is_cached in response should be false
      xhrs.forEach(xhr => {
        expect(xhr.url).to.have.string('force=true');
        readResponseBlob(xhr.response.body).then(responseBody => {
          expect(responseBody.is_cached).to.equal(false);
        });
      });
    });

    cy.get('[data-test="more-horiz"]').click();
    cy.get('[data-test="refresh-dashboard-menu-item"]')
      .should('be.visible')
      .and('not.have.class', 'ant-dropdown-menu-item-disabled');
  });
});
