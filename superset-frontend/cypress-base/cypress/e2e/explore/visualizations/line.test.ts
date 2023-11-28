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

describe('Visualization > Line', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  const LINE_CHART_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'line' };

  it('should show validator error when no metric', () => {
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [] };
    cy.visitChartByParams(formData);
    cy.get('.panel-body').contains(
      `Add required control values to preview chart`,
    );
  });

  it('should not show validator error when metric added', () => {
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [] };
    cy.visitChartByParams(formData);
    cy.get('.panel-body').contains(
      `Add required control values to preview chart`,
    );
    cy.get('[data-test="metrics-header"]').contains('Metrics');
    cy.get('[data-test="metrics-header"] [data-test="error-tooltip"]').should(
      'exist',
    );

    cy.get('[data-test=metrics]')
      .contains('Drop columns/metrics here or click')
      .click();

    // Title edit for saved metrics is disabled - switch to Simple
    cy.get('[id="adhoc-metric-edit-tabs-tab-SIMPLE"]').click();

    cy.get('input[aria-label="Select column"]').click().type('num{enter}');
    cy.get('input[aria-label="Select aggregate options"]')
      .click()
      .type('sum{enter}');
    cy.get('[data-test="AdhocMetricEdit#save"]').contains('Save').click();

    cy.get('[data-test="metrics-header"]').contains('Metrics');
    cy.get('[data-test="metrics-header"] [data-test="error-tooltip"]').should(
      'not.exist',
    );

    cy.get('.ant-alert-warning').should('not.exist');
  });

  it('should allow negative values in Y bounds', () => {
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };
    cy.visitChartByParams(formData);
    cy.get('#controlSections-tab-display').click();
    cy.get('span').contains('Y Axis Bounds').scrollIntoView();
    cy.get('input[placeholder="Min"]').type('-0.1', { delay: 100 });
    cy.get('.ant-alert-warning').should('not.exist');
  });

  it('should allow type to search color schemes and apply the scheme', () => {
    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]')
      .focus()
      .type('bnbColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="bnbColors"]',
    ).should('exist');
    cy.get('.line .nv-legend .nv-legend-symbol')
      .first()
      .should('have.css', 'fill', 'rgb(41, 105, 107)');
  });

  it('should work with adhoc metric', () => {
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with groupby', () => {
    const metrics = ['count'];
    const groupby = ['gender'];
    const formData = { ...LINE_CHART_DEFAULTS, metrics, groupby };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with simple filter', () => {
    const metrics = ['count'];
    const filters = [SIMPLE_FILTER];
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      adhoc_filters: filters,
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with series limit sort asc', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with series limit sort desc', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
      order_desc: true,
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with rolling avg', () => {
    const metrics = [NUM_METRIC];
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      rolling_type: 'mean',
      rolling_periods: 10,
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with time shift 1 year', () => {
    const metrics = [NUM_METRIC];
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1 year'],
      comparison_type: 'values',
      groupby: ['gender'],
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });

    // Offset color should match original line color
    cy.get('.nv-legend-text')
      .contains('boy')
      .siblings()
      .first()
      .should('have.attr', 'style')
      .then(style => {
        cy.get('.nv-legend-text')
          .contains('boy, 1 year offset')
          .siblings()
          .first()
          .should('have.attr', 'style')
          .and('eq', style);
      });

    cy.get('.nv-legend-text')
      .contains('girl')
      .siblings()
      .first()
      .should('have.attr', 'style')
      .then(style => {
        cy.get('.nv-legend-text')
          .contains('girl, 1 year offset')
          .siblings()
          .first()
          .should('have.attr', 'style')
          .and('eq', style);
      });
  });

  it('should work with time shift yoy', () => {
    const metrics = [NUM_METRIC];
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1 year'],
      comparison_type: 'ratio',
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with time shift percentage change', () => {
    const metrics = [NUM_METRIC];
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1 year'],
      comparison_type: 'percentage',
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test verbose name shows up in legend', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: ['count'],
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('text.nv-legend-text').contains('COUNT(*)');
  });

  it('Test hidden annotation', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: ['count'],
      annotation_layers: [
        {
          name: 'Goal line',
          annotationType: 'FORMULA',
          sourceType: '',
          value: 'y=140000',
          overrides: { time_range: null },
          show: false,
          showLabel: false,
          titleColumn: '',
          descriptionColumns: [],
          timeColumn: '',
          intervalEndColumn: '',
          color: null,
          opacity: '',
          style: 'solid',
          width: 1,
          showMarkers: false,
          hideLine: false,
        },
      ],
    };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('.slice_container').within(() => {
      // Goal line annotation doesn't show up in legend
      cy.get('.nv-legend-text').should('have.length', 1);
    });
  });

  it('Test event annotation time override', () => {
    cy.request('/chart/api/read?_flt_3_slice_name=Daily+Totals').then(
      response => {
        const value = response.body.pks[0];
        const formData = {
          ...LINE_CHART_DEFAULTS,
          metrics: ['count'],
          annotation_layers: [
            {
              name: 'Yearly date',
              annotationType: 'EVENT',
              sourceType: 'table',
              value,
              overrides: { time_range: null },
              show: true,
              showLabel: false,
              titleColumn: 'ds',
              descriptionColumns: ['ds'],
              timeColumn: 'ds',
              color: null,
              opacity: '',
              style: 'solid',
              width: 1,
              showMarkers: false,
              hideLine: false,
            },
          ],
        };
        cy.visitChartByParams(formData);
      },
    );
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('.slice_container').within(() => {
      cy.get('.nv-event-annotation-layer-0')
        .children()
        .should('have.length', 44);
    });
  });
});
