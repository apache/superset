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
// Tests for links in the explore UI
// ***********************************************

import { HEALTH_POP_FORM_DATA_DEFAULTS } from './visualizations/shared.helper';

describe('Test explore links', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('GET', '/superset/explore_json/**').as('getJson');
    cy.route('POST', '/superset/explore_json/**').as('postJson');
  });

  it('Open and close view query modal', () => {
    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('button#query').click();
    cy.get('span')
      .contains('View query')
      .parent()
      .click();
    cy.wait('@postJson').then(() => {
      cy.get('code');
    });
    cy.get('.modal-header').within(() => {
      cy.get('button.close')
        .first()
        .click({ force: true });
    });
  });

  it('Visit short link', () => {
    cy.route('POST', 'r/shortner/').as('getShortUrl');

    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=short-link-button]').click();

    // explicitly wait for the url response
    cy.wait('@getShortUrl');

    cy.wait(100);

    cy.get('#shorturl-popover [data-test="short-url"]')
      .invoke('text')
      .then(text => {
        cy.visit(text);
      });
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
  });

  it('Test iframe link', () => {
    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=embed-code-button]').click();
    cy.get('#embed-code-popover').within(() => {
      cy.get('textarea[name=embedCode]').contains('iframe');
    });
  });

  xit('Test chart save as', () => {
    const formData = {
      ...HEALTH_POP_FORM_DATA_DEFAULTS,
      viz_type: 'table',
      metrics: ['sum__SP_POP_TOTL'],
      groupby: ['country_name'],
    };
    const newChartName = 'Test chart';

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    cy.url().then(url => {
      cy.get('button[data-target="#save_modal"]').click();
      cy.get('.modal-content').within(() => {
        cy.get('input[name=new_slice_name]').type(newChartName);
        cy.get('button#btn_modal_save').click();
      });
      cy.url().should('eq', url);

      cy.visitChartByName(newChartName);
      cy.verifySliceSuccess({ waitAlias: '@postJson' });
    });
  });

  xit('Test chart save', () => {
    const chartName = 'Test chart';
    cy.visitChartByName(chartName);
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    cy.get('[data-test=groupby]').within(() => {
      cy.get('span.select-clear-zone').click();
    });
    cy.get('button[data-target="#save_modal"]').click();
    cy.get('.modal-content').within(() => {
      cy.get('button#btn_modal_save').click();
    });
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    cy.request(`/chart/api/read?_flt_3_slice_name=${chartName}`).then(
      response => {
        cy.request('DELETE', `/chart/api/delete/${response.body.pks[0]}`);
      },
    );
  });

  it('Test chart save as and add to new dashboard', () => {
    cy.visitChartByName('Growth Rate');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });

    const dashboardTitle = 'Test dashboard';
    cy.get('button[data-target="#save_modal"]').click();
    cy.get('.modal-content').within(() => {
      cy.get('input[name=new_slice_name]').type('New Growth Rate');
      cy.get('input[data-test=add-to-new-dashboard]').check();
      cy.get('input[placeholder="[dashboard name]"]').type(dashboardTitle);
      cy.get('button#btn_modal_save').click();
    });
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    cy.request(
      `/dashboard/api/read?_flt_3_dashboard_title=${dashboardTitle}`,
    ).then(response => {
      expect(response.body.pks[0]).not.equals(null);
    });
  });

  it('Test chart save as and add to existing dashboard', () => {
    cy.visitChartByName('Most Populated Countries');
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    const chartName = 'New Most Populated Countries';
    const dashboardTitle = 'Test dashboard';

    cy.get('button[data-target="#save_modal"]').click();
    cy.get('.modal-content').within(() => {
      cy.get('input[name=new_slice_name]').type(chartName);
      cy.get('input[data-test=add-to-existing-dashboard]').check();
      cy.get('.select.save-modal-selector')
        .click()
        .within(() => {
          cy.get('input').type(dashboardTitle, { force: true });
          cy.get('.select-option.is-focused').trigger('mousedown');
        });
      cy.get('button#btn_modal_save').click();
    });
    cy.verifySliceSuccess({ waitAlias: '@postJson' });
    cy.request(`/chart/api/read?_flt_3_slice_name=${chartName}`).then(
      response => {
        cy.request('DELETE', `/chart/api/delete/${response.body.pks[0]}`);
      },
    );
    cy.request(
      `/dashboard/api/read?_flt_3_dashboard_title=${dashboardTitle}`,
    ).then(response => {
      cy.request('DELETE', `/dashboard/api/delete/${response.body.pks[0]}`);
    });
  });
});
