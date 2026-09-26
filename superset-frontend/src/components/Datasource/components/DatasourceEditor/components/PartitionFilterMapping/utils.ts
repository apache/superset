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

/**
 * Whether a transform is worth spending a preview request on.
 *
 * A necessary condition, never a sufficient one: the server stays the authority
 * on whether a transform is usable, and anything this cannot see -- an
 * unparseable expression, a non-deterministic function -- still comes back from
 * it. What this catches is the cases that are knowably hopeless while the owner
 * is still typing, which would otherwise spend the per-user preview budget and
 * leave none for the transform they eventually finish writing.
 */
export function transformCanPreview(
  transform: string | null | undefined,
  mappedColumn?: string | null,
  partitionColumn?: string | null,
): boolean {
  const trimmed = transform?.trim();
  if (!trimmed) {
    return false;
  }
  // Without the placeholder there is no value to substitute, so the transform
  // is inert however well-formed it is.
  if (!/:value\b/.test(trimmed)) {
    return false;
  }
  // Jinja would render in a different context at a different time from the
  // chart query, so it is rejected on save -- previewing it is pointless.
  if (/\{\{|\{%|\{#/.test(trimmed)) {
    return false;
  }
  // A column cannot stand in for itself; the backend rejects this outright.
  if (mappedColumn && partitionColumn && mappedColumn === partitionColumn) {
    return false;
  }
  return true;
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

/** Whether a column carries any part of the mapping. */
function holdsMapping(column: PartitionMappingColumn): boolean {
  return Boolean(
    column.partition_value_transform || column.partition_transform_is_monotonic,
  );
}

/**
 * Every column with the mapping's transform cleared.
 *
 * Both cardinalities are one, so "no mapping" has to mean no transform on any
 * column rather than none on whichever column happened to resolve as mapped. A
 * value left anywhere else is invisible -- only the mapped column's row renders
 * a transform at all -- and it becomes live again the moment the mapped column
 * resolves back to it, which re-pointing the default datetime column alone is
 * enough to do.
 *
 * Hands back the array it was given when no column held a transform, so a
 * caller that clears unconditionally does not invalidate column state whose
 * identity is what triggers the editor's validation pass.
 */
export function clearMappingTransforms<T extends PartitionMappingColumn>(
  columns: T[],
): T[] {
  if (!columns.some(holdsMapping)) {
    return columns;
  }
  return columns.map(column =>
    holdsMapping(column)
      ? {
          ...column,
          partition_value_transform: null,
          partition_transform_is_monotonic: false,
        }
      : column,
  );
}

/**
 * Columns with the mapping held by `columnName` and nothing else.
 *
 * The one place the "exactly one column holds the transform" invariant is
 * enforced, so the several ways a mapping can move cannot come to disagree
 * about it. A column name no column answers to -- or no transform to install --
 * leaves the mapping cleared rather than half-written.
 */
function withMappingOn<T extends PartitionMappingColumn>(
  columns: T[],
  columnName: string | null | undefined,
  transform: string | null,
  isMonotonic: boolean,
): T[] {
  const cleared = clearMappingTransforms(columns);
  if (!columnName || !transform) {
    return cleared;
  }
  return cleared.map(column =>
    column.column_name === columnName
      ? {
          ...column,
          partition_value_transform: transform,
          partition_transform_is_monotonic: isMonotonic,
        }
      : column,
  );
}

/**
 * Columns updated for a mapping moving to `nextColumnName`.
 *
 * A transform the column already had wins over the engine's default: the owner
 * wrote it for this column, and offering to overwrite it is not what picking it
 * up again means. Every other column is cleared, for the reason
 * `clearMappingTransforms` gives.
 */
export function applyMappingMove<T extends PartitionMappingColumn>(
  columns: T[],
  nextColumnName: string,
  nextTransform: string,
): T[] {
  const next = columns.find(column => column.column_name === nextColumnName);
  const nextValue = next?.partition_value_transform || nextTransform || null;
  return withMappingOn(
    columns,
    nextColumnName,
    nextValue,
    // A fresh pre-fill of the identity `:value` may declare monotonicity for
    // the owner, because that placeholder provably preserves ordering. Any
    // other pre-fill (an engine default) is the owner's to declare, so leave
    // whatever the column already carried.
    nextValue === IDENTITY_TRANSFORM
      ? true
      : Boolean(next?.partition_transform_is_monotonic),
  );
}

/**
 * Columns updated for a mapping following the default datetime column.
 *
 * With no override the mapped column *is* `main_dttm_col`, so re-pointing that
 * column moves the mapping. What does *not* move is the value transform: it
 * states how one particular column relates to the partition column, and the
 * owner wrote it about the column they were looking at. Re-asserting it on a
 * different column turns mirroring on with an expression nobody checked against
 * it, and the rows it prunes are wrong without anything saying so.
 *
 * So the mapping arrives inert on its new column, and the editor's existing
 * warning says a transform is still needed. The old column is left holding
 * nothing either -- a transform waiting there would come back to life the next
 * time the default datetime column pointed at it.
 */
export function applyImplicitMappingMove<T extends PartitionMappingColumn>(
  columns: T[],
  previousColumnName: string | null | undefined,
  nextColumnName: string | null | undefined,
): T[] {
  // Re-selecting the column already there is not a move, and reporting it as one
  // would churn column state the validation pass keys off.
  if (previousColumnName === nextColumnName) {
    return columns;
  }
  return clearMappingTransforms(columns);
}

/**
 * The mapped-column override that survives choosing a new partition column.
 *
 * The override only means anything relative to a partition column, so clearing
 * the partition column clears it too -- leaving it behind would silently re-arm
 * the next mapping. It also has to go when it names the column just chosen: a
 * column cannot stand in for itself, and the backend rejects that outright.
 *
 * `null` falls back to the implicit `main_dttm_col`, which is what an owner who
 * has not chosen an override gets anyway.
 */
export function nextMappedColumnOverride(
  previousOverride: string | null | undefined,
  partitionColumn: string | null,
): string | null {
  if (!partitionColumn || previousOverride === partitionColumn) {
    return null;
  }
  return previousOverride ?? null;
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
