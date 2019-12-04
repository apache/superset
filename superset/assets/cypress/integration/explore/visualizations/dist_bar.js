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

// Dist bar

export default () =>
  describe('Distribution bar chart', () => {
    const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'dist_bar' };

    beforeEach(() => {
      cy.login();
      cy.server();
      cy.route('POST', '/superset/explore_json/**').as('getJson');
    });

    it('Test dist bar with adhoc metric', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['state'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({
        waitAlias: '@getJson',
        querySubstring: NUM_METRIC.label,
        chartSelector: 'svg',
      });
    });

    it('Test dist bar with series', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['state'],
        columns: ['gender'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    });

    it('Test dist bar with row limit', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['state'],
        row_limit: 10,
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    });

    it('Test dist bar with contribution', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['state'],
        columns: ['gender'],
        contribution: true,
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    });
  });
