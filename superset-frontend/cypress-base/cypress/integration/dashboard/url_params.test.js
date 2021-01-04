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
import { isLegacyResponse, getChartAliases } from '../../utils/vizPlugins';
import readResponseBlob from '../../utils/readResponseBlob';

describe('Dashboard form data', () => {
  const urlParams = { param1: '123', param2: 'abc' };
  let dashboard;

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD, { qs: urlParams });

    cy.get('#app').then(data => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      dashboard = bootstrapData.dashboard_data;
    });
  });

  it('should apply url params to slice requests', () => {
    const aliases = getChartAliases(dashboard.slices);
    // wait and verify one-by-one
    cy.wait(aliases).then(requests => {
      return Promise.all(
        requests.map(async xhr => {
          expect(xhr.status).to.eq(200);
          const responseBody = await readResponseBlob(xhr.response.body);

          if (isLegacyResponse(responseBody)) {
            const requestFormData = xhr.request.body;
            const requestParams = JSON.parse(requestFormData.get('form_data'));
            expect(requestParams.url_params).deep.eq(urlParams);
          } else {
            xhr.request.body.queries.forEach(query => {
              expect(query.url_params).deep.eq(urlParams);
            });
          }
        }),
      );
    });
  });
});
