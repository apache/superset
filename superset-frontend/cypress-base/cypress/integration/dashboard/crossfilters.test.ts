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
import { ChartSpec, waitForChartLoad } from 'cypress/utils';
import { SUPPORTED_CHARTS_DASHBOARD } from 'cypress/utils/urls';
import { SUPPORTED_TIER1_CHARTS } from './utils';

function setTopLevelTab(tabName: string) {
  cy.get("div#TABS-TOP div[role='tab']")
    .should('exist')
    .contains(tabName)
    .click();
}

function clickCrossFilterMenu() {
  cy.getBySel('cross-filter-menu-item').should('exist').click({ force: true });
}

function waitForCharts(tier: ChartSpec[]) {
  tier.forEach(waitForChartLoad);
  // wait for charts to resize
  cy.wait(1000);
}

function toggleCrossFilters({
  config,
  rightclick = true,
  tier = SUPPORTED_TIER1_CHARTS,
}: {
  config: Record<string, any>;
  rightclick?: boolean;
  tier?: ChartSpec[];
}) {
  if (config?.type === 'default' || !config?.type) {
    if (rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}']`)
        .should('exist')
        .contains(config.emitterValue)
        .rightclick();
      clickCrossFilterMenu();
      waitForCharts(tier);
    }
    if (!rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}']`)
        .should('exist')
        .contains(config.emitterValue)
        .click();
      waitForCharts(tier);
    }
  }

  if (config.type === 'canvas') {
    const { coordinates } = config;
    if (rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}'] canvas`)
        .should('exist')
        .then($canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', coordinates[0], coordinates[1])
            .rightclick(coordinates[0], coordinates[1]);
          clickCrossFilterMenu();
          waitForCharts(tier);
        });
    }
    if (!rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}'] canvas`)
        .should('exist')
        .then($canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', coordinates[0], coordinates[1])
            .click(coordinates[0], coordinates[1]);
          waitForCharts(tier);
        });
    }
  }
}

function verifyDisabledCrossFilters(targetViz: string) {
  cy.get(`[data-test-viz-type='${targetViz}']`)
    .should('exist')
    .scrollIntoView()
    .rightclick();
  cy.getBySel('cross-filter-menu-item')
    .should('exist')
    .should('have.class', 'ant-dropdown-menu-item-disabled');
}

function verifyAppliedCrossFilters(affectedChart: Record<string, string>) {
  cy.get(`[data-test-viz-type='${affectedChart.affectedViz}']`)
    .should('exist')
    .within(() => {
      cy.getBySel('applied-filter-count').should('exist').contains('1');
      cy.getBySel('applied-filter-count').trigger('mouseover');
    })
    .then(() => {
      cy.getBySel('applied-cross-filters')
        .should('exist')
        .contains('Applied cross-filters (1)');
      cy.getBySel('cross-filter-lens').should('exist');
      cy.getBySel('cross-filter-name')
        .should('exist')
        .contains(affectedChart?.emitterTitle || affectedChart.emitterName, {
          matchCase: false,
        });
      cy.getBySel('cross-filter-value')
        .should('exist')
        .contains(affectedChart.emitterValue);
    });
}

function verifyNotAppliedCrossFilters() {
  cy.getBySel('applied-filter-count').should('not.exist');
}

function verifyAppliedCrossFilterBar(config: Record<string, string>) {
  const { emitterName, emitterTitle, emitterLabel, emitterValue } = config;
  cy.getBySel('dashboard-filters-panel').should('exist');
  cy.getBySel('filter-bar__expand-button')
    .should('exist')
    .click({ force: true });
  cy.getBySel('cross-filter-bar-collapse-title')
    .should('exist')
    .contains('Cross-filters');
  cy.getBySel('cross-filter-bar-title')
    .should('exist')
    .find('span')
    .first()
    .should('exist')
    .contains(emitterTitle || emitterName, { matchCase: false });
  cy.getBySel('cross-filter-bar-highlight').should('exist');
  cy.getBySel('cross-filter-bar-label').should('exist').contains(emitterLabel);
  cy.getBySel('cross-filter-bar-value').should('exist').contains(emitterValue);
  cy.getBySel('filter-bar__collapse-button').should('exist').click();
  cy.getBySel('dashboard-filters-panel').should('exist');
  // wait for charts to resize
  cy.wait(1000);
}

