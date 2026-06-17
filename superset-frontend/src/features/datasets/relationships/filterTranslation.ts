/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import { SupersetClient } from '@superset-ui/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterValue {
  column: string;
  datasetId: number;
  values: unknown[];
  operator?: string;
}

export interface TranslatedFilter {
  targetDatasetId: number;
  targetColumn: string;
  translatedValues: unknown[];
  operator: string;
  confidence: 'exact' | 'mapped' | 'approximate';
}

export interface RelationshipMapping {
  relationshipId: number;
  sourceDatasetId: number;
  targetDatasetId: number;
  sourceColumn: string;
  targetColumn: string;
  relationshipType: string;
  joinType: string;
  isCrossDatabase: boolean;
}

// ---------------------------------------------------------------------------
// Filter Translation Engine
// ---------------------------------------------------------------------------

/**
 * Translates filter values from one dataset to another via relationship mappings.
 *
 * For same-database relationships: the filter is directly applicable because
 * the JOIN happens at the SQL level — no translation needed.
 *
 * For cross-database relationships: we fetch the distinct values from the
 * target dataset's join column that correspond to the filtered source values.
 */
export class FilterTranslationEngine {
  private relationshipCache: Map<number, RelationshipMapping[]> = new Map();
  private cacheTimestamps: Map<number, number> = new Map();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Load relationships for a dataset from the API.
   */
  async loadRelationships(datasetId: number): Promise<RelationshipMapping[]> {
    // Check TTL: invalidate stale entries
    const cachedAt = this.cacheTimestamps.get(datasetId) ?? 0;
    if (
      this.relationshipCache.has(datasetId) &&
      Date.now() - cachedAt < FilterTranslationEngine.CACHE_TTL_MS
    ) {
      return this.relationshipCache.get(datasetId)!;
    }
    this.relationshipCache.delete(datasetId);

    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dataset_relationship/dataset/${datasetId}?active_only=true`,
      });
      const relationships = (json.result as Array<{
        id: number;
        source_dataset_id: number;
        target_dataset_id: number;
        columns: Array<{ source_column_name: string; target_column_name: string }>;
        relationship_type: string;
        join_type: string;
        is_cross_database: boolean;
      }>).map(rel => ({
        relationshipId: rel.id,
        sourceDatasetId: rel.source_dataset_id,
        targetDatasetId: rel.target_dataset_id,
        sourceColumn: rel.columns[0]?.source_column_name ?? '',
        targetColumn: rel.columns[0]?.target_column_name ?? '',
        relationshipType: rel.relationship_type,
        joinType: rel.join_type,
        isCrossDatabase: rel.is_cross_database,
      }));

      this.relationshipCache.set(datasetId, relationships);
      this.cacheTimestamps.set(datasetId, Date.now());
      return relationships;
    } catch {
      return [];
    }
  }

  /**
   * Translate a filter applied on one dataset to all related datasets.
   *
   * @param sourceFilter The filter to translate
   * @returns Array of translated filters for each related dataset
   */
  async translateFilter(sourceFilter: FilterValue): Promise<TranslatedFilter[]> {
    const mappings = await this.loadRelationships(sourceFilter.datasetId);
    const results: TranslatedFilter[] = [];

    for (const mapping of mappings) {
      // Only translate if the filter column matches the source join column
      if (mapping.sourceColumn !== sourceFilter.column) {
        continue;
      }

      if (!mapping.isCrossDatabase) {
        // Same-DB: the JOIN handles the translation at SQL level.
        // We pass the filter values directly to the target column.
        results.push({
          targetDatasetId: mapping.targetDatasetId,
          targetColumn: mapping.targetColumn,
          translatedValues: sourceFilter.values,
          operator: sourceFilter.operator ?? 'IN',
          confidence: 'exact',
        });
      } else {
        // Cross-DB: need to resolve which target values correspond
        // to the filtered source values via a lookup query.
        const translated = await this.resolveCrossDbValues(
          mapping,
          sourceFilter.values,
        );
        if (translated.length > 0) {
          results.push({
            targetDatasetId: mapping.targetDatasetId,
            targetColumn: mapping.targetColumn,
            translatedValues: translated,
            operator: sourceFilter.operator ?? 'IN',
            confidence: 'mapped',
          });
        }
      }
    }

    return results;
  }

  /**
   * For cross-DB relationships, resolve target values from source values.
   *
   * This runs a query against the target database to find matching values
   * on the join column that correspond to the filtered source values.
   */
  private async resolveCrossDbValues(
    mapping: RelationshipMapping,
    sourceValues: unknown[],
  ): Promise<unknown[]> {
    try {
      // Use the backend API to resolve cross-DB value mapping
      const { json } = await SupersetClient.post({
        endpoint: '/api/v1/dataset_relationship/resolve_values/',
        body: JSON.stringify({
          source_dataset_id: mapping.sourceDatasetId,
          target_dataset_id: mapping.targetDatasetId,
          source_column: mapping.sourceColumn,
          target_column: mapping.targetColumn,
          source_values: sourceValues,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      return (json as { result: unknown[] }).result ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Build a chain of translations for multi-hop relationships.
   * A → B → C: filter on A gets translated to B, then from B to C.
   */
  async translateFilterChain(
    sourceFilter: FilterValue,
    maxDepth: number = 3,
  ): Promise<TranslatedFilter[]> {
    const allTranslated: TranslatedFilter[] = [];
    const queue: FilterValue[] = [sourceFilter];
    const visited = new Set<number>();

    visited.add(sourceFilter.datasetId);

    let depth = 0;
    while (queue.length > 0 && depth < maxDepth) {
      const currentFilter = queue.shift()!;
      const translations = await this.translateFilter(currentFilter);

      for (const t of translations) {
        if (!visited.has(t.targetDatasetId)) {
          allTranslated.push(t);
          visited.add(t.targetDatasetId);
          queue.push({
            column: t.targetColumn,
            datasetId: t.targetDatasetId,
            values: t.translatedValues,
            operator: t.operator,
          });
        }
      }

      depth++;
    }

    return allTranslated;
  }

  /**
   * Clear the relationship cache.
   */
  clearCache(): void {
    this.relationshipCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Invalidate cache for a specific dataset.
   * Called after create/update/delete operations on relationships.
   */
  invalidateDataset(datasetId: number): void {
    this.relationshipCache.delete(datasetId);
    this.cacheTimestamps.delete(datasetId);
  }
}

// Singleton instance for use across the app
export const filterTranslationEngine = new FilterTranslationEngine();
