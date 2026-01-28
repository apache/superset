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
import { useMemo, useState, useCallback } from 'react';
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
  dataVersion: number;
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

  // Table data state
  const [tableData, setTableData] = useState<
    Record<string, { options: Table[] }>
  >({});

  // Table schema/metadata state
  const [tableSchemaData, setTableSchemaData] = useState<
    Record<string, TableMetaData>
  >({});

  // Lazy query hooks
  const [fetchLazyTables] = useLazyTablesQuery();
  const [fetchTableMetadata] = useLazyTableMetadataQuery();
  const [fetchTableExtendedMetadata] = useLazyTableExtendedMetadataQuery();

  // Track nodes that are loading
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});

  // Version counter to force tree re-render when data changes during search
  const [dataVersion, setDataVersion] = useState(0);

  // Handle async loading when node is toggled open
  const handleToggle = useCallback(
    async (id: string, isOpen: boolean) => {
      // Only fetch when opening a node
      if (!isOpen) return;

      const parts = id.split(':');
      const [identifier, databaseId, schema, table] = parts;
      const parsedDbId = Number(databaseId);

      if (identifier === 'schema') {
        // Use functional update to check current state without stale closure
        setTableData(currentTableData => {
          const schemaKey = `${parsedDbId}:${schema}`;
          if (!currentTableData?.[schemaKey]) {
            // Set loading state
            setLoadingNodes(prev => ({ ...prev, [id]: true }));

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
                  setTableData(origin => ({
                    ...origin,
                    [schemaKey]: data,
                  }));
                  // Force tree re-render to apply search filter to new data
                  setDataVersion(v => v + 1);
                }
              })
              .finally(() => {
                setLoadingNodes(prev => ({ ...prev, [id]: false }));
              });
          }
          return currentTableData;
        });
      }

      if (identifier === 'table') {
        const tableKey = `${parsedDbId}:${schema}:${table}`;

        // Check pinnedTables first (it's stable)
        if (pinnedTables[tableKey]) return;

        // Use functional update to check current state
        setTableSchemaData(currentTableSchemaData => {
          if (!currentTableSchemaData[tableKey]) {
            // Set loading state
            setLoadingNodes(prev => ({ ...prev, [id]: true }));

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
                ([
                  { data: tableMetadata },
                  { data: tableExtendedMetadata },
                ]) => {
                  if (tableMetadata) {
                    setTableSchemaData(origin => ({
                      ...origin,
                      [tableKey]: {
                        ...tableMetadata,
                        ...tableExtendedMetadata,
                      },
                    }));
                    // Force tree re-render to apply search filter to new data
                    setDataVersion(v => v + 1);
                  }
                },
              )
              .finally(() => {
                setLoadingNodes(prev => ({ ...prev, [id]: false }));
              });
          }
          return currentTableSchemaData;
        });
      }
    },
    [
      catalog,
      fetchLazyTables,
      fetchTableExtendedMetadata,
      fetchTableMetadata,
      pinnedTables,
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
    dataVersion,
    handleToggle,
    fetchLazyTables,
  };
};

export default useTreeData;
