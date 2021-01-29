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
  isLegacyResponse,
  getChartAliases,
  parsePostForm,
  Dashboard,
  JsonObject,
} from 'cypress/utils';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

describe('Dashboard form data', () => {
  const urlParams = { param1: '123', param2: 'abc' };
  let dashboard: Dashboard;

  beforeEach(() => {
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD, { qs: urlParams });

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap || '');
      dashboard = bootstrapData.dashboard_data;
    });
  });

  it('should apply url params to slice requests', () => {
    const aliases = getChartAliases(dashboard.slices);
    // wait and verify one-by-one
    cy.wait(aliases, { timeout: 18000 }).then(requests =>
      Promise.all(
        requests.map(async ({ response, request }) => {
          const responseBody = response?.body;
          if (isLegacyResponse(responseBody)) {
            const requestParams = JSON.parse(
              parsePostForm(request.body).form_data as string,
            );
            expect(requestParams.url_params).deep.eq(urlParams);
          } else {
            // TODO: export url params to chart data API
            request.body.queries.forEach(
              (query: { url_params: JsonObject }) => {
                expect(query.url_params).deep.eq(urlParams);
              },
            );
          }
        }),
      ),
    );
  });
});
