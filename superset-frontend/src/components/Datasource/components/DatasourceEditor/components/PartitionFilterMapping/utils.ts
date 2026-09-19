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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type {
  PartitionMappingColumn,
  PartitionMappingDatasource,
  PartitionRowState,
} from './types';

/**
 * Whether the dataset editor should offer partition filter mapping at all.
 *
 * The single source of truth for the gate, so every place that shows partition
 * mapping UI stays in lockstep: it needs the feature flag on, a datasource to
 * read, and an engine that advertises support (`supports_partition_filter_mapping`,
 * true only for partition-directory engines like Hive/Impala/Spark). This lived
 * inline at one call site and was missed at another, which showed the section on
 * engines that do not support it -- hence one predicate both sites share.
 */
export function partitionFilterMappingEnabled(
  datasource: PartitionMappingDatasource | undefined,
): boolean {
  return (
    isFeatureEnabled(FeatureFlag.PartitionFilterMapping) &&
    Boolean(datasource) &&
    Boolean(datasource?.supports_partition_filter_mapping)
  );
}

/**
 * The bare `:value` placeholder, i.e. the identity transform.
 *
 * It mirrors the filter bound unchanged, so it parses on every engine and is
 * provably order-preserving -- editing nothing cannot make it non-monotonic.
 * That is what lets it be both the universal pre-fill and the one transform the
 * UI may auto-declare monotonic without asking.
 */
export const IDENTITY_TRANSFORM = ':value';

/**
 * The column whose filters are mirrored.
 *
 * `partition_mapped_column` is an explicit override; `null` means "follow the
 * default datetime column", so re-pointing that column moves the mapping with
 * it. Mirrors `SqlaTable.partition_filter_mapping_summary` on the backend.
 */
export function resolveMappedColumn(
  datasource: PartitionMappingDatasource,
): string | null {
  if (!datasource.partition_column) {
    return null;
  }
  return datasource.partition_mapped_column || datasource.main_dttm_col || null;
}

/** Whether the mapped column came from `main_dttm_col` rather than an override. */
export function mappedColumnIsImplicit(
  datasource: PartitionMappingDatasource,
): boolean {
  return Boolean(
    datasource.partition_column &&
    !datasource.partition_mapped_column &&
    datasource.main_dttm_col,
  );
}

/**
 * Whether the mapping will actually mirror anything.
 *
 * "Inert" here means only "no transform entered yet", which is the point of the
 * warning in wireframe 1g. A transform that is present but unusable -- no
 * `:value`, a Jinja block, unparseable -- is reported by the transform field's
 * own validation instead, so this does not repeat those checks.
 */
export function mappingIsActive(
  datasource: PartitionMappingDatasource,
  columns: PartitionMappingColumn[],
): boolean {
  const mappedColumnName = resolveMappedColumn(datasource);
  if (!mappedColumnName || mappedColumnName === datasource.partition_column) {
    return false;
  }
  const mappedColumn = columns.find(
    column => column.column_name === mappedColumnName,
  );
  return Boolean(mappedColumn?.partition_value_transform?.trim());
}

/** Which of the three row-expand treatments a column gets. */
export function partitionRowState(
  datasource: PartitionMappingDatasource,
  columnName: string,
): PartitionRowState {
  if (!datasource.partition_column) {
    return 'none';
  }
  if (columnName === datasource.partition_column) {
    return 'partition';
  }
  return resolveMappedColumn(datasource) === columnName ? 'mapped' : 'unmapped';
}

/**
 * The transform to pre-fill when a column becomes the mapped one.
 *
 * A temporal column on an engine that advertises its own syntax gets that:
 * `unix_timestamp(:value)` is Hive-family and would not parse on Postgres or
 * BigQuery, so the engine default only applies where the engine supplies it.
 * Every other case -- a non-temporal column, or a temporal one on an engine
 * with no default -- falls back to the bare `:value` identity transform rather
 * than an empty field. `:value` is a valid, working starting point (the mapped
 * and partition columns often share a shape, so mirroring the bound unchanged
 * is exactly right) and it is far easier for the owner to edit than to write
 * from nothing.
 */
export function defaultTransformFor(
  datasource: PartitionMappingDatasource,
  column: PartitionMappingColumn | undefined,
): string {
  if (column?.is_dttm && datasource.partition_value_transform_default) {
    return datasource.partition_value_transform_default;
  }
  return IDENTITY_TRANSFORM;
}

/**
 * Samples the preview evaluates the transform at.
 *
 * Temporal columns get one timestamp, because a time-range bound is what they
 * are mapped for. Everything else gets two values, so the preview demonstrates
 * the element-wise `IN` an ordinary categorical filter actually produces.
 */
export function sampleValuesFor(
  column: PartitionMappingColumn | undefined,
): string[] {
  return column?.is_dttm ? ['2026-01-15 00:00:00'] : ['US', 'CA'];
}

/**
 * The operator the preview should demonstrate.
 *
 * Temporal columns are mapped for the sake of time ranges, so `>=` is what the
 * owner cares about -- but a range only mirrors when the transform is declared
 * order-preserving, so without that declaration fall back to `=`. Previewing an
 * operator that cannot mirror would report an error for a mapping that is in
 * fact working. Non-temporal columns preview as `IN`, the shape a categorical
 * filter actually produces.
 */
export function previewOperatorFor(
  column: PartitionMappingColumn | undefined,
): string {
  if (!column?.is_dttm) {
    return 'IN';
  }
  return column.partition_transform_is_monotonic ? '>=' : '==';
}

/**
 * Columns updated for a mapping moving to `nextColumnName`.
 *
 * Both cardinalities are one, so reassignment replaces: every other column
 * loses its transform. Clearing only the column that *was* mapped would leave
 * a transform behind whenever the mapping moved out of the "no mapping" state,
 * and that stale value would silently become live again the next time the
 * mapped column resolved back to it.
 */
export function applyMappingMove<T extends PartitionMappingColumn>(
  columns: T[],
  nextColumnName: string,
  nextTransform: string,
): T[] {
  return columns.map(column => {
    if (column.column_name !== nextColumnName) {
      return column.partition_value_transform ||
        column.partition_transform_is_monotonic
        ? {
            ...column,
            partition_value_transform: null,
            partition_transform_is_monotonic: false,
          }
        : column;
    }
    const nextValue = column.partition_value_transform || nextTransform || null;
    return {
      ...column,
      partition_value_transform: nextValue,
      // A fresh pre-fill of the identity `:value` may declare monotonicity for
      // the owner, because that placeholder provably preserves ordering. Any
      // other pre-fill (an engine default) is the owner's to declare, so leave
      // whatever the column already carried.
      partition_transform_is_monotonic:
        nextValue === IDENTITY_TRANSFORM
          ? true
          : column.partition_transform_is_monotonic,
    };
  });
}

/**
 * Where "Map a column →" should take an owner with nothing mapped yet.
 *
 * Prefers a temporal column: this feature exists for time ranges, and the
 * alternative -- whichever column happens to sort first -- lands on something
 * like a revenue metric, which no one would mirror onto a partition key.
 */
export function suggestedMappedColumn(
  columns: PartitionMappingColumn[],
  partitionColumnName: string | null | undefined,
): string | null {
  const candidates = columns.filter(
    column => column.column_name !== partitionColumnName,
  );
  const temporal = candidates.find(column => column.is_dttm);
  return (temporal ?? candidates[0])?.column_name ?? null;
}
