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

/**
 * @fileoverview Host implementation of the `charts` namespace.
 *
 * `charts.AssetChart` is exposed to extensions on `window.superset`. The
 * redux store, the chart-data actions and `SuperChart` it is built from are
 * host internals and stay behind it.
 */

import type { charts as chartsApi } from '@apache-superset/core';
import { getChartControlPanelRegistry } from '@superset-ui/core';
import {
  type ControlPanelConfig,
  expandControlConfig,
  isControlPanelSectionConfig,
} from '@superset-ui/chart-controls';
import {
  matrixifyCells,
  matrixifyColumns,
  matrixifyEnableSection,
  matrixifyRows,
} from 'src/explore/controlPanels/sections';
import AssetChart from './AssetChart';

/**
 * Every control a visualization declares, expanded the way Explore expands
 * them.
 *
 * `getSectionsToRender` resolves a string shorthand against `sharedControls`
 * and applies the plugin's `controlOverrides`. Both readers below walk this
 * one sequence, so a control's label and its default are always read off the
 * same resolved config: a plugin overriding a shared control moves both, and
 * neither can be answered from a registry the other does not consult.
 *
 * The matrixify sections lead, because `getSectionsToRender` puts them ahead
 * of every plugin's own whatever the visualization is: Explore hydrates and
 * saves their keys on every chart, so a reader comparing a stored chart with
 * a resaved one meets them everywhere. They are read from the same module
 * Explore reads them from; `sectionOverrides` cannot reach them, since
 * `SharedSectionAlias` names only the five sections that predate matrixify.
 *
 * Explore's datasource and viz type section is deliberately left out: those
 * keys identify the chart rather than configure it, and the contract these
 * two APIs publish says neither reports them.
 */
function* expandedControls(
  vizType: string,
): Generator<{ name: string; config: Record<string, unknown> }> {
  const panel = getChartControlPanelRegistry().get(vizType) as
    | ControlPanelConfig
    | undefined;
  // A visualization the registry has never seen: Explore would not render a
  // control panel for it at all, matrixify's sections included.
  if (!panel) {
    return;
  }
  const { controlPanelSections = [], controlOverrides } = panel;

  for (const section of [
    matrixifyEnableSection,
    matrixifyColumns,
    matrixifyRows,
    matrixifyCells,
    ...controlPanelSections,
  ].filter(isControlPanelSectionConfig)) {
    for (const row of section.controlSetRows) {
      for (const item of row) {
        const control = expandControlConfig(item, controlOverrides);
        // A row also carries things that are not controls -- `<hr />` among
        // them -- which expand to something with no name or no config.
        if (
          control &&
          typeof control === 'object' &&
          'name' in control &&
          'config' in control &&
          control.config &&
          typeof control.config === 'object'
        ) {
          yield {
            name: control.name as string,
            config: control.config as Record<string, unknown>,
          };
        }
      }
    }
  }
}

/**
 * Explore's own labels for a visualization's controls, by control name.
 *
 * The keys inside a chart's `params` are Explore control names, which an
 * extension describing a change has no way to resolve on its own: the
 * control panel registry is the host's.
 *
 * A label can be a node or a function for a dynamic control; only a plain
 * string survives, because only a string can be put in a sentence.
 */
function controlLabels(vizType: string): Record<string, string> {
  if (!vizType) {
    return {};
  }
  try {
    const labels: Record<string, string> = {};
    for (const { name, config } of expandedControls(vizType)) {
      if (typeof config.label === 'string') {
        labels[name] = config.label;
      }
    }
    return labels;
  } catch {
    // A viz type the registry does not know. Raw keys are what the caller
    // would have shown anyway, so this is a worse answer, not a failure.
    return {};
  }
}

/**
 * What each of a visualization's controls defaults to, by control name.
 *
 * The same walk as `controlLabels`, reading `default` instead of `label`,
 * because the two questions a reader of a chart's `params` has are "what is
 * this called?" and "did anyone actually set it?".
 *
 * Explore posts the whole hydrated form data on save, so a chart stored
 * without a control's key comes back carrying it at this value. Comparing
 * the stored row against the posted one -- which is what anything outside
 * Explore has to do -- shows every such key as new, and without these
 * defaults there is no way to tell a ticked checkbox from the form writing
 * its own default down. Explore's own diff (`AlteredSliceTag`) never needed
 * them: it compares `latestQueryFormData` against `sliceFormData`, both
 * already hydrated.
 *
 * Only controls that default to something are included. A control declaring
 * no default, or declaring `undefined` as one, is absent: there is nothing
 * to compare against, and a caller must not read a key it finds here as a
 * default of `undefined`.
 */
function controlDefaults(vizType: string): Record<string, unknown> {
  if (!vizType) {
    return {};
  }
  try {
    const defaults: Record<string, unknown> = {};
    for (const { name, config } of expandedControls(vizType)) {
      if (
        config.default !== undefined &&
        typeof config.default !== 'function'
      ) {
        defaults[name] = config.default;
      }
    }
    return defaults;
  } catch {
    // A viz type the registry does not know. An empty object says "no
    // defaults available", which is the honest answer and the one the
    // caller must already handle per key.
    return {};
  }
}

export const charts: typeof chartsApi = {
  AssetChart,
  controlLabels,
  controlDefaults,
};
