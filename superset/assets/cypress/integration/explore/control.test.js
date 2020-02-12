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
// ***********************************************
// Tests for setting controls in the UI
// ***********************************************
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';

describe('Groupby', () => {
  it('Set groupby', () => {
    cy.server();
    cy.login();

    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=groupby]').within(() => {
      cy.get('.Select-control').click();
      cy.get('input.select-input').type('state', { force: true });
      cy.get('.VirtualizedSelectFocusedOption').click();
    });
    cy.get('button.query').click();
    cy.verifySliceSuccess({ waitAlias: '@postJson', chartSelector: 'svg' });
  });
});

describe('AdhocMetrics', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Clear metric and set simple adhoc metric', () => {
    const metricName = 'Girl Births';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('sum_girls', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('.popover-title').within(() => {
        cy.get('span').click();
        cy.get('input').type(metricName);
      });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: metricName,
      chartSelector: 'svg',
    });
  });

  it('Clear metric and set custom sql adhoc metric', () => {
    const metric = 'SUM(num)/COUNT(DISTINCT name)';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('num', { force: true });
      cy.get('.VirtualizedSelectOption[data-test=_col_num]')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type('/COUNT(DISTINCT name)', { force: true });
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: metric,
      chartSelector: 'svg',
    });
  });

  it('Switch between simple and custom sql tabs', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('sum_girls', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_identifier').contains('sum_girls');
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type('{selectall}{backspace}SUM(num)', { force: true });
      cy.get('#adhoc-metric-edit-tabs-tab-SIMPLE').click();
      cy.get('.select-value-label').contains('num');
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });
});

describe('AdhocFilters', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Set simple adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('name', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });
    cy.get('.adhoc-filter-option').click({ force: true });
    cy.get('#filter-edit-popover').within(() => {
      cy.get('[data-test=adhoc-filter-simple-value]').within(() => {
        cy.get('div.select-input').click({ force: true });
        cy.get('input.select-input').type('Amy', { force: true });
        cy.get('.VirtualizedSelectFocusedOption')
          .trigger('mousedown')
          .click();
      });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });

  it('Set custom adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('name', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('.adhoc-filter-option').click({ force: true });
    cy.get('#filter-edit-popover').within(() => {
      cy.get('#adhoc-filter-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type("'Amy' OR name = 'Bob'", { force: true });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });
  });
});


describe('Advanced analytics', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Create custom time compare', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('span')
      .contains('Advanced Analytics')
      .parent()
      .siblings()
      .first()
      .click();

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('364 days', { force: true });
      cy.get('.VirtualizedSelectOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('button.query').click();
    cy.wait('@postJson');
    cy.reload();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.select-value-label').contains('364 days');
    });
  });
});

describe('Annotations', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Create formula annotation y-axis goal line', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=annotation_layers]').within(() => {
      cy.get('button').click();
    });

    cy.get('.popover-content').within(() => {
      cy.get('[data-test=annotation-layer-name-header]').siblings().first().within(() => {
        cy.get('input').type('Goal line');
      });
      cy.get('[data-test=annotation-layer-value-header]').siblings().first().within(() => {
        cy.get('input').type('y=1400000');
      });
      cy.get('button').contains('OK').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });

    cy.get('.nv-legend-text').should('have.length', 2);
  });
});

describe('Time range filter', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Defaults to the correct tab for time_range params', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      metrics: [NUM_METRIC],
      viz_type: 'line',
      time_range: '100 years ago : now',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=time_range]').within(() => {
      cy.get('span.label').click();
    });

    cy.get('#filter-popover').within(() => {
      cy.get('div.tab-pane.active').within(() => {
        cy.get('div.PopoverSection :not(.dimmed)').within(() => {
          cy.get('input[value="100 years ago"]');
          cy.get('input[value="now"]');
        });
      });
    });
  });
});
