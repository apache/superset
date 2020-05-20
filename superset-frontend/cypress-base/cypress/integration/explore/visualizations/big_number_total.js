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
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './shared.helper';
import readResponseBlob from '../../../utils/readResponseBlob';

// Big Number Total

export default () =>
  describe('Big Number Total', () => {
    const BIG_NUMBER_DEFAULTS = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'big_number_total',
    };

    beforeEach(() => {
      cy.login();
      cy.server();
      cy.route('POST', '/superset/explore_json/**').as('getJson');
    });

    it('Test big number chart with adhoc metric', () => {
      const formData = { ...BIG_NUMBER_DEFAULTS, metric: NUM_METRIC };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({
        waitAlias: '@getJson',
        querySubstring: NUM_METRIC.label,
      });
    });

    it('Test big number chart with simple filter', () => {
      const filters = [
        {
          expressionType: 'SIMPLE',
          subject: 'name',
          operator: 'in',
          comparator: ['Aaron', 'Amy', 'Andrea'],
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_4y6teao56zs_ebjsvwy48c',
        },
      ];

      const formData = {
        ...BIG_NUMBER_DEFAULTS,
        metric: 'count',
        adhoc_filters: filters,
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson' });
    });

    it('Test big number chart ignores groupby', () => {
      const formData = {
        ...BIG_NUMBER_DEFAULTS,
        metric: NUM_METRIC,
        groupby: ['state'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.wait(['@getJson']).then(async xhr => {
        cy.verifyResponseCodes(xhr);
        cy.verifySliceContainer();

        const responseBody = await readResponseBlob(xhr.response.body);
        expect(responseBody.query).not.contains(formData.groupby[0]);
      });
    });
  });
