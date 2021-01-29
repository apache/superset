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
  getChartAliases,
  isLegacyResponse,
  getSliceIdFromRequestUrl,
  JsonObject,
} from '../../utils/vizPlugins';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

describe('Dashboard load', () => {
  let dashboard;
  let aliases: string[];
  beforeEach(() => {
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then(nodes => {
      const bootstrapData = JSON.parse(nodes[0].dataset.bootstrap || '');
      dashboard = bootstrapData.dashboard_data;
      const { slices } = dashboard;
      // then define routes and create alias for each requests
      aliases = getChartAliases(slices);
    });
  });

  it('should load dashboard', () => {
    // wait and verify one-by-one
    cy.wait(aliases).then(requests =>
      Promise.all(
        requests.map(async ({ response, request }) => {
          const responseBody = response?.body;
          let sliceId;
          if (isLegacyResponse(responseBody)) {
            expect(responseBody).to.have.property('errors');
            expect(responseBody.errors.length).to.eq(0);
            sliceId = responseBody.form_data.slice_id;
          } else {
            sliceId = getSliceIdFromRequestUrl(request.url);
            responseBody.result.forEach((element: JsonObject) => {
              expect(element).to.have.property('error', null);
              expect(element).to.have.property('status', 'success');
            });
          }
          cy.get('[data-test="grid-content"]')
            .find(`#chart-id-${sliceId}`)
            .should('be.visible');
        }),
      ),
    );
  });
});
