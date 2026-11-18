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

export interface SemanticDimensionSupport {
  grains: string[];
  allows_default_grain: boolean;
  omitted_grain: string;
  ungrained_filter: string;
}

export interface SemanticGrainState {
  datasource?: { type?: string; time_grain_sqla?: [string, string][] } | null;
  controls?: Record<string, { value?: unknown }>;
  form_data?: { x_axis?: unknown; granularity_sqla?: unknown };
  compatibility?: {
    status: string;
    dimensionSupport?: Record<string, SemanticDimensionSupport>;
  };
}

/** Preserve saved selections while support loads; queries still validate support. */
export const semanticGrainProps = (
  state: SemanticGrainState,
): {
  choices: [string, string][] | null;
  clearable?: boolean;
} => {
  const choices = state.datasource?.time_grain_sqla ?? null;
  if (state.datasource?.type !== 'semantic_view')
    return { choices: choices ?? [] };
  const axis =
    state.controls?.x_axis?.value ??
    state.form_data?.x_axis ??
    state.controls?.granularity_sqla?.value ??
    state.form_data?.granularity_sqla;
  const name =
    typeof axis === 'string'
      ? axis
      : axis &&
          typeof axis === 'object' &&
          'sqlExpression' in axis &&
          typeof axis.sqlExpression === 'string'
        ? axis.sqlExpression
        : undefined;
  const support =
    state.compatibility?.status === 'verified' && name
      ? state.compatibility.dimensionSupport?.[name]
      : undefined;
  // Table/Pivot groupings have no single axis. The catalog remains selectable
  // until there is verified support for a specific axis. Never coerce a saved
  // bucket to null (an explicit native request) while metadata is unavailable.
  if (!support) return { choices, clearable: true };
  return {
    choices:
      choices?.filter(([grain]) => support.grains.includes(grain)) ?? null,
    clearable: support?.allows_default_grain === true,
  };
};
