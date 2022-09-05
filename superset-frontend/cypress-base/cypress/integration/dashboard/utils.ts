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

export const WORLD_HEALTH_CHARTS = [
  { name: '% Rural', viz: 'world_map' },
  { name: 'Most Populated Countries', viz: 'table' },
  { name: 'Region Filter', viz: 'filter_box' },
  { name: "World's Population", viz: 'big_number' },
  { name: 'Growth Rate', viz: 'line' },
  { name: 'Rural Breakdown', viz: 'sunburst' },
  { name: "World's Pop Growth", viz: 'area' },
  { name: 'Life Expectancy VS Rural %', viz: 'bubble' },
  { name: 'Treemap', viz: 'treemap' },
  { name: 'Box plot', viz: 'box_plot' },
] as const;

export const ECHARTS_CHARTS = [
  { name: 'Number of Girls', viz: 'big_number_total' },
  { name: 'Participants', viz: 'big_number' },
  { name: 'Box plot', viz: 'box_plot' },
  { name: 'Genders', viz: 'pie' },
  { name: 'Energy Force Layout', viz: 'graph_chart' },
] as const;

export function interceptGet() {
  cy.intercept('/api/v1/dashboard/*').as('get');
}

export function interceptFiltering() {
  cy.intercept('GET', `/api/v1/dashboard/?q=*`).as('filtering');
}

export function interceptBulkDelete() {
  cy.intercept('DELETE', `/api/v1/dashboard/?q=*`).as('bulkDelete');
}

export function interceptDelete() {
  cy.intercept('DELETE', `/api/v1/dashboard/*`).as('delete');
}

export function interceptUpdate() {
  cy.intercept('PUT', `/api/v1/dashboard/*`).as('update');
}

export function interceptPost() {
  cy.intercept('POST', `/api/v1/dashboard/`).as('post');
}

export function interceptLog() {
  cy.intercept('/superset/log/?explode=events&dashboard_id=*').as('logs');
}

export function interceptFav() {
  cy.intercept(`/superset/favstar/Dashboard/*/select/`).as('select');
}

export function interceptUnfav() {
  cy.intercept(`/superset/favstar/Dashboard/*/unselect/`).as('unselect');
}

export function setFilter(filter: string, option: string) {
  interceptFiltering();

  cy.get(`[aria-label="${filter}"]`).first().click();
  cy.get(`[aria-label="${filter}"] [title="${option}"]`).click();

  cy.wait('@filtering');
}
