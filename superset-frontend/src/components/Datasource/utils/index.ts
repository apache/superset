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
import {
  Children,
  cloneElement,
  ReactNode,
  ReactElement,
  isValidElement,
} from 'react';
import { nanoid } from 'nanoid';
import { SupersetClient } from '@superset-ui/core';
import { t, tn } from '@apache-superset/core/translation';
import rison from 'rison';
import type { ColumnObject } from 'src/features/datasets/types';

// Type definitions

export interface ColumnMetadata {
  id?: string | number;
  column_name: string;
  is_dttm?: boolean;
  type?: string;
  groupby?: boolean;
  filterable?: boolean;
  expression?: string;
  partition_value_transform?: string | null;
  partition_transform_is_monotonic?: boolean;
}

interface PartitionMappingFields {
  partition_column?: string | null;
  partition_mapped_column?: string | null;
}

interface ColumnChanges {
  added: string[];
  modified: string[];
  removed: string[];
  finalColumns: ColumnMetadata[];
}

interface ColumnSyncDescription {
  lines: string[];
  removesMainDttmCol: boolean;
}

interface DatasourceForSync {
  type?: string;
  datasource_type?: string;
  database?: {
    database_name?: string;
    name?: string;
  };
  catalog?: string;
  schema?: string;
  table_name?: string;
  normalize_columns?: boolean;
  always_filter_main_dttm?: boolean;
}

interface SyncParams {
  datasource_type?: string | null;
  database_name?: string | null;
  catalog_name?: string | null;
  schema_name?: string | null;
  table_name?: string | null;
  normalize_columns?: boolean | null;
  always_filter_main_dttm?: boolean | null;
  [key: string]: string | boolean | null | undefined;
}

// React element type to match against in recurseReactClone
interface ComponentType {
  name: string;
}

export function recurseReactClone<T extends Record<string, unknown>>(
  children: ReactNode,
  type: ComponentType,
  propExtender: (child: ReactElement<T>) => Record<string, unknown>,
): ReactNode {
  /**
   * Clones a React component's children, and injects new props
   * where the type specified is matched.
   */
  return Children.map(children, child => {
    let newChild = child;
    if (
      isValidElement<T>(child) &&
      child.type &&
      typeof child.type === 'function' &&
      (child.type as ComponentType).name === type.name
    ) {
      newChild = cloneElement(
        child,
        propExtender(child as ReactElement<T>) as Partial<T>,
      );
    }
    if (
      isValidElement(newChild) &&
      newChild.props &&
      (newChild.props as { children?: ReactNode }).children
    ) {
      newChild = cloneElement(
        newChild as ReactElement<{ children: ReactNode }>,
        {
          children: recurseReactClone(
            (newChild.props as { children: ReactNode }).children,
            type,
            propExtender,
          ),
        },
      );
    }
    return newChild;
  });
}

export function updateColumns(
  prevCols: ColumnMetadata[],
  newCols: ColumnMetadata[],
  addSuccessToast: (msg: string) => void,
): ColumnChanges {
  // cols: Array<{column_name: string; is_dttm: boolean; type: string;}>
  const databaseColumnNames = newCols.map(col => col.column_name);
  const currentCols = prevCols.reduce<Record<string, ColumnMetadata>>(
    (agg, col) => {
      // eslint-disable-next-line no-param-reassign
      agg[col.column_name] = col;
      return agg;
    },
    {},
  );
  const columnChanges: ColumnChanges = {
    added: [],
    modified: [],
    removed: prevCols
      .filter(
        col =>
          !(col.expression || databaseColumnNames.includes(col.column_name)),
      )
      .map(col => col.column_name),
    finalColumns: [],
  };
  newCols.forEach(col => {
    const currentCol = currentCols[col.column_name];
    if (!currentCol) {
      // new column
      columnChanges.finalColumns.push({
        id: nanoid(),
        column_name: col.column_name,
        type: col.type,
        groupby: true,
        filterable: true,
        is_dttm: col.is_dttm,
      });
      columnChanges.added.push(col.column_name);
    } else if (
      currentCol.type !== col.type ||
      // The temporal flag is kept once set (see below), so only a flag the
      // source newly reports changes the column.
      (!currentCol.is_dttm && col.is_dttm)
    ) {
      // modified column
      columnChanges.finalColumns.push({
        ...currentCol,
        type: col.type,
        is_dttm: currentCol.is_dttm || col.is_dttm,
      });
      columnChanges.modified.push(col.column_name);
    } else {
      // unchanged
      columnChanges.finalColumns.push(currentCol);
    }
  });
  // push all calculated columns
  prevCols
    .filter(col => col.expression)
    .forEach(col => {
      columnChanges.finalColumns.push(col);
    });

  if (columnChanges.modified.length) {
    addSuccessToast(
      tn(
        'Modified 1 column in the dataset',
        'Modified %s columns in the dataset',
        columnChanges.modified.length,
        columnChanges.modified.length,
      ),
    );
  }
  if (columnChanges.removed.length) {
    addSuccessToast(
      tn(
        'Removed 1 column from the dataset',
        'Removed %s columns from the dataset',
        columnChanges.removed.length,
        columnChanges.removed.length,
      ),
    );
  }
  if (columnChanges.added.length) {
    addSuccessToast(
      tn(
        'Added 1 new column to the dataset',
        'Added %s new columns to the dataset',
        columnChanges.added.length,
        columnChanges.added.length,
      ),
    );
  }
  return columnChanges;
}

