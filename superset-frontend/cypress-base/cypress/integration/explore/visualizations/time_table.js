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

describe('Visualization > Time TableViz', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'time_table' };

  it('Test time series table multiple metrics last year total', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC, 'count'],
      column_collection: [
        {
          key: '9g4K-B-YL',
          label: 'Last Year',
          colType: 'time',
          timeLag: '1',
          comparisonType: 'value',
        },
      ],
      url: '',
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
    });
    cy.get('[data-test="time-table"]').within(() => {
      cy.get('span').contains('Sum(num)');
      cy.get('span').contains('COUNT(*)');
    });
  });

  it('Test time series table metric and group by last year total', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC],
      groupby: ['gender'],
      column_collection: [
        {
          key: '9g4K-B-YL',
          label: 'Last Year',
          colType: 'time',
          timeLag: '1',
          comparisonType: 'value',
        },
      ],
      url: '',
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
    });
    cy.get('[data-test="time-table"]').within(() => {
      cy.get('td').contains('boy');
      cy.get('td').contains('girl');
    });
  });

  it('Test time series various time columns', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC, 'count'],
      column_collection: [
        { key: 'LHHNPhamU', label: 'Current', colType: 'time', timeLag: 0 },
        {
          key: '9g4K-B-YL',
          label: 'Last Year',
          colType: 'time',
          timeLag: '1',
          comparisonType: 'value',
        },
        {
          key: 'JVZXtNu7_',
          label: 'YoY',
          colType: 'time',
          timeLag: 1,
          comparisonType: 'perc',
          d3format: '%',
        },
        { key: 'tN5Gba36u', label: 'Trend', colType: 'spark' },
      ],
      url: '',
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
    });
    cy.get('[data-test="time-table"]').within(() => {
      cy.get('th').contains('Current');
      cy.get('th').contains('Last Year');
      cy.get('th').contains('YoY');
      cy.get('th').contains('Trend');

      cy.get('span').contains('%');
      cy.get('svg')
        .first()
        .then(charts => {
          const firstChart = charts[0];
          expect(firstChart.clientWidth).greaterThan(0);
          expect(firstChart.clientHeight).greaterThan(0);
        });
    });
  });
});
