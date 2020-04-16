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
  describe('dashboard filter', () => {
    let filterId;
    let aliases;

    const getAlias = id => {
      return `@slice_${id}`;
    };

    beforeEach(() => {
      cy.server();
      cy.login();

      cy.visit(WORLD_HEALTH_DASHBOARD);

      cy.get('#app').then(data => {
        const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
        const dashboard = bootstrapData.dashboard_data;
        const sliceIds = dashboard.slices.map(slice => slice.slice_id);
        filterId = dashboard.slices.find(
          slice => slice.form_data.viz_type === 'filter_box',
        ).slice_id;
        aliases = sliceIds.map(id => {
          const alias = getAlias(id);
          const url = `/superset/explore_json/?*{"slice_id":${id}}*`;
          cy.route('POST', url).as(alias.slice(1));
          return alias;
        });

        // wait the initial page load requests
        cy.wait(aliases);
      });
    });

    it('should apply filter', () => {
      cy.get('.Select-placeholder')
        .contains('Select [region]')
        .click()
        .next()
        .find('input')
        .type('South Asia{enter}', { force: true });

      // wait again after applied filters
      cy.wait(aliases.filter(x => x !== getAlias(filterId))).then(requests => {
        requests.forEach(xhr => {
          const requestFormData = xhr.request.body;
          const requestParams = JSON.parse(requestFormData.get('form_data'));
          expect(requestParams.extra_filters[0]).deep.eq({
            col: 'region',
            op: 'in',
            val: ['South Asia'],
          });
        });
      });
    });
  });
