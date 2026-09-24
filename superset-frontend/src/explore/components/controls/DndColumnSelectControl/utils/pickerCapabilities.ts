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
import { DatasourceType } from '@superset-ui/core';
import { ColumnPickerCapabilities } from 'src/explore/types';

/**
 * SemanticViewFeature value marking views whose backend accepts adhoc
 * (simple / custom SQL) column expressions. Mirrors the Python enum member
 * in superset-core.
 */
export const ADHOC_COLUMN_EXPRESSIONS = 'ADHOC_COLUMN_EXPRESSIONS';

const DEFAULT_CAPABILITIES: ColumnPickerCapabilities = {
  dimensionClassification: 'expression',
  disabledModes: [],
  showCompatibilityFailure: false,
};

/**
 * Subset of datasource metadata the adapter reads. Kept structural so both
 * the core `Datasource` and chart-controls `Dataset` shapes are accepted.
 */
export interface PickerCapabilityDatasource {
  type?: string;
  semantic_view_features?: string[];
}

/**
 * Translate datasource metadata into provider-neutral picker capabilities.
 *
 * This adapter is the single interpretation point (anti-corruption boundary)
 * for `semantic_view_features`: picker components must consume the returned
 * capabilities instead of reading feature strings or provider identity.
 *
 * Semantic views always disable Custom SQL. A semantic view whose feature
 * list is present but does not declare `ADHOC_COLUMN_EXPRESSIONS` is
 * Saved-only: its dimensions cannot be composed into adhoc expressions, so
 * Simple is disabled and dimensions are presented as Saved options. Missing
 * feature metadata (older payloads) and unknown feature strings degrade to
 * the pre-existing behavior for the datasource type.
 */
export function getColumnPickerCapabilities(
  datasource?: PickerCapabilityDatasource | null,
): ColumnPickerCapabilities {
  if (datasource?.type !== DatasourceType.SemanticView) {
    return DEFAULT_CAPABILITIES;
  }

  const features = datasource.semantic_view_features;
  const supportsAdhocExpressions =
    !Array.isArray(features) || features.includes(ADHOC_COLUMN_EXPRESSIONS);

  if (supportsAdhocExpressions) {
    return {
      dimensionClassification: 'expression',
      disabledModes: ['sqlExpression'],
      showCompatibilityFailure: false,
    };
  }

  return {
    dimensionClassification: 'saved',
    disabledModes: ['simple', 'sqlExpression'],
    showCompatibilityFailure: true,
  };
}
