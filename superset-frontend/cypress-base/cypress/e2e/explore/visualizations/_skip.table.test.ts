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
  beforeEach(() => {
    interceptChart({ legacy: false }).as('chartData');
  });

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

  it('Use default time column', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      granularity_sqla: undefined,
      metrics: ['count'],
    });
    cy.get('[data-test=adhoc_filters]').contains('ds');
  });

  it('Format non-numeric metrics correctly', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      include_time: true,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P3M',
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
      time_grain_sqla: 'P3M',
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
      querySubstring: /GROUP BY.*name/i,
      chartSelector: 'table',
    });
  });

  it('Test table with groupby + time column', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      include_time: true,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P3M',
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
    cy.get('.chart-container th').contains('ds').click();
    cy.get('.chart-container th').contains('ds').click();
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
    cy.visitChartByParams(formData);
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
    cy.get(
      'div[data-test="query_mode"] .ant-radio-button-wrapper-checked',
    ).contains('Raw records');
    cy.get('div[data-test="all_columns"]').should('be.visible');
    cy.get('div[data-test="groupby"]').should('not.exist');

    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
    cy.get('[data-test="row-count-label"]').contains('100 rows');

    // should allow switch back to aggregate mode
    cy.get('div[data-test="query_mode"] .ant-radio-button-wrapper')
      .contains('Aggregate')
      .click();
    cy.get(
      'div[data-test="query_mode"] .ant-radio-button-wrapper-checked',
    ).contains('Aggregate');
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

    cy.visitChartByParams(formData);
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

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@chartData', chartSelector: 'table' });
  });

  it('Tests table number formatting with % in metric name', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      percent_metrics: PERCENT_METRIC,
      groupby: ['state'],
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({
      waitAlias: '@chartData',
      querySubstring: /GROUP BY.*state/i,
      chartSelector: 'table',
    });
    cy.get('td').contains(/\d*%/);
  });

  it('Test row limit with server pagination toggle', () => {
    const serverPaginationSelector =
      '[data-test="server_pagination-header"] div.pull-left [type="checkbox"]';
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: ['count'],
      row_limit: 100,
    });

    // Enable server pagination
    cy.get(serverPaginationSelector).click();

    // Click row limit control and select high value (200k)
    cy.get('div[aria-label="Row limit"]').click();

    // Type 200000 and press enter to select the option
    cy.get('div[aria-label="Row limit"]')
      .find('.ant-select-selection-search-input:visible')
      .type('200000{enter}');

    // Verify that there is no error tooltip when server pagination is enabled
    cy.get('[data-test="error-tooltip"]').should('not.exist');

    // Disable server pagination
    cy.get(serverPaginationSelector).click();

    // Verify error tooltip appears
    cy.get('[data-test="error-tooltip"]').should('be.visible');

    // Trigger mouseover and verify tooltip text
    cy.get('[data-test="error-tooltip"]').trigger('mouseover');

    // Verify tooltip content
    cy.get('.ant-tooltip-inner').should('be.visible');
    cy.get('.ant-tooltip-inner').should(
      'contain',
      'Server pagination needs to be enabled for values over',
    );

    // Hide the tooltip by adding display:none style
    cy.get('.ant-tooltip').invoke('attr', 'style', 'display: none');

    // Enable server pagination again
    cy.get(serverPaginationSelector).click();

    cy.get('[data-test="error-tooltip"]').should('not.exist');

    cy.get('div[aria-label="Row limit"]').click();

    // Type 1000000
    cy.get('div[aria-label="Row limit"]')
      .find('.ant-select-selection-search-input:visible')
      .type('1000000');

    // Wait for 1 second
    cy.wait(1000);

    // Press enter
    cy.get('div[aria-label="Row limit"]')
      .find('.ant-select-selection-search-input:visible')
      .type('{enter}');

    // Wait for error tooltip to appear and verify its content
    cy.get('[data-test="error-tooltip"]')
      .should('be.visible')
      .trigger('mouseover');

    // Wait for tooltip content and verify
    cy.get('.ant-tooltip-inner').should('exist');
    cy.get('.ant-tooltip-inner').should('be.visible');

    // Verify tooltip content separately
    cy.get('.ant-tooltip-inner').should('contain', 'Value cannot exceed');
  });

  it('Test sorting with server pagination enabled', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: ['count'],
      groupby: ['name'],
      row_limit: 100000,
      server_pagination: true, // Enable server pagination
    });

    // Wait for the initial data load
    cy.wait('@chartData');

    // Get the first column header (name)
    cy.get('.chart-container th').contains('name').as('nameHeader');

    // Click to sort ascending
    cy.get('@nameHeader').click();
    cy.wait('@chartData');

    // Verify first row starts with 'A'
    cy.get('.chart-container td:first').invoke('text').should('match', /^[Aa]/);

    // Click again to sort descending
    cy.get('@nameHeader').click();
    cy.wait('@chartData');

    // Verify first row starts with 'Z'
    cy.get('.chart-container td:first').invoke('text').should('match', /^[Zz]/);

    // Test numeric sorting
    cy.get('.chart-container th').contains('COUNT').as('countHeader');

    // Click to sort ascending by count
    cy.get('@countHeader').click();
    cy.wait('@chartData');

    // Get first two count values and verify ascending order
    cy.get('.chart-container td:nth-child(2)').then($cells => {
      const first = parseFloat($cells[0].textContent || '0');
      const second = parseFloat($cells[1].textContent || '0');
      expect(first).to.be.at.most(second);
    });

    // Click again to sort descending
    cy.get('@countHeader').click();
    cy.wait('@chartData');

    // Get first two count values and verify descending order
    cy.get('.chart-container td:nth-child(2)').then($cells => {
      const first = parseFloat($cells[0].textContent || '0');
      const second = parseFloat($cells[1].textContent || '0');
      expect(first).to.be.at.least(second);
    });
  });

  it('Test search with server pagination enabled', () => {
    cy.visitChartByParams({
      ...VIZ_DEFAULTS,
      metrics: ['count'],
      groupby: ['name', 'state'],
      row_limit: 100000,
      server_pagination: true,
      include_search: true,
    });

    cy.wait('@chartData');

    const searchInputSelector = '.dt-global-filter input';

    // Basic search test
    cy.get(searchInputSelector).should('be.visible');

    cy.get(searchInputSelector).type('John');

    cy.wait('@chartData');

    cy.get('.chart-container tbody tr').each($row => {
      cy.wrap($row).contains(/John/i);
    });

    // Clear and test case-insensitive search
    cy.get(searchInputSelector).clear();

    cy.wait('@chartData');

    cy.get(searchInputSelector).type('mary');

    cy.wait('@chartData');

    cy.get('.chart-container tbody tr').each($row => {
      cy.wrap($row).contains(/Mary/i);
    });

    // Test special characters
    cy.get(searchInputSelector).clear();

    cy.get(searchInputSelector).type('Nicole');

    cy.wait('@chartData');

    cy.get('.chart-container tbody tr').each($row => {
      cy.wrap($row).contains(/Nicole/i);
    });

    // Test no results
    cy.get(searchInputSelector).clear();

    cy.get(searchInputSelector).type('XYZ123');

    cy.wait('@chartData');

    cy.get('.chart-container').contains('No records found');

    // Test column-specific search
    cy.get('.search-select').should('be.visible');

    cy.get('.search-select').click();

    cy.get('.ant-select-dropdown').should('be.visible');

    cy.get('.ant-select-item-option').contains('state').should('be.visible');

    cy.get('.ant-select-item-option').contains('state').click();

    cy.get(searchInputSelector).clear();

    cy.get(searchInputSelector).type('CA');

    cy.wait('@chartData');
    cy.wait(1000);

    cy.get('td[aria-labelledby="header-state"]').should('be.visible');

    cy.get('td[aria-labelledby="header-state"]')
      .first()
      .should('contain', 'CA');
  });
});