/**
 * Describes what syncing `prevCols` to the source's `newCols` would change,
 * as the display lines of the sync preview.
 *
 * @param prevCols - The dataset's columns before the sync
 * @param newCols - The columns the source reports
 * @param mainDttmCol - The dataset's default datetime column, if any
 * @returns The lines to show, and whether the sync removes `mainDttmCol`
 */
export function describeColumnSync(
  prevCols: ColumnMetadata[],
  newCols: ColumnMetadata[],
  mainDttmCol?: string | null,
): ColumnSyncDescription {
  const changes = updateColumns(prevCols, newCols, () => {});
  const typesByName = (cols: ColumnMetadata[]) =>
    new Map(cols.map(col => [col.column_name, col.type]));
  const oldTypes = typesByName(prevCols);
  const newTypes = typesByName(newCols);
  // One display label per modified column. `updateColumns` reports a column
  // as modified for a new type or a newly temporal flag only, so an unchanged
  // type means the flag.
  // Built outside `t()`: string extraction skips a nested `t()` call.
  const modifiedLabels = changes.modified.map(name =>
    oldTypes.get(name) === newTypes.get(name)
      ? t('%s (now temporal)', name)
      : t(
          '%s (%s → %s)',
          name,
          oldTypes.get(name) ?? '?',
          newTypes.get(name) ?? '?',
        ),
  );
  const removesMainDttmCol =
    !!mainDttmCol && changes.removed.includes(mainDttmCol);
  const lines = [
    changes.added.length > 0 && t('Added: %s', changes.added.join(', ')),
    changes.removed.length > 0 && t('Removed: %s', changes.removed.join(', ')),
    modifiedLabels.length > 0 && t('Changed: %s', modifiedLabels.join(', ')),
    removesMainDttmCol &&
      t(
        'The default datetime column "%s" will be removed. Choose another default datetime column.',
        mainDttmCol,
      ),
  ].filter((line): line is string => !!line);
  return { lines, removesMainDttmCol };
}

/**
 * Fetches column metadata from the datasource's underlying table/view.
 * Used to sync dataset columns with the database schema.
 *
 * @param datasource - The datasource object
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Promise Array of column metadata objects
 */
/**
 * The parts of a partition filter mapping whose columns a sync just removed.
 *
 * Returns the fields to patch onto the datasource, or `null` when nothing needs
 * to change. The backend clears a dangling mapping too, on the authoritative
 * `override_columns` path -- this keeps the editor's own state honest between
 * a sync and the next save, so the owner isn't looking at a mapping that points
 * at a column the table no longer has.
 */
export function clearDanglingPartitionMapping(
  datasource: PartitionMappingFields,
  finalColumns: Pick<ColumnMetadata, 'column_name'>[],
): PartitionMappingFields | null {
  if (!datasource.partition_column) {
    return null;
  }

  const surviving = new Set(finalColumns.map(col => col.column_name));

  if (!surviving.has(datasource.partition_column)) {
    return { partition_column: null, partition_mapped_column: null };
  }

  if (
    datasource.partition_mapped_column &&
    !surviving.has(datasource.partition_mapped_column)
  ) {
    return {
      partition_column: datasource.partition_column,
      partition_mapped_column: null,
    };
  }

  return null;
}

export async function fetchSyncedColumns(
  datasource: DatasourceForSync,
  signal?: AbortSignal,
): Promise<ColumnMetadata[]> {
  const params: SyncParams = {
    datasource_type: datasource.type || datasource.datasource_type,
    database_name:
      datasource.database?.database_name || datasource.database?.name,
    catalog_name: datasource.catalog,
    schema_name: datasource.schema,
    table_name: datasource.table_name,
    normalize_columns: datasource.normalize_columns,
    always_filter_main_dttm: datasource.always_filter_main_dttm,
  };
  Object.entries(params).forEach(([key, value]) => {
    // rison can't encode the undefined value
    if (value === undefined) {
      params[key] = null;
    }
  });
  const endpoint = `/datasource/external_metadata_by_name/?q=${rison.encode_uri(
    params,
  )}`;
  const { json } = await SupersetClient.get({ endpoint, signal });
  return json as ColumnMetadata[];
}

/**
 * Lift each column's certification out of its `extra` JSON into the flat
 * fields the datasource editor binds to.
 */
export function withCertificationFields(columns: ColumnObject[] = []) {
  return columns.map(column => {
    // Malformed `extra` must not take out the whole column list, the way an
    // uncaught parse would — same fallback as `hydrateMetricExtra`.
    let parsedExtra;
    try {
      parsedExtra = JSON.parse(column.extra || '{}') || {};
    } catch {
      parsedExtra = {};
    }
    const {
      certification: { details = '', certified_by: certifiedBy = '' } = {},
    } = parsedExtra;
    return {
      ...column,
      certification_details: details || '',
      certified_by: certifiedBy || '',
      is_certified: details || certifiedBy,
    };
  });
}
