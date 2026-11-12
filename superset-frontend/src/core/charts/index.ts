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
import type { charts as chartsApi } from '@apache-superset/core';
import getControlsForVizType from 'src/utils/getControlsForVizType';

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

export const charts: typeof chartsApi = {
  controlLabels,
};
