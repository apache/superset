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
import { Children, cloneElement } from 'react';
import { nanoid } from 'nanoid';
import { SupersetClient, tn } from '@superset-ui/core';
import rison from 'rison';

export function recurseReactClone(children, type, propExtender) {
  /**
   * Clones a React component's children, and injects new props
   * where the type specified is matched.
   */
  return Children.map(children, child => {
    let newChild = child;
    if (child && child.type.name === type.name) {
      newChild = cloneElement(child, propExtender(child));
    }
    if (newChild && newChild.props.children) {
      newChild = cloneElement(newChild, {
        children: recurseReactClone(
          newChild.props.children,
          type,
          propExtender,
        ),
      });
    }
    return newChild;
  });
}

export function updateColumns(prevCols, newCols, addSuccessToast) {
  // cols: Array<{column_name: string; is_dttm: boolean; type: string;}>
  const databaseColumnNames = newCols.map(col => col.column_name);
  const currentCols = prevCols.reduce((agg, col) => {
    // eslint-disable-next-line no-param-reassign
    agg[col.column_name] = col;
    return agg;
  }, {});
  const columnChanges = {
    added: [],
    modified: [],
    removed: prevCols
      .map(col => col.column_name)
      .filter(col => !databaseColumnNames.includes(col)),
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
  if (columnChanges.modified.length) {
    addSuccessToast(
      tn(
        'Modified 1 column in the virtual dataset',
        'Modified %s columns in the virtual dataset',
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
      ),
    );
  }
  if (columnChanges.added.length) {
    addSuccessToast(
      tn(
        'Added 1 new column to the virtual dataset',
        'Added %s new columns to the virtual dataset',
        columnChanges.added.length,
      ),
    );
  }
  return columnChanges;
}

export async function fetchSyncedColumns(datasource) {
  const params = {
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
  const { json } = await SupersetClient.get({ endpoint });
  return json;
}
