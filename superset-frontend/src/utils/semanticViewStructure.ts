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
import { Column } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';

/**
 * Shared semantic-view structure helpers. This module is deliberately
 * layer-neutral (`src/utils`) because its consumers span layers: the
 * native-filter configuration form, its column select, and the generic
 * dataset drill-info hook all resolve semantic views through it.
 */

export const mapSemanticTypeToGenericDataType = (
  semanticType?: string | null,
): GenericDataType | undefined => {
  if (!semanticType) {
    return undefined;
  }

  const normalized = semanticType.toLowerCase();

  if (
    /^(struct|list|map|array|fixed_size_list|large_list|union|dictionary)\b/.test(
      normalized,
    )
  ) {
    return undefined;
  }

  if (normalized.includes('bool')) {
    return GenericDataType.Boolean;
  }

  if (/(date|time|timestamp|datetime)/.test(normalized)) {
    return GenericDataType.Temporal;
  }

  if (
    /(\b(u?int\d*)\b|\bfloat\d*\b|\bdouble\b|\bdecimal\d*\b|\bnumber\b)/.test(
      normalized,
    )
  ) {
    return GenericDataType.Numeric;
  }

  if (
    /(\bstr(ing)?\b|\butf8\b|\blarge_string\b|\bbinary\b|\bjson\b|\buuid\b)/.test(
      normalized,
    )
  ) {
    return GenericDataType.String;
  }

  return undefined;
};

/** The slice of `GET /api/v1/semantic_view/<id>/structure` consumers rely on. */
export interface SemanticViewStructure {
  name?: string;
  dimensions: { name: string; type: string }[];
  metrics: { name: string; definition: string }[];
}

/**
 * Fetch a semantic view's structure — the single, shared entry point for
 * every type-aware datasource consumer (ColumnSelect, FiltersConfigForm,
 * display controls, drill metadata). Semantic views and regular datasets
 * have independent numeric-id sequences, so callers must route here (and
 * never to `/api/v1/dataset/<id>`) whenever the binding's datasourceType
 * is SemanticView.
 */
export const fetchSemanticViewStructure = async (
  semanticViewId: number | string,
): Promise<SemanticViewStructure> => {
  const endpoint = `/api/v1/semantic_view/${semanticViewId}/structure`;
  try {
    const response = await cachedSupersetGet({ endpoint });
    const { name, dimensions = [], metrics = [] } = response.json?.result ?? {};
    return { name, dimensions, metrics };
  } catch (error) {
    // cacheWrapper caches the promise itself and never evicts on rejection, so
    // a single failed response would poison this endpoint for the rest of the
    // page session. Evict on error so a later call refetches — mirroring the
    // regular-dataset drill branch (hooks/apiResources/datasets.ts).
    supersetGetCache.delete(endpoint);
    throw error;
  }
};

/**
 * Map structure dimensions onto the `Column` shape the filter/control
 * machinery expects. Mapping semantics are shared by every consumer:
 * temporal detection via `mapSemanticTypeToGenericDataType`, and
 * `filterable: true` (semantic-view dimensions are always selectable).
 */
export const semanticViewDimensionsToColumns = (
  dimensions: SemanticViewStructure['dimensions'],
): Column[] =>
  dimensions.map(dim => {
    const mappedType = mapSemanticTypeToGenericDataType(dim.type);
    return {
      column_name: dim.name,
      type: dim.type,
      is_dttm: mappedType === GenericDataType.Temporal,
      type_generic: mappedType,
      filterable: true,
    };
  });
