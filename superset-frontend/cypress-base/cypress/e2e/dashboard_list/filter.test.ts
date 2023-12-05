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
import { DASHBOARD_LIST } from 'cypress/utils/urls';
import { setGridMode, clearAllInputs } from 'cypress/utils';
import { setFilter } from '../dashboard/utils';

describe('Dashboards filters', () => {
  before(() => {
    cy.visit(DASHBOARD_LIST);
    setGridMode('card');
  });

  beforeEach(() => {
    clearAllInputs();
  });

  it('should allow filtering by "Owner" correctly', () => {
    setFilter('Owner', 'alpha user');
    setFilter('Owner', 'admin user');
  });

  it('should allow filtering by "Modified by" correctly', () => {
    setFilter('Modified by', 'alpha user');
    setFilter('Modified by', 'admin user');
  });

  it('should allow filtering by "Status" correctly', () => {
    setFilter('Status', 'Published');
    setFilter('Status', 'Draft');
  });
});
