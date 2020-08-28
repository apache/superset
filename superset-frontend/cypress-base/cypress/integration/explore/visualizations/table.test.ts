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
  FORM_DATA_DEFAULTS,
  NUM_METRIC,
  MAX_DS,
  MAX_STATE,
  SIMPLE_FILTER,
} from './shared.helper';
import readResponseBlob from '../../../utils/readResponseBlob';

// Table
describe('Visualization > Table', () => {
  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'table' };

  const PERCENT_METRIC = {
    expressionType: 'SQL',
    sqlExpression: 'CAST(SUM(sum_girls)+AS+FLOAT)/SUM(num)',
    column: null,
    aggregate: null,
    hasCustomLabel: true,
    label: 'Girls',
    optionName: 'metric_6qwzgc8bh2v_zox7hil1mzs',
  };

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Use default time column', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      granularity_sqla: undefined,
      metrics: ['count'],
    });
    cy.get('input[name="select-granularity_sqla"]').should('have.value', 'ds');
  });

  it('Format non-numeric metrics correctly', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      include_time: true,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P0.25Y',
      metrics: [NUM_METRIC, MAX_DS, MAX_STATE],
    });
    // when format with smart_date, time column use format by granularity
    cy.get('.chart-container td:nth-child(1)').contains('2008 Q1');
    // other column with timestamp use raw timestamp
    cy.get('.chart-container td:nth-child(3)').contains('2008-01-01T00:00:00');
    cy.get('.chart-container td:nth-child(4)').contains('other');
  });

  it('Format with table_timestamp_format', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      include_time: true,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P0.25Y',
      table_timestamp_format: '%Y-%m-%d %H:%M',
      metrics: [NUM_METRIC, MAX_DS, MAX_STATE],
    });
    // time column and MAX(ds) metric column both use UTC time
    cy.get('.chart-container td:nth-child(1)').contains('2008-01-01 00:00');
    cy.get('.chart-container td:nth-child(3)').contains('2008-01-01 00:00');
    cy.get('.chart-container td')
      .contains('2008-01-01 08:00')
      .should('not.exist');
    // time column should not use time granularity when timestamp format is set
    cy.get('.chart-container td').contains('2008 Q1').should('not.exist');
    // other num numeric metric column should stay as string
    cy.get('.chart-container td').contains('other');
  });

  it('Test table with groupby', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC, MAX_DS],
      groupby: ['name'],
    });
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: /groupby.*name/,
      chartSelector: 'table',
    });
  });

  it('Test table with groupby + time column', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      include_time: true,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P0.25Y',
      metrics: [NUM_METRIC, MAX_DS],
      groupby: ['name'],
    });
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: /groupby.*name/,
      chartSelector: 'table',
    });
  });

  it('Handle sorting correctly', () => {
    cy.get('.chart-container th').contains('name').click();
    cy.get('.chart-container td:nth-child(2):eq(0)').contains('Aaron');
    cy.get('.chart-container th').contains('Time').click().click();
    cy.get('.chart-container td:nth-child(1):eq(0)').contains('2008');
  });

  it('Test table with percent metrics and groupby', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      percent_metrics: PERCENT_METRIC,
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
      // should still work when query_mode is not-set/invalid
      query_mode: undefined,
      all_columns: ['name'],
      metrics: [],
      row_limit: 10,
    };
    cy.visitChartByParams(JSON.stringify(formData));

    // should display in raw records mode
    cy.get('div[data-test="query_mode"] .btn.active').contains('Raw Records');
    cy.get('div[data-test="all_columns"]').should('be.visible');
    cy.get('div[data-test="groupby"]').should('not.be.visible');

    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });

    // should allow switch to aggregate mode
    cy.get('div[data-test="query_mode"] .btn').contains('Aggregate').click();
    cy.get('div[data-test="query_mode"] .btn.active').contains('Aggregate');
    cy.get('div[data-test="all_columns"]').should('not.be.visible');
    cy.get('div[data-test="groupby"]').should('be.visible');
  });

  it('Test table with columns, ordering, and row limit', () => {
    const limit = 10;

    const formData = {
      ...VIZ_DEFAULTS,
      query_mode: 'raw',
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
    const formData = {
      ...VIZ_DEFAULTS,
      percent_metrics: PERCENT_METRIC,
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
