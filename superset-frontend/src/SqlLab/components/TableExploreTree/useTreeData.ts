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
import { useMemo, useReducer, useCallback } from 'react';
import { t } from '@apache-superset/core';
import {
  Table,
  type TableMetaData,
  useSchemas,
  useLazyTablesQuery,
  useLazyTableMetadataQuery,
  useLazyTableExtendedMetadataQuery,
} from 'src/hooks/apiResources';
import type { TreeNodeData } from './types';

export const EMPTY_NODE_ID_PREFIX = 'empty:';

// Reducer state and actions
interface TreeDataState {
  tableData: Record<string, { options: Table[] }>;
  tableSchemaData: Record<string, TableMetaData>;
  loadingNodes: Record<string, boolean>;
}

type TreeDataAction =
  | { type: 'SET_TABLE_DATA'; key: string; data: { options: Table[] } }
  | { type: 'SET_TABLE_SCHEMA_DATA'; key: string; data: TableMetaData }
  | { type: 'SET_LOADING_NODE'; nodeId: string; loading: boolean };

const initialState: TreeDataState = {
  tableData: {},
  tableSchemaData: {},
  loadingNodes: {},
};

function treeDataReducer(
  state: TreeDataState,
  action: TreeDataAction,
): TreeDataState {
  switch (action.type) {
    case 'SET_TABLE_DATA':
      return {
        ...state,
        tableData: { ...state.tableData, [action.key]: action.data },
      };
    case 'SET_TABLE_SCHEMA_DATA':
      return {
        ...state,
        tableSchemaData: {
          ...state.tableSchemaData,
          [action.key]: action.data,
        },
      };
    case 'SET_LOADING_NODE':
      return {
        ...state,
        loadingNodes: {
          ...state.loadingNodes,
          [action.nodeId]: action.loading,
        },
      };
    default:
      return state;
  }
}

interface UseTreeDataParams {
  dbId: number | undefined;
  catalog: string | null | undefined;
  selectedSchema: string | undefined;
  pinnedTables: Record<string, TableMetaData | undefined>;
}

interface UseTreeDataResult {
  treeData: TreeNodeData[];
  isFetching: boolean;
  refetch: () => void;
  loadingNodes: Record<string, boolean>;
  handleToggle: (id: string, isOpen: boolean) => Promise<void>;
  fetchLazyTables: ReturnType<typeof useLazyTablesQuery>[0];
}

const createEmptyNode = (parentId: string): TreeNodeData => ({
  id: `${EMPTY_NODE_ID_PREFIX}${parentId}`,
  name: t('No items'),
  type: 'empty',
});

