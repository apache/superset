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
import {
  getChartAliases,
  DASHBOARD_CHART_ALIAS_PREFIX,
  isLegacyResponse,
} from '../../utils/vizPlugins';
import readResponseBlob from '../../utils/readResponseBlob';

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
    return `@${DASHBOARD_CHART_ALIAS_PREFIX}${id}`;
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

      aliases = getChartAliases(slices);

      // wait the initial page load requests
      cy.wait(aliases);
    });
  });

  it('should apply filter', () => {
    cy.get('.Select__placeholder:first').click();

    // should show the filter indicator
    cy.get('svg[data-test="filter"]:visible').should(nodes => {
      expect(nodes.length).to.least(9);
    });

    cy.get('.Select__control:first input[type=text]').type('So', {
      force: true,
      delay: 100,
    });

    cy.get('.Select__menu').first().contains('South Asia').click();

    // should still have all filter indicators
    cy.get('svg[data-test="filter"]:visible').should(nodes => {
      expect(nodes.length).to.least(9);
    });

    cy.get('.filter_box button').click({ force: true });
    cy.wait(aliases.filter(x => x !== getAlias(filterId))).then(requests => {
      return Promise.all(
        requests.map(async xhr => {
          expect(xhr.status).to.eq(200);
          const responseBody = await readResponseBlob(xhr.response.body);
          let requestFilter;
          if (isLegacyResponse(responseBody)) {
            const requestFormData = xhr.request.body as FormData;
            const requestParams = JSON.parse(
              requestFormData.get('form_data') as string,
            );
            requestFilter = requestParams.extra_filters[0];
          } else {
            requestFilter = xhr.request.body.queries[0].filters[0];
          }
          expect(requestFilter).deep.eq({
            col: 'region',
            op: '==',
            val: 'South Asia',
          });
        }),
      );
    });

    // TODO add test with South Asia{enter} type action to select filter
  });
});
