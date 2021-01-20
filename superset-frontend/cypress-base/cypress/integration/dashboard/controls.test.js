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
import {
  getChartAliases,
  isLegacyResponse,
  DASHBOARD_CHART_ALIAS_PREFIX,
} from '../../utils/vizPlugins';

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

  // flaky test
  xit('should allow chart level refresh', () => {
    cy.wait(aliases);
    cy.get('[data-test="grid-container"]').find('.world_map').should('exist');
    cy.get(`#slice_${mapId}-controls`).click();
    cy.get(`[data-test="slice_${mapId}-menu"]`)
      .find('[data-test="refresh-chart-menu-item"]')
      .click({ force: true })
      .then($el => {
        cy.get($el).should('have.class', 'ant-dropdown-menu-item-disabled');
      });

    cy.wait(`@${DASHBOARD_CHART_ALIAS_PREFIX}${mapId}`);
    cy.get('[data-test="refresh-chart-menu-item"]').should(
      'not.have.class',
      'ant-dropdown-menu-item-disabled',
    );
  });

  it('should allow dashboard level force refresh', () => {
    // wait the all dash finish loading.
    cy.wait(aliases);
    // when charts are not start loading, for example, under a secondary tab,
    // should allow force refresh
    cy.get('[data-test="more-horiz"]').click();
    cy.get('[data-test="refresh-dashboard-menu-item"]').should(
      'not.have.class',
      'ant-dropdown-menu-item-disabled',
    );

    cy.get('[data-test="refresh-dashboard-menu-item"]').click({ force: true });
    cy.get('[data-test="refresh-dashboard-menu-item"]').should(
      'have.class',
      'ant-dropdown-menu-item-disabled',
    );

    // wait all charts force refreshed.
    cy.wait(aliases, { responseTimeout: 15000 }).then(xhrs => {
      xhrs.forEach(async xhr => {
        const responseBody = await readResponseBlob(xhr.response.body);
        const isCached = isLegacyResponse(responseBody)
          ? responseBody.is_cached
          : responseBody.result[0].is_cached;
        // request url should indicate force-refresh operation
        expect(xhr.url).to.have.string('force=true');
        // is_cached in response should be false
        expect(isCached).to.equal(false);
      });
    });
    cy.get('[data-test="more-horiz"]').click();
    cy.get('[data-test="refresh-dashboard-menu-item"]').and(
      'not.have.class',
      'ant-dropdown-menu-item-disabled',
    );
  });
});