function verifyNotAppliedCrossFilterBar() {
  cy.getBySel('cross-filter-bar-title').should('not.exist');
}

function addCrossFilter(props: Record<string, any>) {
  const { config } = props;
  toggleCrossFilters({
    config,
    rightclick: props?.rightclick,
    tier: props?.tier,
  });
  if (props?.affectedViz) {
    verifyAppliedCrossFilters({
      affectedViz: props.affectedViz,
      ...config,
    });
  }
  verifyAppliedCrossFilterBar(config);
}

function removeCrossFilter(props: Record<string, any>) {
  const { config } = props;
  toggleCrossFilters({
    config,
    rightclick: props?.rightclick,
    tier: props?.tier,
  });
  verifyNotAppliedCrossFilters();
  verifyNotAppliedCrossFilterBar();
}

describe('Cross-filters Tier 1', () => {
  beforeEach(() => {
    cy.visit(SUPPORTED_CHARTS_DASHBOARD);
    setTopLevelTab('Tier 1');
    SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
  });

  describe('Big number', () => {
    it('is disabled', () => {
      verifyDisabledCrossFilters('big_number_total');
    });
  });

  describe('Big number with trendline', () => {
    it('is disabled', () => {
      verifyDisabledCrossFilters('big_number');
    });
  });

  describe('Table', () => {
    const emitterValues = {
      emitterName: 'table',
      emitterValue: 'boy',
      emitterLabel: 'gender',
    };
    const testAffectedChart = 'big_number_total';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Pivot Table', () => {
    const emitterValues = {
      emitterName: 'pivot_table_v2',
      emitterTitle: 'Pivot Table',
      emitterValue: 'CA',
      emitterLabel: 'state',
    };
    const testAffectedChart = 'big_number_total';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Time-Series Line Chart', () => {
    const emitterValues = {
      emitterName: 'echarts_timeseries_line',
      emitterTitle: 'Time-Series Line Chart',
      emitterValue: 'boy',
      emitterLabel: 'gender',
      type: 'canvas',
      coordinates: [70, 93],
    };
    const testAffectedChart = 'pivot_table_v2';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Time-Series Bar Chart V2', () => {
    const emitterValues = {
      emitterName: 'echarts_timeseries_bar',
      emitterTitle: 'Time-Series Bar Chart',
      emitterValue: 'boy',
      emitterLabel: 'gender',
      type: 'canvas',
      coordinates: [70, 93],
    };
    const testAffectedChart = 'pivot_table_v2';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Time-Series Area Chart', () => {
    const emitterValues = {
      emitterName: 'echarts_area',
      emitterTitle: 'Time-Series Area Chart',
      emitterValue: 'boy',
      emitterLabel: 'gender',
      type: 'canvas',
      coordinates: [70, 93],
    };
    const testAffectedChart = 'pie';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Time-Series Scatter Chart', () => {
    const emitterValues = {
      emitterName: 'echarts_timeseries_scatter',
      emitterTitle: 'Time-Series Scatter Chart',
      emitterValue: 'boy',
      emitterLabel: 'gender',
      type: 'canvas',
      coordinates: [70, 93],
    };
    const testAffectedChart = 'pie';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Pie', () => {
    const emitterValues = {
      emitterName: 'pie',
      emitterTitle: 'Pie Chart',
      emitterValue: 'boy',
      emitterLabel: 'gender',
      type: 'canvas',
      coordinates: [230, 190],
    };
    const testAffectedChart = 'pivot_table_v2';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
      });
    });
  });

  describe('Bar Chart', () => {
    it('is disabled', () => {
      verifyDisabledCrossFilters('dist_bar');
    });
  });

  describe('World Map', () => {
    const emitterValues = {
      emitterName: 'world_map',
      emitterTitle: '% Rural',
      emitterValue: 'DZA',
      emitterLabel: 'country_code',
    };
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .should('exist')
        .scrollIntoView()
        .rightclick();
      clickCrossFilterMenu();
      verifyAppliedCrossFilterBar(emitterValues);

      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .should('exist')
        .scrollIntoView()
        .rightclick();
      clickCrossFilterMenu();
      verifyNotAppliedCrossFilterBar();

      // click
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .should('exist')
        .scrollIntoView()
        .click();
      verifyAppliedCrossFilterBar(emitterValues);

      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .should('exist')
        .scrollIntoView()
        .click();
      verifyNotAppliedCrossFilterBar();
    });
  });
});
