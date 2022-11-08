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
import { waitForChartLoad } from 'cypress/utils';
import { SUPPORTED_CHARTS_DASHBOARD } from 'cypress/utils/urls';
import { SUPPORTED_TIER1_CHARTS, SUPPORTED_TIER2_CHARTS } from './utils';

function interceptSamples() {
  cy.intercept(`/datasource/samples*`).as('samples');
}

function openModalFromMenu(chartType: string) {
  interceptSamples();

  cy.get(
    `[data-test-viz-type='${chartType}'] [aria-label='More Options']`,
  ).click();
  cy.get('.ant-dropdown')
    .not('.ant-dropdown-hidden')
    .find("[role='menu'] [role='menuitem']")
    .eq(5)
    .should('contain', 'Drill to detail')
    .click();
  cy.wait('@samples');
}

function openModalFromChartContext(targetMenuItem: string) {
  interceptSamples();

  cy.wait(500);
  if (targetMenuItem.startsWith('Drill to detail by')) {
    cy.get('.ant-dropdown')
      .not('.ant-dropdown-hidden')
      .first()
      .find("[role='menu'] [role='menuitem'] [title='Drill to detail by']")
      .trigger('mouseover');
    cy.wait(500);
    cy.get('[data-test="drill-to-detail-by-submenu"]')
      .not('.ant-dropdown-menu-hidden [data-test="drill-to-detail-by-submenu"]')
      .find('[role="menuitem"]')
      .contains(new RegExp(`^${targetMenuItem}$`))
      .first()
      .click();
  } else {
    cy.get('.ant-dropdown')
      .not('.ant-dropdown-hidden')
      .first()
      .find("[role='menu'] [role='menuitem']")
      .contains(new RegExp(`^${targetMenuItem}$`))
      .first()
      .click();
  }

  cy.wait('@samples');
}

function closeModal() {
  cy.get('body').then($body => {
    if ($body.find('[data-test="close-drilltodetail-modal"]').length) {
      cy.getBySel('close-drilltodetail-modal').click({ force: true });
    }
  });
}

function setTopLevelTab(tabName: string) {
  cy.get("div#TABS-TOP div[role='tab']").contains(tabName).click();
}

function testTimeChart(vizType: string) {
  interceptSamples();

  cy.get(`[data-test-viz-type='${vizType}'] canvas`).then($canvas => {
    cy.wrap($canvas)
      .scrollIntoView()
      .trigger('mousemove', 70, 93)
      .rightclick(70, 93);

    openModalFromChartContext('Drill to detail by 1965');
    cy.getBySel('filter-val').should('contain', '1965');
    closeModal();

    cy.wrap($canvas)
      .scrollIntoView()
      .trigger('mousemove', 70, 93)
      .rightclick(70, 93);

    openModalFromChartContext('Drill to detail by boy');
    cy.getBySel('filter-val').should('contain', 'boy');
    closeModal();

    cy.wrap($canvas)
      .scrollIntoView()
      .trigger('mousemove', 70, 93)
      .rightclick(70, 93);

    openModalFromChartContext('Drill to detail by all');
    cy.getBySel('filter-val').first().should('contain', '1965');
    cy.getBySel('filter-val').eq(1).should('contain', 'boy');
    closeModal();

    cy.wrap($canvas)
      .scrollIntoView()
      .trigger('mousemove', 70, 145)
      .rightclick(70, 145);
    openModalFromChartContext('Drill to detail by girl');
    cy.getBySel('filter-val').should('contain', 'girl');
    closeModal();

    cy.wrap($canvas)
      .scrollIntoView()
      .trigger('mousemove', 70, 145)
      .rightclick(70, 145);
    openModalFromChartContext('Drill to detail by all');
    cy.getBySel('filter-val').first().should('contain', '1965');
    cy.getBySel('filter-val').eq(1).should('contain', 'girl');
  });
}

describe('Drill to detail modal', () => {
  beforeEach(() => {
    cy.preserveLogin();
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
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .eq(7)
          .click();
        cy.wait('@samples');
        // reload
        cy.get("[aria-label='reload']").click();
        cy.wait('@samples');
        // make sure it started back from first page
        cy.get(".pagination-container [role='navigation'] li.active").should(
          'contain',
          '1',
        );
      });

      it('paginates', () => {
        openModalFromMenu('big_number_total');
        // checking the data
        cy.getBySel('row-count-label').should('contain', '75.7k rows');
        cy.get(".ant-modal-body [role='rowgroup'] [role='row']")
          .should('have.length', 50)
          .then($rows => {
            expect($rows).to.contain('Amy');
          });
        // checking the paginated data
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('1514');
          });
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .eq(7)
          .click();
        cy.wait('@samples');
        cy.get("[role='rowgroup'] [role='row']")
          .should('have.length', 43)
          .then($rows => {
            expect($rows).to.contain('Victoria');
          });
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

    describe('Time-series Bar Chart V2', () => {
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
          openModalFromChartContext('Drill to detail by United States');
          cy.getBySel('filter-val').should('contain', 'United States');
          closeModal();
        });
        cy.get("[data-test-viz-type='world_map'] svg").then($canvas => {
          cy.wrap($canvas).scrollIntoView().rightclick(200, 140);
          openModalFromChartContext('Drill to detail by Slovakia');
          cy.getBySel('filter-val').should('contain', 'Slovakia');
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
          cy.get(".pagination-container [role='navigation'] [role='button']")
            .should('have.length', 9)
            .then($pages => {
              expect($pages).to.contain('1');
              expect($pages).to.contain('785');
            });

          // close the filter and test that data was reloaded
          cy.getBySel('filter-col').find("[aria-label='close']").click();
          cy.wait('@samples');
          cy.getBySel('row-count-label').should('contain', '75.7k rows');
          cy.get(".pagination-container [role='navigation'] li.active").should(
            'contain',
            '1',
          );
          cy.get(".pagination-container [role='navigation'] [role='button']")
            .should('have.length', 9)
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

    describe('Treemap V2', () => {
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
