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
import { FORM_DATA_DEFAULTS, NUM_METRIC, SIMPLE_FILTER } from './shared.helper';
import readResponseBlob from '../../../utils/readResponseBlob';

// Table

export default () =>
  describe('Table chart', () => {
    const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'table' };

    beforeEach(() => {
      cy.login();
      cy.server();
      cy.route('POST', '/superset/explore_json/**').as('getJson');
    });

    it('Test table with adhoc metric', () => {
      const formData = { ...VIZ_DEFAULTS, metrics: NUM_METRIC };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({
        waitAlias: '@getJson',
        querySubstring: NUM_METRIC.label,
        chartSelector: 'table',
      });
    });

    it('Test table with groupby', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['name'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({
        waitAlias: '@getJson',
        querySubstring: formData.groupby[0],
        chartSelector: 'table',
      });
    });

    it('Test table with percent metrics and groupby', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        percent_metrics: NUM_METRIC,
        metrics: [],
        groupby: ['name'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });
    });

    it('Test table with groupby order desc', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['name'],
        order_desc: true,
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });
    });

    it('Test table with groupby and limit', () => {
      const limit = 10;

      const formData = {
        ...VIZ_DEFAULTS,
        metrics: NUM_METRIC,
        groupby: ['name'],
        row_limit: limit,
      };

      cy.visitChartByParams(JSON.stringify(formData));

      cy.wait('@getJson').then(async xhr => {
        cy.verifyResponseCodes(xhr);
        cy.verifySliceContainer('table');
        const responseBody = await readResponseBlob(xhr.response.body);
        expect(responseBody.data.records.length).to.eq(limit);
      });
      cy.get('span.label-danger').contains('10 rows');
    });

    it('Test table with columns and row limit', () => {
      const formData = {
        ...VIZ_DEFAULTS,
        all_columns: ['name'],
        metrics: [],
        row_limit: 10,
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });
    });

    it('Test table with columns, ordering, and row limit', () => {
      const limit = 10;

      const formData = {
        ...VIZ_DEFAULTS,
        all_columns: ['name', 'state', 'ds', 'num'],
        metrics: [],
        row_limit: limit,
        order_by_cols: ['["num",+false]'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.wait('@getJson').then(async xhr => {
        cy.verifyResponseCodes(xhr);
        cy.verifySliceContainer('table');
        const responseBody = await readResponseBlob(xhr.response.body);
        const { records } = responseBody.data;
        expect(records[0].num).greaterThan(records[records.length - 1].num);
      });
    });

    it('Test table with simple filter', () => {
      const metrics = ['count'];
      const filters = [SIMPLE_FILTER];

      const formData = { ...VIZ_DEFAULTS, metrics, adhoc_filters: filters };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });
    });

    it('Tests table number formatting with % in metric name', () => {
      const PERCENT_METRIC = {
        expressionType: 'SQL',
        sqlExpression: 'CAST(SUM(sum_girls)+AS+FLOAT)/SUM(num)',
        column: null,
        aggregate: null,
        hasCustomLabel: true,
        label: '%+Girls',
        optionName: 'metric_6qwzgc8bh2v_zox7hil1mzs',
      };
      const formData = {
        ...VIZ_DEFAULTS,
        metrics: PERCENT_METRIC,
        groupby: ['state'],
      };

      cy.visitChartByParams(JSON.stringify(formData));
      cy.verifySliceSuccess({
        waitAlias: '@getJson',
        querySubstring: formData.groupby[0],
        chartSelector: 'table',
      });
      cy.get('td').contains(/\d*%/);
    });
  });
