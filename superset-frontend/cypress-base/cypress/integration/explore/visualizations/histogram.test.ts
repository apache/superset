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
import { QueryFormData } from '@superset-ui/core';

describe('Visualization > Histogram', () => {
  const HISTOGRAM_FORM_DATA: QueryFormData = {
    datasource: '3__table',
    viz_type: 'histogram',
    slice_id: 60,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    all_columns_x: ['num'],
    adhoc_filters: [],
    row_limit: 50000,
    groupby: [],
    color_scheme: 'bnbColors',
    link_length: 5, // number of bins
    x_axis_label: 'Frequency',
    y_axis_label: 'Num',
    global_opacity: 1,
    normalized: false,
  };

  function verify(formData: QueryFormData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work without groupby', () => {
    verify(HISTOGRAM_FORM_DATA);
    cy.get('.chart-container svg .vx-bar').should(
      'have.length',
      HISTOGRAM_FORM_DATA.link_length,
    );
  });

  it('should work with group by', () => {
    verify({
      ...HISTOGRAM_FORM_DATA,
      groupby: ['gender'],
    });
    cy.get('.chart-container svg .vx-bar').should(
      'have.length',
      HISTOGRAM_FORM_DATA.link_length * 2,
    );
  });

  it('should work with filter and update num bins', () => {
    const numBins = 2;
    verify({
      ...HISTOGRAM_FORM_DATA,
      link_length: numBins,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'state',
          operator: '==',
          comparator: 'CA',
        },
      ],
    });
    cy.get('.chart-container svg .vx-bar').should('have.length', numBins);
  });
});
