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
import { ensureIsArray, QueryFormData } from '@superset-ui/core';
import { ColumnMeta, Dataset } from '@superset-ui/chart-controls';

type DatasetColumns = Pick<Dataset, 'columns'>;

/** A select choice: `[value, label]`. */
export type Choice = [string, string];

function findColumn(
  dataset: DatasetColumns | null | undefined,
  axis: unknown,
): ColumnMeta | undefined {
  if (!dataset || typeof axis !== 'string') return undefined;
  return ensureIsArray(dataset.columns).find(
    column => column.column_name === axis,
  );
}

/** Columns that can be grouped by, i.e. used as an X-axis. */
function getGroupableColumns(dataset: DatasetColumns): ColumnMeta[] {
  const columns = ensureIsArray(dataset.columns);
  // Some payloads (e.g. SQL Lab query results) carry no `groupby` flag; treat
  // every column as groupable then, as the shared X-axis control does.
  const hasGroupbyFlag = Object.prototype.hasOwnProperty.call(
    columns[0] ?? {},
    'groupby',
  );
  return hasGroupbyFlag ? columns.filter(column => column.groupby) : columns;
}

/** Whether both columns carry a generic type and the types differ. */
function haveDifferentTypes(a: ColumnMeta, b: ColumnMeta): boolean {
  return (
    a.type_generic != null &&
    b.type_generic != null &&
    a.type_generic !== b.type_generic
  );
}

/**
 * Returns the Dataset B columns that can stand in for Query A's X-axis,
 * with a column of the same name first.
 *
 * - Query A's X-axis is temporal: Dataset B's temporal columns.
 * - Query A's X-axis is categorical: Dataset B's non-temporal columns of the
 *   same generic type, so the values can match exactly (`"1"` never equals
 *   `1`). Columns without a known type are kept.
 * - Query A has no X-axis, or an ad-hoc one without column metadata: every
 *   groupable Dataset B column.
 */
export function getCompatibleXAxisColumns(
  datasetA: DatasetColumns | null | undefined,
  datasetB: DatasetColumns,
  xAxisA: unknown,
): ColumnMeta[] {
  const groupable = getGroupableColumns(datasetB);
  const columnA = findColumn(datasetA, xAxisA);

  let candidates = groupable;
  if (columnA?.is_dttm) {
    candidates = groupable.filter(column => column.is_dttm);
  } else if (columnA) {
    candidates = groupable.filter(
      column => !column.is_dttm && !haveDifferentTypes(columnA, column),
    );
  }

  const sameName = candidates.filter(column => column.column_name === xAxisA);
  const others = candidates.filter(column => column.column_name !== xAxisA);
  return [...sameName, ...others];
}

/**
 * Picks the Dataset B column to preselect for the shared X-axis, or `null`
 * when the user has to choose.
 *
 * A same-named compatible column wins. For a temporal axis, Dataset B's main
 * datetime column (or its first temporal column) is a safe default. For a
 * categorical axis no guess is made: matching unrelated columns by position
 * would plot unrelated values on one axis.
 */
export function suggestXAxisColumn(
  datasetA: DatasetColumns | null | undefined,
  datasetB: Pick<Dataset, 'columns' | 'main_dttm_col'>,
  xAxisA: unknown,
): string | null {
  const candidates = getCompatibleXAxisColumns(datasetA, datasetB, xAxisA);
  if (candidates[0] && candidates[0].column_name === xAxisA) {
    return candidates[0].column_name;
  }
  if (!findColumn(datasetA, xAxisA)?.is_dttm) return null;
  const mainColumn = candidates.find(
    column => column.column_name === datasetB.main_dttm_col,
  );
  return (mainColumn ?? candidates[0])?.column_name ?? null;
}

/**
 * Narrows Dataset A's time grain choices to those Dataset B also supports,
 * keeping Dataset A's order and labels. When Dataset B does not report its
 * time grains the choices are returned unchanged.
 */
export function getSharedTimeGrains(
  choicesA: Choice[],
  datasetB: Pick<Dataset, 'time_grain_sqla'>,
): Choice[] {
  const grainsB = datasetB.time_grain_sqla;
  if (!Array.isArray(grainsB)) return choicesA;
  const codesB = new Set(grainsB.map(([code]) => code));
  return choicesA.filter(([code]) => codesB.has(code));
}

/**
 * Checks that Dataset B's database can bucket by the selected time grain.
 * Returns user-facing errors, an empty list meaning the grain is supported
 * or cannot be checked.
 */
export function checkTimeGrainSupport(
  datasetB: Pick<Dataset, 'time_grain_sqla'>,
  timeGrain: unknown,
  timeGrainLabel?: string,
): string[] {
  const grainsB = datasetB.time_grain_sqla;
  if (typeof timeGrain !== 'string' || !timeGrain || !Array.isArray(grainsB)) {
    return [];
  }
  if (grainsB.some(([code]) => code === timeGrain)) return [];
  return [
    t(
      'The database of Dataset B does not support the time grain "%s". Pick a time grain that both datasets support.',
      timeGrainLabel || timeGrain,
    ),
  ];
}

/**
 * Checks that Dataset B can supply the shared X-axis of the chart.
 *
 * Pure: it takes already-loaded metadata and returns user-facing errors, an
 * empty list meaning the pair is compatible.
 *
 * - `x_axis_b` must exist in Dataset B.
 * - The X-axes must agree on being temporal, in both directions. A temporal
 *   axis on one side and a categorical axis on the other would plot
 *   unrelated values on one axis.
 * - Two categorical X-axes must have the same generic type, since values
 *   are matched by exact equality.
 *
 * Ad-hoc (non-string) X-axes carry no column metadata, so their type is
 * unknown and is not flagged.
 */
export function checkCompatibility(
  datasetA: DatasetColumns,
  datasetB: DatasetColumns,
  formData: QueryFormData,
): string[] {
  const data = formData as Record<string, unknown>;
  const errors: string[] = [];

  const columnB = findColumn(datasetB, data.x_axis_b);
  if (typeof data.x_axis_b === 'string' && !columnB) {
    errors.push(
      t('Column "%s" was not found in Dataset B.', String(data.x_axis_b)),
    );
  }

  const columnA = findColumn(datasetA, data.x_axis);
  if (
    columnA &&
    columnB &&
    Boolean(columnA.is_dttm) !== Boolean(columnB.is_dttm)
  ) {
    errors.push(
      columnA.is_dttm
        ? t(
            'The X-axis of Query A is temporal but "%s" in Dataset B is not.',
            columnB.column_name,
          )
        : t(
            'The X-axis of Query B ("%s") is temporal but "%s" in Dataset A is not.',
            columnB.column_name,
            columnA.column_name,
          ),
    );
  } else if (
    columnA &&
    columnB &&
    !columnA.is_dttm &&
    haveDifferentTypes(columnA, columnB)
  ) {
    errors.push(
      t(
        'The X-axis columns "%s" in Dataset A and "%s" in Dataset B have different data types, so their values cannot line up.',
        columnA.column_name,
        columnB.column_name,
      ),
    );
  }

  return errors;
}
