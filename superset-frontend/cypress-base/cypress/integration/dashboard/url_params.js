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

export default () =>
  describe('dashboard url params', () => {
    const urlParams = { param1: '123', param2: 'abc' };
    let sliceIds = [];
    let dashboardId;

    beforeEach(() => {
      cy.server();
      cy.login();

      cy.visit(WORLD_HEALTH_DASHBOARD, { qs: urlParams });

      cy.get('#app').then(data => {
        const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
        const dashboard = bootstrapData.dashboard_data;
        dashboardId = dashboard.id;
        sliceIds = dashboard.slices.map(slice => slice.slice_id);
      });
    });

    it('should apply url params to slice requests', () => {
      const aliases = [];
      sliceIds.forEach(id => {
        const alias = `getJson_${id}`;
        aliases.push(`@${alias}`);
        cy.route(
          'POST',
          `/superset/explore_json/?form_data={"slice_id":${id}}&dashboard_id=${dashboardId}`,
        ).as(alias);
      });

      cy.wait(aliases).then(requests => {
        requests.forEach(xhr => {
          const requestFormData = xhr.request.body;
          const requestParams = JSON.parse(requestFormData.get('form_data'));
          expect(requestParams.url_params).deep.eq(urlParams);
        });
      });
    });
  });
