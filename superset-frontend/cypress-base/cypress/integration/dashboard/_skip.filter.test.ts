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
  parsePostForm,
  getChartAliasesBySpec,
  waitForChartLoad,
} from 'cypress/utils';
import { WORLD_HEALTH_DASHBOARD } from 'cypress/utils/urls';
import { WORLD_HEALTH_CHARTS } from './utils';

describe.skip('Dashboard filter', () => {
  before(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
  });

  it('should apply filter', () => {
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    getChartAliasesBySpec(
      WORLD_HEALTH_CHARTS.filter(({ viz }) => viz !== 'filter_box'),
    ).then(nonFilterChartAliases => {
      cy.get('.Select__placeholder:first').click();

      // should show the filter indicator
      cy.get('span[aria-label="filter"]:visible').should(nodes => {
        expect(nodes.length).to.least(9);
      });

      cy.get('.Select__control:first input[type=text]').type('So', {
        force: true,
        delay: 100,
      });

      cy.get('.Select__menu').first().contains('South Asia').click();

      // should still have all filter indicators
      cy.get('span[aria-label="filter"]:visible').should(nodes => {
        expect(nodes.length).to.least(9);
      });

      cy.get('.filter_box button').click({ force: true });
      cy.wait(nonFilterChartAliases).then(requests => {
        requests.forEach(({ response, request }) => {
          const responseBody = response?.body;
          let requestFilter;
          if (isLegacyResponse(responseBody)) {
            const requestFormData = parsePostForm(request.body);
            const requestParams = JSON.parse(
              requestFormData.form_data as string,
            );
            requestFilter = requestParams.extra_filters[0];
          } else {
            requestFilter = request.body.queries[0].filters[0];
          }
          expect(requestFilter).deep.eq({
            col: 'region',
            op: 'IN',
            val: ['South Asia'],
          });
        });
      });
    });

    // TODO add test with South Asia{enter} type action to select filter
  });
});
