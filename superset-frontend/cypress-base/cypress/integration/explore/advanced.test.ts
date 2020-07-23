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
