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
import { SUPPORTED_TIER1_CHARTS, SUPPORTED_TIER2_CHARTS } from './utils';

function setTopLevelTab(tabName: string) {
  cy.get("div#TABS-TOP div[role='tab']").contains(tabName).click();
}

function clickCrossFilterMenu(open = true) {
  const targetMenuItem = open ? 'Add cross-filter' : 'Remove cross-filter';
  cy.getBySel('cross-filter-menu-item')
    .should('not.have.class', 'ant-dropdown-menu-item-disabled')
    .contains(new RegExp(`^${targetMenuItem}$`))
    .click();
}

function verifyEmitterIcon(emitterName: string) {
  cy.get(`[data-test-viz-type='${emitterName}']`)
    .within(() => {
      cy.getBySel('cross-filters-emitted').should('exist').trigger('mouseover');
    })
    .then(() => {
      cy.get('.ant-tooltip-inner').contains(
        'This chart emits/applies cross-filters to other charts that use the same dataset',
      );
    });
}

function toggleCrossFilters({
  config,
  open = true,
  rightclick = true,
  tier = SUPPORTED_TIER1_CHARTS,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
  open?: boolean;
  rightclick?: boolean;
  tier?: ChartSpec[];
}) {
  if (config?.type === 'default' || !config?.type) {
    if (rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}']`)
        .scrollIntoView()
        .contains(config.emitterValue)
        .rightclick();
      clickCrossFilterMenu(open);
    }
    if (!rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}']`)
        .scrollIntoView()
        .contains(config.emitterValue)
        .click();
    }
  }

  if (config.type === 'canvas') {
    const { coordinates } = config;
    if (rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}'] canvas`).then(
        $canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', coordinates[0], coordinates[1])
            .rightclick(coordinates[0], coordinates[1]);
          clickCrossFilterMenu(open);
        },
      );
    }
    if (!rightclick) {
      cy.get(`[data-test-viz-type='${config.emitterName}'] canvas`).then(
        $canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', coordinates[0], coordinates[1])
            .click(coordinates[0], coordinates[1]);
        },
      );
    }
  }

  // wait for charts to update
  tier.forEach(waitForChartLoad);

  if (open) {
    verifyEmitterIcon(config.emitterName);
  }
}

function verifyDisabledCrossFilters(targetViz: string) {
  cy.get(`[data-test-viz-type='${targetViz}']`).scrollIntoView().rightclick();
  cy.getBySel('cross-filter-menu-item').should(
    'have.class',
    'ant-dropdown-menu-item-disabled',
  );
}

function verifyAppliedCrossFilters(affectedChart: Record<string, string>) {
  cy.get(`[data-test-viz-type='${affectedChart.affectedViz}']`)
    .within(() => {
      cy.getBySel('applied-filter-count').should('exist').contains('1');
      cy.getBySel('applied-filter-count').trigger('mouseover');
    })
    .then(() => {
      cy.getBySel('applied-cross-filters')
        .should('exist')
        .contains('Applied cross-filters (1)');
      cy.getBySel('cross-filter-lens').should('exist');
      cy.getBySel('cross-filter-name').contains(
        affectedChart?.emitterNameInTooltip || affectedChart.emitterName,
        {
          matchCase: false,
        },
      );
      cy.getBySel('cross-filter-value').contains(affectedChart.emitterValue);
    });
}

