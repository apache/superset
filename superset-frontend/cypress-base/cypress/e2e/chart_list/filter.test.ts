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
import { CHART_LIST } from 'cypress/utils/urls';
import { setGridMode, clearAllInputs } from 'cypress/utils';
import { setFilter } from '../explore/utils';

describe('Charts filters', () => {
  before(() => {
    cy.visit(CHART_LIST);
    setGridMode('card');
  });

  beforeEach(() => {
    clearAllInputs();
  });

  it('should allow filtering by "Owner"', () => {
    setFilter('Owner', 'alpha user');
    setFilter('Owner', 'admin user');
  });

  it('should allow filtering by "Modified by" correctly', () => {
    setFilter('Modified by', 'alpha user');
    setFilter('Modified by', 'admin user');
  });

  it('should allow filtering by "Type" correctly', () => {
    setFilter('Type', 'Area Chart (legacy)');
    setFilter('Type', 'Bubble Chart');
  });

  it('should allow filtering by "Dataset" correctly', () => {
    setFilter('Dataset', 'energy_usage');
    setFilter('Dataset', 'unicode_test');
  });

  it('should allow filtering by "Dashboards" correctly', () => {
    setFilter('Dashboard', 'Unicode Test');
    setFilter('Dashboard', 'Tabbed Dashboard');
  });
});
