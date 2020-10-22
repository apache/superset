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
import { isLegacyChart } from '../../utils/vizPlugins';

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

  it('should apply url params and queryFields to slice requests', () => {
    const aliases = [];
    dashboard.slices.forEach(slice => {
      const { slice_id: id } = slice;
      const isLegacy = isLegacyChart(slice.form_data.viz_type);
      const route = isLegacy
        ? `/superset/explore_json/?form_data={"slice_id":${id}}&dashboard_id=${dashboard.id}`
        : `/api/v1/chart/data?dashboard_id=${dashboard.id}`;
      const alias = `getJson_${id}`;
      // TODO(villebro): fix once url_params fix is merged
      if (isLegacy) {
        aliases.push(`@${alias}`);
        cy.route('POST', route).as(alias);
      }
    });

    cy.wait(aliases).then(requests => {
      requests.forEach(xhr => {
        const requestFormData = xhr.request.body;
        const requestParams = JSON.parse(requestFormData.get('form_data'));
        expect(requestParams).to.have.property('queryFields');
        expect(requestParams.url_params).deep.eq(urlParams);
      });
    });
  });
});
