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
import { getChartAlias, Slice } from 'cypress/utils/vizPlugins';

export * from './vizPlugins';
export { default as parsePostForm } from './parsePostForm';
export interface ChartSpec {
  name: string;
  viz: string;
}

const viewTypeIcons = {
  card: 'appstore',
  list: 'unordered-list',
};

export function setGridMode(type: 'card' | 'list') {
  const icon = viewTypeIcons[type];
  cy.get(`[aria-label="${icon}"]`).click();
}

export function toggleBulkSelect() {
  cy.getBySel('bulk-select').click();
}

export function clearAllInputs() {
  cy.get('body').then($body => {
    if ($body.find('.ant-select-clear').length) {
      cy.get('.ant-select-clear').click({ multiple: true, force: true });
    }
  });
}

const toSlicelike = ($chart: JQuery<HTMLElement>): Slice => {
  const chartId = $chart.attr('data-test-chart-id');
  const vizType = $chart.attr('data-test-viz-type');

  return {
    slice_id: chartId ? parseInt(chartId, 10) : null,
    form_data: {
      viz_type: vizType || null,
    },
  };
};

export function getChartGridComponent({ name, viz }: ChartSpec) {
  return cy
    .get(`[data-test-chart-name="${name}"]`)
    .should('have.attr', 'data-test-viz-type', viz);
}

export function getChartAliasBySpec(chart: ChartSpec) {
  return getChartGridComponent(chart).then($chart =>
    cy.wrap(getChartAlias(toSlicelike($chart))),
  );
}

export function getChartAliasesBySpec(charts: readonly ChartSpec[]) {
  const aliases: string[] = [];
  charts.forEach(chart =>
    getChartAliasBySpec(chart).then(alias => {
      aliases.push(alias);
    }),
  );
  // Wrapping the aliases is key.
  // That way callers can chain off this function
  // and actually get the list of aliases.
  return cy.wrap(aliases);
}

export function waitForChartLoad(chart: ChartSpec) {
  return getChartGridComponent(chart).then(gridComponent => {
    const chartId = gridComponent.attr('data-test-chart-id');
    // the chart should load in under half a minute
    return (
      cy
        // this id only becomes visible when the chart is loaded
        .get(`#chart-id-${chartId}`, {
          timeout: 30000,
        })
        .should('be.visible')
        // return the chart grid component
        .then(() => gridComponent)
    );
  });
}

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
        .trigger('mousedown', { which: 1, force: true });
      cy.get('.dragdroppable')
        .contains(selector, content)
        .trigger('dragstart', { dataTransfer, force: true });
      cy.get('.dragdroppable')
        .contains(selector, content)
        .trigger('drag', { force: true });

      (typeof target === 'string' ? cy.get(target) : target)
        .trigger('dragover', { dataTransfer, force: true })
        .trigger('drop', { dataTransfer, force: true })
        .trigger('dragend', { dataTransfer, force: true })
        .trigger('mouseup', { which: 1, force: true });
    },
  };
}

export function resize(selector: string) {
  return {
    to(cordX: number, cordY: number) {
      cy.get(selector).trigger('mousedown', { which: 1, force: true });
      cy.get(selector).trigger('mousemove', {
        which: 1,
        cordX,
        cordY,
        force: true,
      });
      cy.get(selector).trigger('mouseup', { which: 1, force: true });
    },
  };
}

export const setSelectSearchInput = (
  $input: any,
  value: string,
  async = false,
) => {
  // Ant Design 5 Select crashes Chromium with type/click events when showSearch is true.
  // This copies the value directly to the input element as a workaround.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call($input[0], value);

  // Trigger the input and change events
  if (async) {
    $input[0].dispatchEvent(new Event('mousedown', { bubbles: true }));
  }

  $input[0].dispatchEvent(new Event('input', { bubbles: true }));
  $input[0].dispatchEvent(new Event('change', { bubbles: true }));

  cy.get('.ant-select-item-option-content').should('exist').first().click({
    force: true,
  });
};