function verifyNotAppliedCrossFilters(
  emitterName: string,
  affectedChart?: string,
) {
  cy.get(`[data-test-viz-type='${emitterName}']`).within(() => {
    cy.getBySel('cross-filters-emitted').should('not.exist');
  });
  if (affectedChart) {
    cy.get(`[data-test-viz-type='${affectedChart}']`).within(() => {
      cy.getBySel('applied-filter-count').should('not.exist');
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addCrossFilter(props: Record<string, any>) {
  const { config } = props;
  toggleCrossFilters({
    config,
    open: true,
    rightclick: props?.rightclick,
    tier: props?.tier,
  });
  if (props?.affectedViz) {
    verifyAppliedCrossFilters({
      affectedViz: props.affectedViz,
      ...config,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeCrossFilter(props: Record<string, any>) {
  const { config, affectedViz } = props;
  toggleCrossFilters({
    config,
    open: false,
    rightclick: props?.rightclick,
    tier: props?.tier,
  });
  verifyNotAppliedCrossFilters(config.emitterName, affectedViz);
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
        open: true,
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
      emitterNameInTooltip: 'Pivot Table',
      emitterValue: 'CA',
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
        open: true,
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
      emitterNameInTooltip: 'Time-Series Line Chart',
      emitterValue: 'boy',
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
        open: true,
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
      emitterNameInTooltip: 'Time-Series Bar Chart',
      emitterValue: 'boy',
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
        open: true,
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
      emitterNameInTooltip: 'Time-Series Area Chart',
      emitterValue: 'boy',
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
        open: true,
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
      emitterNameInTooltip: 'Time-Series Scatter Chart',
      emitterValue: 'boy',
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
        open: true,
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
      emitterNameInTooltip: 'Pie Chart',
      emitterValue: 'boy',
      type: 'canvas',
      coordinates: [230, 190],
    };
    const testAffectedChart = 'dist_bar';
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
        open: true,
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
      coordinates: [230, 190],
    };
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .scrollIntoView()
        .rightclick();
      clickCrossFilterMenu(true);
      verifyEmitterIcon(emitterValues.emitterName);
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .scrollIntoView()
        .rightclick();
      clickCrossFilterMenu(false);
      verifyNotAppliedCrossFilters(emitterValues.emitterName);

      // click
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .scrollIntoView()
        .click();
      verifyEmitterIcon(emitterValues.emitterName);
      cy.get(`[data-test-viz-type='${emitterValues.emitterName}']`)
        .scrollIntoView()
        .click();
      verifyNotAppliedCrossFilters(emitterValues.emitterName);
    });
  });
});
/*
  { name: 'Box Plot Chart', viz: 'box_plot' },
  { name: 'Bubble Chart', viz: 'bubble' },
  { name: 'Calendar Heatmap Chart', viz: 'cal_heatmap' },
  { name: 'Chord Chart', viz: 'chord' },
  { name: 'Time-Series Percent Change Chart', viz: 'compare' },
  { name: 'Time-Series Generic Chart', viz: 'echarts_timeseries' },
  { name: 'Time-Series Smooth Line Chart', viz: 'echarts_timeseries_smooth' },
  { name: 'Time-Series Step Line Chart', viz: 'echarts_timeseries_step' },
  { name: 'Funnel Chart', viz: 'funnel' },
  { name: 'Gauge Chart', viz: 'gauge_chart' },
  { name: 'Heatmap Chart', viz: 'heatmap' },
  { name: 'Line Chart', viz: 'line' },
  { name: 'Mixed Chart', viz: 'mixed_timeseries' },
  { name: 'Partition Chart', viz: 'partition' },
  { name: 'Radar Chart', viz: 'radar' },
  { name: 'Nightingale Chart', viz: 'rose' },
  { name: 'Sankey Chart', viz: 'sankey' },
  { name: 'Sunburst Chart', viz: 'sunburst' },
  { name: 'Treemap Chart', viz: 'treemap' },
  { name: 'Treemap V2 Chart', viz: 'treemap_v2' },
  { name: 'Word Cloud Chart', viz: 'word_cloud' },
*/
describe('Cross-filters Tier 2', () => {
  const tier = SUPPORTED_TIER2_CHARTS;
  beforeEach(() => {
    cy.visit(SUPPORTED_CHARTS_DASHBOARD);
    setTopLevelTab('Tier 2');
    tier.forEach(waitForChartLoad);
  });
  describe.only('Box Plot Chart', () => {
    const emitterValues = {
      emitterName: 'box_plot',
      emitterNameInTooltip: 'Box Plot Chart',
      emitterValue: 'boy',
      type: 'canvas',
      coordinates: [135, 275],
    };
    const testAffectedChart = 'bubble';
    it('adds and removes cross-filter with click and rightclick', () => {
      // rightclick
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        tier,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        tier,
      });

      // click
      addCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        open: true,
        rightclick: false,
        tier,
      });
      removeCrossFilter({
        config: emitterValues,
        affectedViz: testAffectedChart,
        rightclick: false,
        tier,
      });
    });
  });
});

