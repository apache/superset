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
import { ALERT_LIST } from './alert_report.helper';

describe('alert list view', () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.eyesClose();
  });

  it('should load alert lists', () => {
    cy.visit(ALERT_LIST);

    cy.get('[data-test="listview-table"]').should('be.visible');
    // check alert list view header
    cy.get('[data-test="sort-header"]').eq(1).contains('Last run');
    cy.get('[data-test="sort-header"]').eq(2).contains('Name');
    cy.get('[data-test="sort-header"]').eq(3).contains('Schedule');
    cy.get('[data-test="sort-header"]').eq(4).contains('Notification method');
    cy.get('[data-test="sort-header"]').eq(5).contains('Created by');
    cy.get('[data-test="sort-header"]').eq(6).contains('Owners');
    cy.get('[data-test="sort-header"]').eq(7).contains('Modified');
    // TODO: this assert is flaky, we need to find a way to make it work consistenly
    // cy.get('[data-test="sort-header"]').eq(7).contains('Active');
    // cy.get('[data-test="sort-header"]').eq(8).contains('Actions');
  });
});
