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
// eslint-disable-next-line import/no-extraneous-dependencies
import { Interception } from 'cypress/types/net-stubbing';
import { waitForChartLoad } from 'cypress/utils';
import { SUPPORTED_CHARTS_DASHBOARD } from 'cypress/utils/urls';
import {
  openTopLevelTab,
  SUPPORTED_TIER1_CHARTS,
  SUPPORTED_TIER2_CHARTS,
} from './utils';
import {
  interceptExploreJson,
  interceptV1ChartData,
  interceptFormDataKey,
} from '../explore/utils';

const closeModal = () => {
  cy.get('body').then($body => {
    if ($body.find('[data-test="close-drill-by-modal"]').length) {
      cy.getBySel('close-drill-by-modal').click({ force: true });
    }
  });
};

const openTableContextMenu = (
  cellContent: string,
  tableSelector = "[data-test-viz-type='table']",
) => {
  cy.get(tableSelector).scrollIntoView();
  cy.get(tableSelector).contains(cellContent).first().rightclick();
};

const drillBy = (targetDrillByColumn: string, isLegacy = false) => {
  if (isLegacy) {
    interceptExploreJson('legacyData');
  } else {
    interceptV1ChartData();
  }

  cy.get('.antd5-dropdown:not(.antd5-dropdown-hidden)')
    .should('be.visible')
    .find("[role='menu'] [role='menuitem']")
    .contains(/^Drill by$/)
    .trigger('mouseover', { force: true });

  cy.get(
    '.antd5-dropdown-menu-submenu:not(.antd5-dropdown-menu-submenu-hidden) [data-test="drill-by-submenu"]',
  )
    .should('be.visible')
    .find('[role="menuitem"]')
    .then($el => {
      cy.wrap($el)
        .contains(new RegExp(`^${targetDrillByColumn}$`))
        .trigger('keydown', { keyCode: 13, which: 13, force: true });
    });

  if (isLegacy) {
    return cy.wait('@legacyData');
  }
  return cy.wait('@v1Data');
};

const verifyExpectedFormData = (
  interceptedRequest: Interception,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expectedFormData: Record<string, any>,
) => {
  const actualFormData = interceptedRequest.request.body?.form_data;
  Object.entries(expectedFormData).forEach(([key, val]) => {
    expect(actualFormData?.[key]).to.eql(val);
  });
};

