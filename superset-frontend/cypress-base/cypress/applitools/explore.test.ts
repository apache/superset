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
import {
  FORM_DATA_DEFAULTS,
  NUM_METRIC,
} from '../e2e/explore/visualizations/shared.helper';

describe('explore view', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  afterEach(() => {
    cy.eyesClose();
  });

  it('should load Explore', () => {
    const LINE_CHART_DEFAULTS = {
      ...FORM_DATA_DEFAULTS,
      viz_type: 'echarts_timeseries_line',
    };
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.eyesOpen({
      testName: 'Explore page',
    });
    cy.eyesCheckWindow('Explore loaded');
  });
});
