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
import { tn } from '@apache-superset/core/ui';
import rison from 'rison';

// Type definitions

interface ColumnMetadata {
  id?: string | number;
  column_name: string;
  is_dttm?: boolean;
  type?: string;
  groupby?: boolean;
  filterable?: boolean;
  expression?: string;
}

interface ColumnChanges {
  added: string[];
  modified: string[];
  removed: string[];
  finalColumns: ColumnMetadata[];
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
  propExtender: (child: ReactElement<T>) => Partial<T>,
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
      newChild = cloneElement(child, propExtender(child as ReactElement<T>));
    }
    if (
      isValidElement(newChild) &&
      newChild.props &&
      (newChild.props as { children?: ReactNode }).children
    ) {
      newChild = cloneElement(newChild, {
        children: recurseReactClone(
          (newChild.props as { children: ReactNode }).children,
          type,
          propExtender,
        ),
      });
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
      currentCol.is_dttm !== col.is_dttm
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
        'Modified 1 column in the virtual dataset',
        'Modified %s columns in the virtual dataset',
        columnChanges.modified.length,
        columnChanges.modified.length,
      ),
    );
  }
  if (columnChanges.removed.length) {
    addSuccessToast(
      tn(
        'Removed 1 column from the virtual dataset',
        'Removed %s columns from the virtual dataset',
        columnChanges.removed.length,
        columnChanges.removed.length,
      ),
    );
  }
  if (columnChanges.added.length) {
    addSuccessToast(
      tn(
        'Added 1 new column to the virtual dataset',
        'Added %s new columns to the virtual dataset',
        columnChanges.added.length,
        columnChanges.added.length,
      ),
    );
  }
  return columnChanges;
}

/**
 * Fetches column metadata from the datasource's underlying table/view.
 * Used to sync dataset columns with the database schema.
 *
 * @param datasource - The datasource object
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Promise Array of column metadata objects
 */
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
