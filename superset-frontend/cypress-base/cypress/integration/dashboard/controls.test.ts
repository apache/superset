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
import {
  WORLD_HEALTH_CHARTS,
  WORLD_HEALTH_DASHBOARD,
  waitForChartLoad,
  ChartSpec,
  getChartAliasesBySpec,
} from './dashboard.helper';
import { isLegacyResponse } from '../../utils/vizPlugins';

describe('Dashboard top-level controls', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
  });

  // flaky test
  xit('should allow chart level refresh', () => {
    const mapSpec = WORLD_HEALTH_CHARTS.find(
      ({ viz }) => viz === 'world_map',
    ) as ChartSpec;
    waitForChartLoad(mapSpec).then(gridComponent => {
      const mapId = gridComponent.attr('data-test-chart-id');
      cy.get('[data-test="grid-container"]').find('.world_map').should('exist');
      cy.get(`#slice_${mapId}-controls`).click();
      cy.get(`[data-test="slice_${mapId}-menu"]`)
        .find('[data-test="refresh-chart-menu-item"]')
        .click({ force: true });
      // likely cause for flakiness:
      // The query completes before this assertion happens.
      // Solution: pause the network before clicking, assert, then unpause network.
      cy.get('[data-test="refresh-chart-menu-item"]').should(
        'have.class',
        'ant-dropdown-menu-item-disabled',
      );
      waitForChartLoad(mapSpec);
      cy.get('[data-test="refresh-chart-menu-item"]').should(
        'not.have.class',
        'ant-dropdown-menu-item-disabled',
      );
    });
  });

  xit('should allow dashboard level force refresh', () => {
    // when charts are not start loading, for example, under a secondary tab,
    // should allow force refresh
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    getChartAliasesBySpec(WORLD_HEALTH_CHARTS).then(aliases => {
      cy.get('[aria-label="more-horiz"]').click();
      cy.get('[data-test="refresh-dashboard-menu-item"]').should(
        'not.have.class',
        'ant-dropdown-menu-item-disabled',
      );

      cy.get('[data-test="refresh-dashboard-menu-item"]').click({
        force: true,
      });
      cy.get('[data-test="refresh-dashboard-menu-item"]').should(
        'have.class',
        'ant-dropdown-menu-item-disabled',
      );

      // wait all charts force refreshed.

      cy.wait(aliases).then(xhrs => {
        xhrs.forEach(async ({ response, request }) => {
          const responseBody = response?.body;
          const isCached = isLegacyResponse(responseBody)
            ? responseBody.is_cached
            : responseBody.result[0].is_cached;
          // request url should indicate force-refresh operation
          expect(request.url).to.have.string('force=true');
          // is_cached in response should be false
          expect(isCached).to.equal(false);
        });
      });
    });
    cy.get('[aria-label="more-horiz"]').click();
    cy.get('[data-test="refresh-dashboard-menu-item"]').and(
      'not.have.class',
      'ant-dropdown-menu-item-disabled',
    );
  });
});