const testEchart = (
  vizType: string,
  chartName: string,
  drillClickCoordinates: [[number, number], [number, number]],
  furtherDrillDimension = 'name',
) => {
  cy.get(`[data-test-viz-type='${vizType}'] canvas`).then($canvas => {
    // click 'boy'
    cy.wrap($canvas).scrollIntoView();
    cy.wrap($canvas).trigger(
      'mouseover',
      drillClickCoordinates[0][0],
      drillClickCoordinates[0][1],
    );
    cy.wrap($canvas).rightclick(
      drillClickCoordinates[0][0],
      drillClickCoordinates[0][1],
    );

    drillBy('state').then(intercepted => {
      verifyExpectedFormData(intercepted, {
        groupby: ['state'],
        adhoc_filters: [
          {
            clause: 'WHERE',
            comparator: 'boy',
            expressionType: 'SIMPLE',
            operator: '==',
            operatorId: 'EQUALS',
            subject: 'gender',
          },
        ],
      });
    });

    cy.getBySel(`"Drill by: ${chartName}-modal"`).as('drillByModal');

    cy.get('@drillByModal')
      .find('.draggable-trigger')
      .should('contain', chartName);

    cy.get('@drillByModal')
      .find('.ant-breadcrumb')
      .should('be.visible')
      .and('contain', 'gender (boy)')
      .and('contain', '/')
      .and('contain', 'state');

    cy.get('@drillByModal')
      .find('[data-test="drill-by-chart"]')
      .should('be.visible');

    // further drill
    cy.get(`[data-test="drill-by-chart"] canvas`).then($canvas => {
      // click 'other'
      cy.wrap($canvas).scrollIntoView();
      cy.wrap($canvas).trigger(
        'mouseover',
        drillClickCoordinates[1][0],
        drillClickCoordinates[1][1],
      );
      cy.wrap($canvas).rightclick(
        drillClickCoordinates[1][0],
        drillClickCoordinates[1][1],
      );

      drillBy(furtherDrillDimension).then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupby: [furtherDrillDimension],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
            {
              clause: 'WHERE',
              comparator: 'other',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'state',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible');

      // undo - back to drill by state
      interceptV1ChartData('drillByUndo');
      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'state (other)')
        .and('contain', furtherDrillDimension)
        .contains('state (other)')
        .click();
      cy.wait('@drillByUndo').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupby: ['state'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('not.contain', 'state (other)')
        .and('not.contain', furtherDrillDimension)
        .and('contain', 'state');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible');
    });
  });
};

describe('Drill by modal', () => {
  beforeEach(() => {
    closeModal();
  });
  before(() => {
    cy.visit(SUPPORTED_CHARTS_DASHBOARD);
  });

  describe('Modal actions + Table', () => {
    before(() => {
      closeModal();
      openTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });

    it('opens the modal from the context menu', () => {
      openTableContextMenu('boy');
      drillBy('state').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupby: ['state'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
          ],
        });
      });

      cy.getBySel('"Drill by: Table-modal"').as('drillByModal');

      cy.get('@drillByModal')
        .find('.draggable-trigger')
        .should('contain', 'Drill by: Table');

      cy.get('@drillByModal')
        .find('[data-test="metadata-bar"]')
        .should('be.visible');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'state');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('contain', 'state')
        .and('contain', 'sum__num');

      // further drilling
      openTableContextMenu('CA', '[data-test="drill-by-chart"]');
      drillBy('name').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupby: ['name'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
            {
              clause: 'WHERE',
              comparator: 'CA',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'state',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('not.contain', 'state')
        .and('contain', 'name')
        .and('contain', 'sum__num');

      // undo - back to drill by state
      interceptV1ChartData('drillByUndo');
      interceptFormDataKey();
      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'state (CA)')
        .and('contain', 'name')
        .contains('state (CA)')
        .click();
      cy.wait('@drillByUndo').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupby: ['state'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('not.contain', 'name')
        .and('contain', 'state')
        .and('contain', 'sum__num');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('not.contain', 'state (CA)')
        .and('not.contain', 'name')
        .and('contain', 'state');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-display-toggle"]')
        .contains('Table')
        .click();

      cy.getBySel('drill-by-chart').should('not.exist');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-results-table"]')
        .should('be.visible');

      cy.wait('@formDataKey').then(intercept => {
        cy.get('@drillByModal')
          .contains('Edit chart')
          .should('have.attr', 'href')
          .and(
            'contain',
            `/explore/?form_data_key=${intercept.response?.body?.key}`,
          );
      });
    });
  });

  describe('Tier 1 charts', () => {
    before(() => {
      closeModal();
      openTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });

    it('Pivot Table', () => {
      openTableContextMenu('boy', "[data-test-viz-type='pivot_table_v2']");
      drillBy('name').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupbyRows: ['state'],
          groupbyColumns: ['name'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
          ],
        });
      });

      cy.getBySel('"Drill by: Pivot Table-modal"').as('drillByModal');

      cy.get('@drillByModal')
        .find('.draggable-trigger')
        .should('contain', 'Drill by: Pivot Table');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'name');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('contain', 'state')
        .and('contain', 'name')
        .and('contain', 'sum__num')
        .and('not.contain', 'Gender');

      openTableContextMenu('CA', '[data-test="drill-by-chart"]');
      drillBy('ds').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupbyColumns: ['name'],
          groupbyRows: ['ds'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
            {
              clause: 'WHERE',
              comparator: 'CA',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'state',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('contain', 'name')
        .and('contain', 'ds')
        .and('contain', 'sum__num')
        .and('not.contain', 'state');

      interceptV1ChartData('drillByUndo');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'name (CA)')
        .and('contain', 'ds')
        .contains('name (CA)')
        .click();
      cy.wait('@drillByUndo').then(intercepted => {
        verifyExpectedFormData(intercepted, {
          groupbyRows: ['state'],
          groupbyColumns: ['name'],
          adhoc_filters: [
            {
              clause: 'WHERE',
              comparator: 'boy',
              expressionType: 'SIMPLE',
              operator: '==',
              operatorId: 'EQUALS',
              subject: 'gender',
            },
          ],
        });
      });

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('not.contain', 'ds')
        .and('contain', 'state')
        .and('contain', 'name')
        .and('contain', 'sum__num');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('not.contain', 'name (CA)')
        .and('not.contain', 'ds')
        .and('contain', 'name');
    });

    it('Line chart', () => {
      testEchart('echarts_timeseries_line', 'Line Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Area Chart', () => {
      testEchart('echarts_area', 'Area Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Scatter Chart', () => {
      testEchart('echarts_timeseries_scatter', 'Scatter Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Bar Chart', () => {
      testEchart('echarts_timeseries_bar', 'Bar Chart', [
        [70, 94],
        [362, 68],
      ]);
    });

    it('Pie Chart', () => {
      testEchart('pie', 'Pie Chart', [
        [243, 167],
        [534, 248],
      ]);
    });
  });

  describe('Tier 2 charts', () => {
    before(() => {
      closeModal();
      openTopLevelTab('Tier 2');
      SUPPORTED_TIER2_CHARTS.forEach(waitForChartLoad);
    });

    it('Box Plot Chart', () => {
      testEchart(
        'box_plot',
        'Box Plot Chart',
        [
          [139, 277],
          [787, 441],
        ],
        'ds',
      );
    });

    it('Generic Chart', () => {
      testEchart('echarts_timeseries', 'Generic Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Smooth Line Chart', () => {
      testEchart('echarts_timeseries_smooth', 'Smooth Line Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Step Line Chart', () => {
      testEchart('echarts_timeseries_step', 'Step Line Chart', [
        [70, 93],
        [70, 93],
      ]);
    });

    it('Funnel Chart', () => {
      testEchart('funnel', 'Funnel Chart', [
        [154, 80],
        [421, 39],
      ]);
    });

    it('Gauge Chart', () => {
      testEchart('gauge_chart', 'Gauge Chart', [
        [151, 95],
        [300, 143],
      ]);
    });

    it.skip('Radar Chart', () => {
      testEchart('radar', 'Radar Chart', [
        [182, 49],
        [423, 91],
      ]);
    });

    it('Treemap V2 Chart', () => {
      testEchart('treemap_v2', 'Treemap V2 Chart', [
        [145, 84],
        [220, 105],
      ]);
    });

    it('Mixed Chart', () => {
      cy.get('[data-test-viz-type="mixed_timeseries"] canvas').then($canvas => {
        // click 'boy'
        cy.wrap($canvas).scrollIntoView();
        cy.wrap($canvas).trigger('mouseover', 70, 93);
        cy.wrap($canvas).rightclick(70, 93);

        drillBy('name').then(intercepted => {
          const { queries } = intercepted.request.body;
          expect(queries[0].columns).to.eql(['name']);
          expect(queries[0].filters).to.eql([
            { col: 'gender', op: '==', val: 'boy' },
          ]);
          expect(queries[1].columns).to.eql(['state']);
          expect(queries[1].filters).to.eql([]);
        });

        cy.getBySel('"Drill by: Mixed Chart-modal"').as('drillByModal');

        cy.get('@drillByModal')
          .find('.draggable-trigger')
          .should('contain', 'Mixed Chart');

        cy.get('@drillByModal')
          .find('.ant-breadcrumb')
          .should('be.visible')
          .and('contain', 'gender (boy)')
          .and('contain', '/')
          .and('contain', 'name');

        cy.get('@drillByModal')
          .find('[data-test="drill-by-chart"]')
          .should('be.visible');

        // further drill
        cy.get(`[data-test="drill-by-chart"] canvas`).then($canvas => {
          // click second query
          cy.wrap($canvas).scrollIntoView();
          cy.wrap($canvas).trigger('mouseover', 246, 114);
          cy.wrap($canvas).rightclick(246, 114);

          drillBy('ds').then(intercepted => {
            const { queries } = intercepted.request.body;
            expect(queries[0].columns).to.eql(['name']);
            expect(queries[0].filters).to.eql([
              { col: 'gender', op: '==', val: 'boy' },
            ]);
            expect(queries[1].columns).to.eql(['ds']);
            expect(queries[1].filters).to.eql([
              { col: 'state', op: '==', val: 'other' },
            ]);
          });

          cy.get('@drillByModal')
            .find('[data-test="drill-by-chart"]')
            .should('be.visible');

          // undo - back to drill by state
          interceptV1ChartData('drillByUndo');
          cy.get('@drillByModal')
            .find('.ant-breadcrumb')
            .should('be.visible')
            .and('contain', 'gender (boy)')
            .and('contain', '/')
            .and('contain', 'name (other)')
            .and('contain', 'ds')
            .contains('name (other)')
            .click();

          cy.wait('@drillByUndo').then(intercepted => {
            const { queries } = intercepted.request.body;
            expect(queries[0].columns).to.eql(['name']);
            expect(queries[0].filters).to.eql([
              { col: 'gender', op: '==', val: 'boy' },
            ]);
            expect(queries[1].columns).to.eql(['state']);
            expect(queries[1].filters).to.eql([]);
          });

          cy.get('@drillByModal')
            .find('.ant-breadcrumb')
            .should('be.visible')
            .and('contain', 'gender (boy)')
            .and('contain', '/')
            .and('not.contain', 'name (other)')
            .and('not.contain', 'ds')
            .and('contain', 'name');

          cy.get('@drillByModal')
            .find('[data-test="drill-by-chart"]')
            .should('be.visible');
        });
      });
    });
  });
});
