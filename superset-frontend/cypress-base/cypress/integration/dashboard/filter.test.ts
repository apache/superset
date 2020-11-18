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

interface Slice {
  slice_id: number;
  form_data: {
    viz_type: string;
    [key: string]: JSONValue;
  };
}

interface DashboardData {
  slices: Slice[];
}

describe('Dashboard filter', () => {
  let filterId: number;
  let aliases: string[];

  const getAlias = (id: number) => {
    return `@slice_${id}`;
  };

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then(app => {
      const bootstrapData = app.data('bootstrap');
      const dashboard = bootstrapData.dashboard_data as DashboardData;
      const { slices } = dashboard;
      filterId =
        dashboard.slices.find(
          slice => slice.form_data.viz_type === 'filter_box',
        )?.slice_id || 0;
      aliases = slices
        // TODO(villebro): enable V1 charts
        .filter(slice => isLegacyChart(slice.form_data.viz_type))
        .map(slice => {
          const id = slice.slice_id;
          const alias = getAlias(id);
          const url = `/superset/explore_json/?*{"slice_id":${id}}*`;
          cy.route('POST', url).as(alias.slice(1));
          return alias;
        });

      // wait the initial page load requests
      cy.wait(aliases);
    });
  });
  xit('should apply filter', () => {
    cy.get('.Select__control input[type=text]')
      .first()
      .should('be.visible')
      .focus();

    // should open the filter indicator
    cy.get('[data-test="filter"]')
      .should('be.visible', { timeout: 10000 })
      .should(nodes => {
        expect(nodes).to.have.length(9); // this part was not working, xit-ed
      });

    cy.get('[data-test="chart-container"]').find('svg').should('be.visible');

    cy.get('.Select__control input[type=text]').first().focus().blur();

    cy.get('.Select__control input[type=text]')
      .first()
      .focus()
      .type('So', { force: true, delay: 100 });

    cy.get('.Select__menu').first().contains('South Asia').click();

    cy.get('.filter_box button').click({ force: true });

    // wait again after applied filters
    cy.wait(aliases.filter(x => x !== getAlias(filterId))).then(requests => {
      requests.forEach(xhr => {
        const requestFormData = xhr.request.body as FormData;
        const requestParams = JSON.parse(
          requestFormData.get('form_data') as string,
        );
        expect(requestParams.extra_filters[0]).deep.eq({
          col: 'region',
          op: '==',
          val: 'South Asia',
        });
      });
    });

    // TODO add test with South Asia{enter} type action to select filter
  });
});
