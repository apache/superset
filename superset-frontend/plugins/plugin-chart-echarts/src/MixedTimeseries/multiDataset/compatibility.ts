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

function findColumn(
  dataset: DatasetColumns,
  axis: unknown,
): ColumnMeta | undefined {
  if (typeof axis !== 'string') return undefined;
  return ensureIsArray(dataset.columns).find(
    column => column.column_name === axis,
  );
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
  }

  return errors;
}
