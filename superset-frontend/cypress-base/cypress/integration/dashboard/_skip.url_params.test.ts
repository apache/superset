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
import { parsePostForm, JsonObject, waitForChartLoad } from 'cypress/utils';
import { WORLD_HEALTH_DASHBOARD } from 'cypress/utils/urls';
import { WORLD_HEALTH_CHARTS } from './utils';

describe.skip('Dashboard form data', () => {
  const urlParams = { param1: '123', param2: 'abc' };
  before(() => {
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD, { qs: urlParams });
  });

  it('should apply url params to slice requests', () => {
    cy.intercept('/api/v1/chart/data?*', request => {
      // TODO: export url params to chart data API
      request.body.queries.forEach((query: { url_params: JsonObject }) => {
        expect(query.url_params).deep.eq(urlParams);
      });
    });
    cy.intercept('/superset/explore_json/*', request => {
      const requestParams = JSON.parse(
        parsePostForm(request.body).form_data as string,
      );
      expect(requestParams.url_params).deep.eq(urlParams);
    });

    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
  });
});
