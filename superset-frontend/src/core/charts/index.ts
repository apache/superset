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
import getControlsForVizType from 'src/utils/getControlsForVizType';
import AssetChart from './AssetChart';

/**
 * Explore's own labels for a visualization's controls.
 *
 * The same lookup `AlteredSliceTag` uses to name the keys in Superset's own
 * "this chart differs from its saved version" diff, down to the
 * label-or-raw-key fallback, so an extension describing a chart's `params`
 * reads the way the rest of the app does.
 *
 * A label can be a node or a function for a dynamic control; only a plain
 * string survives, because only a string can be put in a sentence.
 */
function controlLabels(vizType: string): Record<string, string> {
  if (!vizType) {
    return {};
  }
  try {
    return Object.fromEntries(
      Object.entries(getControlsForVizType(vizType) ?? {}).flatMap(
        ([name, config]) =>
          typeof (config as { label?: unknown })?.label === 'string'
            ? [[name, (config as { label: string }).label]]
            : [],
      ),
    );
  } catch {
    // A viz type the registry does not know. Raw keys are what the caller
    // would have shown anyway, so this is a worse answer, not a failure.
    return {};
  }
}

/**
 * What each of a visualization's controls defaults to, by control name.
 *
 * The same registry walk as `controlLabels`, reading `default` instead of
 * `label`, because the two questions a reader of a chart's `params` has are
 * "what is this called?" and "did anyone actually set it?".
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
 * Only controls that declare a `default` are included. An absent key means
 * there is nothing to compare against, which a caller must not read as a
 * default of `undefined`.
 */
function controlDefaults(vizType: string): Record<string, unknown> {
  if (!vizType) {
    return {};
  }
  try {
    return Object.fromEntries(
      Object.entries(getControlsForVizType(vizType) ?? {}).flatMap(
        ([name, config]) =>
          config && typeof config === 'object' && 'default' in config
            ? [[name, (config as { default: unknown }).default]]
            : [],
      ),
    );
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