describe('Drill to detail modal', () => {
  beforeEach(() => {
    closeModal();
  });

  describe('Tier 1 charts', () => {
    before(() => {
      cy.visit(SUPPORTED_CHARTS_DASHBOARD);
      setTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });

    describe('Modal actions', () => {
      it('opens the modal from the context menu', () => {
        openModalFromMenu('big_number_total');

        cy.get("[role='dialog'] .draggable-trigger").should(
          'contain',
          'Drill to detail: Big Number',
        );
      });

      it('refreshes the data', () => {
        openModalFromMenu('big_number_total');
        // move to the last page
        cy.get('.ant-pagination-item').eq(5).click();
        // skips error on pagination
        cy.on('uncaught:exception', () => false);
        cy.wait('@samples');
        // reload
        cy.get("[aria-label='reload']").click();
        cy.wait('@samples');
        // make sure it started back from first page
        cy.get('.ant-pagination-item-active').should('contain', '1');
      });

      it('paginates', () => {
        openModalFromMenu('big_number_total');
        // checking the data
        cy.getBySel('row-count-label').should('contain', '75.7k rows');
        cy.get('.virtual-table-cell').should($rows => {
          expect($rows).to.contain('Amy');
        });
        // checking the paginated data
        cy.get('.ant-pagination-item')
          .should('have.length', 6)
          .should($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('1514');
          });
        cy.get('.ant-pagination-item').eq(4).click();
        // skips error on pagination
        cy.on('uncaught:exception', () => false);
        cy.wait('@samples');
        cy.get('.virtual-table-cell').should($rows => {
          expect($rows).to.contain('Kelly');
        });

        // verify scroll top on pagination
        cy.getBySelLike('Number-modal').find('.virtual-grid').scrollTo(0, 200);

        cy.get('.virtual-grid').contains('Juan').should('not.be.visible');

        cy.get('.ant-pagination-item').eq(0).click();

        cy.get('.virtual-grid').contains('Aaron').should('be.visible');
      });
    });

    describe('Big number total', () => {
      it('opens the modal with no filters', () => {
        interceptSamples();

        // opens the modal by clicking on the number on the chart
        cy.get("[data-test-viz-type='big_number_total'] .header-line")
          .scrollIntoView()
          .rightclick();

        openModalFromChartContext('Drill to detail');

        cy.getBySel('filter-val').should('not.exist');
      });
    });

    describe('Big number with trendline', () => {
      it('opens the modal with the correct data', () => {
        interceptSamples();

        // opens the modal by clicking on the number
        cy.get("[data-test-viz-type='big_number'] .header-line")
          .scrollIntoView()
          .rightclick();

        openModalFromChartContext('Drill to detail');

        cy.getBySel('filter-val').should('not.exist');

        closeModal();

        // opens the modal by clicking on the trendline
        cy.get("[data-test-viz-type='big_number'] canvas").then($canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', 1, 14)
            .rightclick(1, 14);

          openModalFromChartContext('Drill to detail by 1965');

          // checking the filter
          cy.getBySel('filter-val').should('contain', '1965');
        });
      });
    });

    describe('Table', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='table']")
          .scrollIntoView()
          .contains('boy')
          .rightclick();

        openModalFromChartContext('Drill to detail by boy');

        cy.getBySel('filter-val').should('contain', 'boy');

        closeModal();

        cy.get("[data-test-viz-type='table']")
          .scrollIntoView()
          .contains('girl')
          .rightclick();

        openModalFromChartContext('Drill to detail by girl');

        cy.getBySel('filter-val').should('contain', 'girl');
      });
    });

    describe('Pivot Table V2', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='pivot_table_v2']")
          .scrollIntoView()
          .find('[role="gridcell"]')
          .first()
          .rightclick();

        openModalFromChartContext('Drill to detail by boy');

        cy.getBySel('filter-val').should('contain', 'boy');
        closeModal();

        cy.get("[data-test-viz-type='pivot_table_v2']")
          .scrollIntoView()
          .find('[role="gridcell"]')
          .first()
          .rightclick();

        openModalFromChartContext('Drill to detail by CA');

        cy.getBySel('filter-val').should('contain', 'CA');
        closeModal();

        cy.get("[data-test-viz-type='pivot_table_v2']")
          .scrollIntoView()
          .find('[role="gridcell"]')
          .eq(3)
          .rightclick();

        openModalFromChartContext('Drill to detail by girl');

        cy.getBySel('filter-val').should('contain', 'girl');
        closeModal();

        cy.get("[data-test-viz-type='pivot_table_v2']")
          .scrollIntoView()
          .find('[role="gridcell"]')
          .eq(3)
          .rightclick();

        openModalFromChartContext('Drill to detail by FL');

        cy.getBySel('filter-val').should('contain', 'FL');
        closeModal();

        cy.get("[data-test-viz-type='pivot_table_v2']")
          .scrollIntoView()
          .find('[role="gridcell"]')
          .eq(3)
          .rightclick();

        openModalFromChartContext('Drill to detail by all');

        cy.getBySel('filter-val').first().should('contain', 'girl');
        cy.getBySel('filter-val').eq(1).should('contain', 'FL');
      });
    });

    describe('Time-Series Line Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_timeseries_line');
      });
    });

    describe('Time-series Bar Chart', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='echarts_timeseries_bar'] canvas").then(
          $canvas => {
            cy.wrap($canvas).scrollIntoView().rightclick(70, 100);

            openModalFromChartContext('Drill to detail by 1965');
            cy.getBySel('filter-val').should('contain', '1965');
            closeModal();

            cy.wrap($canvas).scrollIntoView().rightclick(70, 100);

            openModalFromChartContext('Drill to detail by boy');
            cy.getBySel('filter-val').should('contain', 'boy');
            closeModal();

            cy.wrap($canvas).scrollIntoView().rightclick(70, 100);

            openModalFromChartContext('Drill to detail by all');
            cy.getBySel('filter-val').first().should('contain', '1965');
            cy.getBySel('filter-val').eq(1).should('contain', 'boy');
            closeModal();

            cy.wrap($canvas).scrollIntoView().rightclick(72, 200);

            openModalFromChartContext('Drill to detail by girl');
            cy.getBySel('filter-val').should('contain', 'girl');
          },
        );
      });
    });

    describe('Time-Series Area Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_area');
      });
    });

    describe('Time-Series Scatter Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_timeseries_scatter');
      });
    });

    describe('Pie', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        // opens the modal by clicking on the slice of the Pie chart
        cy.get("[data-test-viz-type='pie'] canvas").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(130, 150);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
          closeModal();

          cy.wrap($canvas).scrollIntoView().rightclick(230, 190);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
        });
      });
    });

    describe('World Map', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='world_map'] svg").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(70, 150);
          openModalFromChartContext('Drill to detail by USA');
          cy.getBySel('filter-val').should('contain', 'USA');
          closeModal();
        });
        cy.get("[data-test-viz-type='world_map'] svg").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(200, 140);
          openModalFromChartContext('Drill to detail by SVK');
          cy.getBySel('filter-val').should('contain', 'SVK');
        });
      });
    });

    describe('Bar Chart', () => {
      it('opens the modal for unsupported chart without filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='dist_bar'] svg").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(70, 150);
          openModalFromChartContext('Drill to detail');
          cy.getBySel('filter-val').should('not.exist');
        });
      });
    });
  });

  describe('Tier 2 charts', () => {
    before(() => {
      cy.visit(SUPPORTED_CHARTS_DASHBOARD);
      setTopLevelTab('Tier 2');
      SUPPORTED_TIER2_CHARTS.forEach(waitForChartLoad);
    });

    describe('Modal actions', () => {
      it('clears filters', () => {
        interceptSamples();

        // opens the modal by clicking on the box on the chart
        cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
          const canvasWidth = $canvas.width() || 0;
          const canvasHeight = $canvas.height() || 0;
          const canvasCenterX = canvasWidth / 3;
          const canvasCenterY = (canvasHeight * 5) / 6;

          cy.wrap($canvas)
            .scrollIntoView()
            .rightclick(canvasCenterX, canvasCenterY, { force: true });

          openModalFromChartContext('Drill to detail by boy');

          // checking the filter
          cy.getBySel('filter-val').should('contain', 'boy');
          cy.getBySel('row-count-label').should('contain', '39.2k rows');
          cy.get('.ant-pagination-item')
            .should('have.length', 6)
            .then($pages => {
              expect($pages).to.contain('1');
              expect($pages).to.contain('785');
            });

          // close the filter and test that data was reloaded
          cy.getBySel('filter-col').find("[aria-label='close']").click();
          cy.wait('@samples');
          cy.getBySel('row-count-label').should('contain', '75.7k rows');
          cy.get('.ant-pagination-item-active').should('contain', '1');
          cy.get('.ant-pagination-item')
            .should('have.length', 6)
            .then($pages => {
              expect($pages).to.contain('1');
              expect($pages).to.contain('1514');
            });
        });
      });
    });

    describe('Box plot', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', 135, 275)
            .rightclick(135, 275);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
          closeModal();

          cy.wrap($canvas)
            .scrollIntoView()
            .trigger('mousemove', 270, 280)
            .rightclick(270, 280);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });

    describe('Time-Series Generic Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_timeseries');
      });
    });

    describe('Time-Series Smooth Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_timeseries_smooth');
      });
    });

    describe('Time-Series Step Line Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('echarts_timeseries_step');
      });
    });

    describe('Funnel Chart', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='funnel'] canvas").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(170, 90);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
          closeModal();

          cy.wrap($canvas).scrollIntoView().rightclick(190, 250);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });

    describe('Gauge Chart', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='gauge_chart'] canvas").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(135, 95);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
          closeModal();

          cy.wrap($canvas).scrollIntoView().rightclick(95, 135);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });

    describe('Mixed Chart', () => {
      it('opens the modal with the correct filters', () => {
        testTimeChart('mixed_timeseries');
      });
    });

    describe('Radar Chart', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='radar'] canvas").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(180, 45);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
          closeModal();

          cy.wrap($canvas).scrollIntoView().rightclick(180, 85);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });

    describe('Treemap', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='treemap_v2'] canvas").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(100, 30);

          openModalFromChartContext('Drill to detail by boy');
          cy.getBySel('filter-val').should('contain', 'boy');
          closeModal();

          cy.wrap($canvas).scrollIntoView().rightclick(150, 250);

          openModalFromChartContext('Drill to detail by girl');
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });
  });
});
*/
