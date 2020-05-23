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
      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('state{enter}');
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
    const metric = 'sum(sum_girls)';
    const metricName = 'Girl Births';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__clear-indicator').click();
      cy.get('.Select__control input').type('sum_girls');
      cy.get('.Select__option--is-focused').trigger('mousedown').click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('.popover-title').within(() => {
        cy.get('span').click();
        cy.get('input').type(metricName);
      });
      cy.get('button').contains('Save').click();
    });
    cy.get('.Select__multi-value__label').contains(metricName);

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metricName}"`, // SQL statement
      chartSelector: 'svg',
    });
  });

  it('Switch from simple to custom sql', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    // select column "num"
    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__clear-indicator').click();
      cy.get('.Select__control').click();
      cy.get('.Select__control input').type('num');
      cy.get('.option-label').contains(/^num$/).click();
    });

    // add custom SQL
    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type('/COUNT(DISTINCT name)', { force: true });
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();

    const metric = 'SUM(num)/COUNT(DISTINCT name)';
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
      chartSelector: 'svg',
    });
  });

  it('Switch from custom sql tabs to simple', () => {
    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__dropdown-indicator').click();
      cy.get('input[type=text]').type('sum_girls{enter}');
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_identifier').contains('sum_girls');
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type('{selectall}{backspace}SUM(num)');
      cy.get('#adhoc-metric-edit-tabs-tab-SIMPLE').click();
      cy.get('.Select__single-value').contains(/^num$/);
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();

    const metric = 'SUM(num)';
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
      chartSelector: 'svg',
    });
  });

  it('Typing starts with aggregate function name', () => {
    // select column "num"
    cy.get('[data-test=metrics]').within(() => {
      cy.get('.Select__dropdown-indicator').click();
      cy.get('.Select__control input[type=text]').type('avg(');
      cy.get('.Select__option').contains('ds');
      cy.get('.Select__option').contains('name');
      cy.get('.Select__option').contains('sum_boys').click();
    });

    const metric = 'AVG(sum_boys)';
    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      querySubstring: `${metric} AS "${metric}"`,
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
      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('name{enter}');
    });
    cy.get('#filter-edit-popover').within(() => {
      cy.get('[data-test=adhoc-filter-simple-value]').within(() => {
        cy.get('.Select__control').click();
        cy.get('input[type=text]').type('Any{enter}');
      });
      cy.get('button').contains('Save').click();
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
      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('name{enter}');
    });

    cy.get('#filter-edit-popover').within(() => {
      cy.get('#adhoc-filter-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input').type("'Amy' OR name = 'Bob'");
      cy.get('button').contains('Save').click();
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

    cy.get('.panel-title').contains('Advanced Analytics').click();

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('28 days{enter}');

      cy.get('.Select__control').click();
      cy.get('input[type=text]').type('364 days{enter}');
      cy.get('.Select__multi-value__label').contains('364 days');
    });

    cy.get('button.query').click();
    cy.wait('@postJson');
    cy.reload();
    cy.verifySliceSuccess({
      waitAlias: '@postJson',
      chartSelector: 'svg',
    });

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.Select__multi-value__label').contains('364 days');
      cy.get('.Select__multi-value__label').contains('28 days');
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
      cy.get('[data-test=annotation-layer-name-header]')
        .siblings()
        .first()
        .within(() => {
          cy.get('input').type('Goal line');
        });
      cy.get('[data-test=annotation-layer-value-header]')
        .siblings()
        .first()
        .within(() => {
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