const useTreeData = ({
  dbId,
  catalog,
  selectedSchema,
  pinnedTables,
}: UseTreeDataParams): UseTreeDataResult => {
  // Schema data from API
  const {
    currentData: schemaData,
    isFetching,
    refetch,
  } = useSchemas({ dbId, catalog: catalog || undefined });
  // Lazy query hooks
  const [fetchLazyTables] = useLazyTablesQuery();
  const [fetchTableMetadata] = useLazyTableMetadataQuery();
  const [fetchTableExtendedMetadata] = useLazyTableExtendedMetadataQuery();

  // Combined state for table data, schema data, loading nodes, and data version
  const [state, dispatch] = useReducer(treeDataReducer, initialState);
  const { tableData, tableSchemaData, loadingNodes } = state;

  // Handle async loading when node is toggled open
  const handleToggle = useCallback(
    async (id: string, isOpen: boolean) => {
      // Only fetch when opening a node
      if (!isOpen) return;

      const parts = id.split(':');
      const [identifier, databaseId, schema, table] = parts;
      const parsedDbId = Number(databaseId);

      if (identifier === 'schema') {
        const schemaKey = `${parsedDbId}:${schema}`;
        if (!tableData?.[schemaKey]) {
          // Set loading state
          dispatch({ type: 'SET_LOADING_NODE', nodeId: id, loading: true });

          // Fetch tables asynchronously
          fetchLazyTables(
            {
              dbId: parsedDbId,
              catalog,
              schema,
              forceRefresh: false,
            },
            true,
          )
            .then(({ data }) => {
              if (data) {
                dispatch({ type: 'SET_TABLE_DATA', key: schemaKey, data });
              }
            })
            .finally(() => {
              dispatch({
                type: 'SET_LOADING_NODE',
                nodeId: id,
                loading: false,
              });
            });
        }
      }

      if (identifier === 'table') {
        const tableKey = `${parsedDbId}:${schema}:${table}`;

        // Check pinnedTables first (it's stable)
        if (pinnedTables[tableKey]) return;

        if (!tableSchemaData[tableKey]) {
          // Set loading state
          dispatch({ type: 'SET_LOADING_NODE', nodeId: id, loading: true });

          // Fetch metadata asynchronously
          Promise.all([
            fetchTableMetadata(
              {
                dbId: parsedDbId,
                catalog,
                schema,
                table,
              },
              true,
            ),
            fetchTableExtendedMetadata(
              {
                dbId: parsedDbId,
                catalog,
                schema,
                table,
              },
              true,
            ),
          ])
            .then(
              ([{ data: tableMetadata }, { data: tableExtendedMetadata }]) => {
                if (tableMetadata) {
                  dispatch({
                    type: 'SET_TABLE_SCHEMA_DATA',
                    key: tableKey,
                    data: {
                      ...tableMetadata,
                      ...tableExtendedMetadata,
                    },
                  });
                }
              },
            )
            .finally(() => {
              dispatch({
                type: 'SET_LOADING_NODE',
                nodeId: id,
                loading: false,
              });
            });
        }
      }
    },
    [
      catalog,
      fetchLazyTables,
      fetchTableExtendedMetadata,
      fetchTableMetadata,
      pinnedTables,
      tableData,
      tableSchemaData,
    ],
  );

  // Build tree data
  const treeData = useMemo((): TreeNodeData[] => {
    // Filter schemas if a schema is selected, otherwise show all
    const filteredSchemaData = selectedSchema
      ? schemaData?.filter(schema => schema.value === selectedSchema)
      : schemaData;

    const data = filteredSchemaData?.map(schema => {
      const schemaKey = `${dbId}:${schema.value}`;
      const schemaId = `schema:${dbId}:${schema.value}`;
      const tablesData = tableData?.[schemaKey];
      const tables = tablesData?.options;

      // Determine children for schema node
      let schemaChildren: TreeNodeData[];
      if (!tablesData) {
        // Not loaded yet - empty array makes it expandable
        schemaChildren = [];
      } else if (tables && tables.length > 0) {
        // Has tables
        schemaChildren = tables.map(({ value: tableName, type: tableType }) => {
          const tableKey = `${dbId}:${schema.value}:${tableName}`;
          const tableId = `table:${dbId}:${schema.value}:${tableName}`;
          const columnsData =
            tableSchemaData[tableKey] ?? pinnedTables[tableKey];
          const columns = columnsData?.columns;

          // Determine children for table node
          let tableChildren: TreeNodeData[];
          if (!columnsData) {
            // Not loaded yet
            tableChildren = [];
          } else if (columns && columns.length > 0) {
            // Has columns
            tableChildren = columns.map(col => ({
              id: `column:${dbId}:${schema.value}:${tableName}:${col.name}`,
              name: col.name,
              type: 'column' as const,
              columnData: col,
            }));
          } else {
            // Loaded but empty
            tableChildren = [createEmptyNode(tableId)];
          }

          return {
            id: tableId,
            name: tableName,
            type: 'table' as const,
            tableType,
            children: tableChildren,
            disableCheckbox: !columnsData,
          };
        });
      } else {
        // Loaded but empty
        schemaChildren = [createEmptyNode(schemaId)];
      }

      return {
        id: schemaId,
        name: schema.label,
        type: 'schema' as const,
        children: schemaChildren,
        disableCheckbox: !tablesData,
      };
    });

    return data ?? [];
  }, [
    dbId,
    schemaData,
    tableData,
    tableSchemaData,
    pinnedTables,
    selectedSchema,
  ]);

  return {
    treeData,
    isFetching,
    refetch,
    loadingNodes,
    handleToggle,
    fetchLazyTables,
  };
};

export default useTreeData;
