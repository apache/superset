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
import {
  ColumnPickerCapabilities,
  ExplorableOperation,
} from 'src/explore/types';

const OPERATIONS: ExplorableOperation[] = [
  'ADHOC_METRICS',
  'DRILL_TO_DETAIL',
  'RAW_ROWS',
  'SAMPLES',
  'SQL_LAB',
];

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
  capabilities?: { operations?: unknown };
}

/** Unknown names grant nothing; absence is distinct from explicit refusal. */
function declaredOperations(
  operations: unknown,
): ExplorableOperation[] | undefined {
  if (operations === undefined) {
    return undefined;
  }
  return Array.isArray(operations)
    ? operations.filter((value): value is ExplorableOperation =>
        OPERATIONS.some(operation => operation === value),
      )
    : [];
}

/**
 * Translate datasource metadata into provider-neutral picker capabilities.
 *
 * This adapter is the single interpretation point (anti-corruption boundary)
 * for `semantic_view_features`: picker components must consume the returned
 * capabilities instead of reading feature strings or provider identity.
 *
 * Semantic views are Saved-only: ADHOC_COLUMN_EXPRESSIONS is reserved in
 * the SDK and grants no supported expression shape. This also applies to
 * old payloads missing feature metadata and stale reserved declarations.
 */
export function getColumnPickerCapabilities(
  datasource?: PickerCapabilityDatasource | null,
): ColumnPickerCapabilities {
  const operations = declaredOperations(datasource?.capabilities?.operations);
  const declaration = operations === undefined ? {} : { operations };
  if (datasource?.type !== DatasourceType.SemanticView) {
    return operations === undefined
      ? DEFAULT_CAPABILITIES
      : { ...DEFAULT_CAPABILITIES, ...declaration };
  }

  return {
    ...declaration,
    dimensionClassification: 'saved',
    disabledModes: ['simple', 'sqlExpression'],
    showCompatibilityFailure: true,
  };
}
