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
import type {
  PartitionMappingColumn,
  PartitionMappingDatasource,
  PartitionRowState,
} from './types';

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
 * Deliberately the same cheap signals the backend's summary uses: a mapping
 * with no transform is configured but inert, and saying so is the point of the
 * warning in wireframe 1g.
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
    return {
      ...column,
      partition_value_transform:
        column.partition_value_transform || nextTransform || null,
    };
  });
}

/**
 * Columns updated for a newly designated partition column.
 *
 * The partition key is technical, so it defaults out of Explore's dimension and
 * filter pickers. Only the defaults are set -- an owner who wants the raw
 * column exposed can toggle it back, and clearing the partition column later
 * does not undo their choice.
 */
export function applyPartitionColumnDefaults<T extends PartitionMappingColumn>(
  columns: T[],
  partitionColumnName: string,
): T[] {
  return columns.map(column =>
    column.column_name === partitionColumnName
      ? { ...column, filterable: false, groupby: false }
      : column,
  );
}
