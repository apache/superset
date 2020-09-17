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
export const WORLD_HEALTH_DASHBOARD = '/superset/dashboard/world_health/';
export const TABBED_DASHBOARD = '/superset/dashboard/tabbed_dash/';

export const CHECK_DASHBOARD_FAVORITE_ENDPOINT =
  '/superset/favstar/Dashboard/*/count';

/**
 * Drag an element and drop it to another element.
 * Usage:
 *    drag(source).to(target);
 */
export function drag(selector: string, content: string | number | RegExp) {
  const dataTransfer = { data: {} };
  return {
    to(target: string | Cypress.Chainable) {
      cy.get('.dragdroppable')
        .contains(selector, content)
        .trigger('mousedown', { which: 1 })
        .trigger('dragstart', { dataTransfer })
        .trigger('drag', {});

      (typeof target === 'string' ? cy.get(target) : target)
        .trigger('dragover', { dataTransfer })
        .trigger('drop', { dataTransfer })
        .trigger('dragend', { dataTransfer })
        .trigger('mouseup', { which: 1 });
    },
  };
}
