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

describe('charts list view', () => {
  beforeEach(() => {
    cy.visit(CHART_LIST);
  });

  afterEach(() => {
    cy.eyesClose();
  });

  it('should load the Charts list', () => {
    cy.get('[aria-label="list-view"]').click();
    cy.eyesOpen({
      testName: 'Charts list-view',
    });
    cy.eyesCheckWindow('Charts list-view loaded');
  });

  it('should load the Charts card list', () => {
    cy.get('[aria-label="card-view"]').click();
    cy.eyesOpen({
      testName: 'Charts card-view',
    });
    cy.eyesCheckWindow('Charts card-view loaded');
  });
});
