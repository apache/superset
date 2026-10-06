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
import { t } from '@apache-superset/core/translation';
import type {
  PartitionMappingColumn,
  PartitionMappingDatasource,
  PartitionMappingIssue,
  PartitionRowState,
} from './types';

/**
 * Jinja delimiters.
 *
 * A transform is evaluated in a different context and at a different time from
 * the chart query, so a template would not render the same way -- the backend
 * rejects one outright. Shared so the check that declines to preview a Jinja
 * transform and the check that blocks saving it cannot drift apart.
 */
const JINJA_PATTERN = /\{\{|\{%|\{#/;

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
  // Jinja is rejected on save, so previewing it is pointless.
  if (JINJA_PATTERN.test(trimmed)) {
    return false;
  }
  // A column cannot stand in for itself; the backend rejects this outright.
  if (mappedColumn && partitionColumn && mappedColumn === partitionColumn) {
    return false;
  }
  return true;
}

/**
 * Whether the mapping will actually mirror anything.
 *
 * Drives the choice between the green "filters will automatically apply"
 * message and the warning that nothing is mirrored yet, so "non-blank text in
 * the box" is not a good enough test: a transform with no `:value` to
 * substitute, or one carrying Jinja, is as inert as an empty one and the
 * backend's own summary reports it inactive. Claiming otherwise tells an owner
 * their queries are pruning when they are not.
 *
 * Shares `transformCanPreview`'s conditions rather than restating them, and is
 * necessary rather than sufficient for the same reason: an unparseable
 * expression or a non-deterministic function needs a SQL parser to spot, so the
 * server stays the authority -- `valueTransformIssues` surfaces what it says at
 * the transform field itself.
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
  return transformCanPreview(
    mappedColumn?.partition_value_transform,
    mappedColumnName,
    datasource.partition_column,
  );
}

/**
 * What is wrong with one column's value transform, if anything.
 *
 * Split out of `partitionMappingErrors` because the two callers disagree about
 * which text to judge. The save gate reads the committed column record; the
 * field's own message has to describe the text on screen, which lags the commit
 * by a debounce. Passing the transform separately lets both ask the same
 * question about different values instead of reimplementing the checks.
 */
export function valueTransformIssues(
  column: PartitionMappingColumn | undefined,
  transform: string | null | undefined,
): PartitionMappingIssue[] {
  if (!column) {
    return [];
  }

  if (JINJA_PATTERN.test(transform ?? '')) {
    return [
      {
        field: 'partition_value_transform',
        message: t(
          'Jinja templating is not supported in a partition value transform. The transform is evaluated in a different context and at a different time from the chart query, so a template would not render the same way.',
        ),
      },
    ];
  }

  // A temporal column falls back on the engine's own default, so leaving the box
  // empty there only makes the mapping inactive -- which the dataset-level
  // warning already says. A non-temporal column has nothing to fall back on.
  if (!column.is_dttm && !transform?.trim()) {
    return [
      {
        field: 'partition_value_transform',
        message: t(
          'A value transform is required on %(name)s, which is not a temporal column. Use :value for each value.',
          { name: column.column_name },
        ),
      },
    ];
  }

  return [];
}

/**
 * Everything wrong with the mapping that should stop the save.
 *
 * The client half of `validate_partition_mapping` in
 * `superset/connectors/sqla/partition_mapping.py`, restricted to its blocking
 * (Tier 1) issues. Those are the ones the PUT would reject anyway, so catching
 * them here turns a 400 toast arriving after the modal closed into a disabled
 * Save button that says why. Tier 2 is deliberately absent: an unparseable
 * transform, or one missing `:value`, is "saved but stays inactive until it
 * parses" per the PRD, and must not cost the owner the rest of their edits.
 *
 * One check is stricter than the backend's: an empty transform on a
 * non-temporal mapped column blocks. The backend files that as Tier 2 for every
 * column, but a non-temporal column has no default transform to fall back on --
 * the field carries a required marker saying exactly this -- so the marker
 * should mean something.
 *
 * Callers gate on the feature flag themselves, the way the two mount sites in
 * `DatasourceEditor` already do; a dataset carrying a stale `partition_column`
 * on an engine that cannot use one must not block a save the backend accepts.
 */
export function partitionMappingErrors(
  datasource: PartitionMappingDatasource,
  columns: PartitionMappingColumn[],
): PartitionMappingIssue[] {
  const partitionColumn = datasource.partition_column;
  if (!partitionColumn) {
    return [];
  }

  const issues: PartitionMappingIssue[] = [];
  const columnNames = new Set(columns.map(column => column.column_name));

  if (!columnNames.has(partitionColumn)) {
    issues.push({
      field: 'partition_column',
      message: t('Partition column %(name)s is not a column on this dataset.', {
        name: partitionColumn,
      }),
    });
  }

  const override = datasource.partition_mapped_column;
  if (override && !columnNames.has(override)) {
    issues.push({
      field: 'partition_mapped_column',
      message: t('Mapped column %(name)s is not a column on this dataset.', {
        name: override,
      }),
    });
  }

  const mappedColumnName = resolveMappedColumn(datasource);
  if (mappedColumnName === partitionColumn) {
    // No transform check can follow: the transform is a property of the mapped
    // column, and there is no coherent mapped column to read it from.
    issues.push({
      field: 'partition_column',
      message: t(
        'The partition column cannot be mapped onto itself. %(name)s is both the partition column and the mapped column.',
        { name: partitionColumn },
      ),
    });
    return issues;
  }

  const mappedColumn = columns.find(
    column => column.column_name === mappedColumnName,
  );
  issues.push(
    ...valueTransformIssues(
      mappedColumn,
      mappedColumn?.partition_value_transform,
    ),
  );

  return issues;
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
 * Only temporal columns get one, and only when the engine supplies it:
 * `unix_timestamp(:value)` is Hive-family syntax and would not parse on
 * Postgres or BigQuery, so a wrong default is worse than none.
 */
export function defaultTransformFor(
  datasource: PartitionMappingDatasource,
  column: PartitionMappingColumn | undefined,
): string {
  if (!column?.is_dttm) {
    return '';
  }
  return datasource.partition_value_transform_default || '';
}

/** Declared types whose values are numbers rather than strings. */
const NUMERIC_TYPE_RE =
  /INT|NUMERIC|DECIMAL|DOUBLE|FLOAT|REAL|NUMBER|BIGNUMERIC/i;

/**
 * Samples the preview evaluates the transform at.
 *
 * Temporal columns get one timestamp, because a time-range bound is what they
 * are mapped for. Everything else gets two values, so the preview demonstrates
 * the element-wise `IN` an ordinary categorical filter actually produces.
 *
 * The samples follow the column's declared type, not just whether it is
 * temporal. A mapped integer column with `CAST(:value AS INTEGER)` is a real
 * configuration, and evaluating it at `'US'` makes the engine reject a transform
 * that an actual `IN (2025, 2026)` filter would mirror perfectly well -- the
 * preview was reporting a fault in its own sample data.
 */
export function sampleValuesFor(
  column: PartitionMappingColumn | undefined,
): string[] {
  if (column?.is_dttm) {
    return ['2026-01-15 00:00:00'];
  }
  if (column?.type && NUMERIC_TYPE_RE.test(column.type)) {
    return ['2025', '2026'];
  }
  return ['US', 'CA'];
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
  return withMappingOn(
    columns,
    nextColumnName,
    next?.partition_value_transform || nextTransform || null,
    Boolean(next?.partition_transform_is_monotonic),
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
