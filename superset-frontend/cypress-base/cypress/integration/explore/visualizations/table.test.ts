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
import { interceptChart } from 'cypress/utils';
import {
  FORM_DATA_DEFAULTS,
  NUM_METRIC,
  MAX_DS,
  MAX_STATE,
  SIMPLE_FILTER,
} from './shared.helper';

// Table
describe('Visualization > Table', () => {
  const VIZ_DEFAULTS = {
    ...FORM_DATA_DEFAULTS,
    viz_type: 'table',
    row_limit: 1000,
  };

  const PERCENT_METRIC = {
    expressionType: 'SQL',
    sqlExpression: 'CAST(SUM(num_girls) AS FLOAT)/SUM(num)',
    column: null,
    aggregate: null,
    hasCustomLabel: true,
    label: 'Girls',
    optionName: 'metric_6qwzgc8bh2v_zox7hil1mzs',
  };

  beforeEach(() => {
    cy.login();
    interceptChart({ legacy: false }).as('chartData');
  });

  it('Use default time column', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      granularity_sqla: undefined,
      metrics: ['count'],
    });
    cy.get('[data-test=granularity_sqla] .column-option-label').contains('ds');
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
    // other column with timestamp use adaptive formatting
    cy.get('.chart-container td:nth-child(3)').contains('2008');
    cy.get('.chart-container td:nth-child(4)').contains('TX');
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
    cy.get('.chart-container td').contains('TX');
  });

  it('Test table with groupby', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC, MAX_DS],
      groupby: ['name'],
    });
    cy.verifySliceSuccess({
      waitAlias: '@chartData',
      querySubstring: /group by.*name/i,
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
    cy.wait('@chartData').then(({ response }) => {
      cy.verifySliceContainer('table');
      const records = response?.body.result[0].data;
      // should sort by first metric when no sort by metric is set
      expect(records[0][NUM_METRIC.label]).greaterThan(
        records[1][NUM_METRIC.label],
      );
    });

    // should handle frontend sorting correctly
    cy.get('.chart-container th').contains('name').click();
    cy.get('.chart-container td:nth-child(2):eq(0)').contains('Adam');
    cy.get('.chart-container th').contains('Time').click().click();
    cy.get('.chart-container td:nth-child(1):eq(0)').contains('2008');
  });

  it('Test table with percent metrics and groupby', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      percent_metrics: PERCENT_METRIC,
      metrics: [],
      groupby: ['name'],
    });
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
  });

  it('Test table with groupby order desc', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['name'],
      order_desc: true,
    });
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
  });

  it('Test table with groupby + order by + no metric', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: [],
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
      order_desc: true,
    });
    // should contain only the group by column
    cy.get('.chart-container th').its('length').should('eq', 1);
    // should order correctly
    cy.get('.chart-container td:eq(0)').contains('Michael');
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
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
    cy.wait('@chartData').then(({ response }) => {
      cy.verifySliceContainer('table');
      expect(response?.body.result[0].data.length).to.eq(limit);
    });
    cy.get('[data-test="row-count-label"]').contains('10 rows');
  });

  it('Test table with columns and row limit', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      // should still work when query_mode is not-set/invalid
      query_mode: undefined,
      all_columns: ['state'],
      metrics: [],
      row_limit: 100,
    });

    // should display in raw records mode
    cy.get('div[data-test="query_mode"] .btn.active').contains('Raw records');
    cy.get('div[data-test="all_columns"]').should('be.visible');
    cy.get('div[data-test="groupby"]').should('not.exist');

    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
    cy.get('[data-test="row-count-label"]').contains('100 rows');

    // should allow switch back to aggregate mode
    cy.get('div[data-test="query_mode"] .btn').contains('Aggregate').click();
    cy.get('div[data-test="query_mode"] .btn.active').contains('Aggregate');
    cy.get('div[data-test="all_columns"]').should('not.exist');
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
      order_by_cols: ['["num", false]'],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.wait('@chartData').then(({ response }) => {
      cy.verifySliceContainer('table');
      const records = response?.body.result[0].data;
      expect(records[0].num).greaterThan(records[records.length - 1].num);
    });
  });

  it('Test table with simple filter', () => {
    const metrics = ['count'];
    const filters = [SIMPLE_FILTER];

    const formData = { ...VIZ_DEFAULTS, metrics, adhoc_filters: filters };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
  });

  it('Tests table number formatting with % in metric name', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      percent_metrics: PERCENT_METRIC,
      groupby: ['state'],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({
      waitAlias: '@chartData',
      querySubstring: /group by.*state/i,
      chartSelector: 'table',
    });
    cy.get('td').contains(/\d*%/);
  });
});
