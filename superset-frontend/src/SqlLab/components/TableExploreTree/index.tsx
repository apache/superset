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
  useCallback,
  useEffect,
  useState,
  useRef,
  type ChangeEvent,
  useMemo,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import AutoSizer from 'react-virtualized-auto-sizer';
// Due to performance issues with the virtual list in the existing Ant Design (antd)-based tree view,
// it has been replaced with react-arborist solution.
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import {
  Icons,
  Skeleton,
  Input,
  Empty,
  Button,
} from '@superset-ui/core/components';
import type { SqlLabRootState } from 'src/SqlLab/types';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { addTable, removeTables } from 'src/SqlLab/actions/sqlLab';
import {
  getItem,
  setItem,
  LocalStorageKeys,
} from 'src/utils/localStorageHelpers';
import PanelToolbar from 'src/components/PanelToolbar';
import { ViewLocations } from 'src/SqlLab/contributions';
import TreeNodeRenderer from './TreeNodeRenderer';
import useTreeData, { EMPTY_NODE_ID_PREFIX } from './useTreeData';
import type { TreeNodeData } from './types';
import { ErrorMessageWithStackTrace } from 'src/components';

type Props = {
  queryEditorId: string;
};

const StyledTreeContainer = styled.div`
  flex: 1 1 auto;
  .tree-node {
    display: flex;
    align-items: center;
    padding: 0 ${({ theme }) => theme.sizeUnit}px;
    position: relative;
    cursor: pointer;

    &:hover {
      background-color: ${({ theme }) => theme.colorBgTextHover};

      .action-static {
        display: none;
      }

      .action-hover {
        display: flex;
      }
    }

    &[data-selected='true'] {
      background-color: ${({ theme }) => theme.colorBgTextActive};

      .action-static {
        display: none;
      }

      .action-hover {
        display: flex;
      }
    }
  }

  .tree-node-icon {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.sizeUnit}px;
  }

  .tree-node-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .highlighted {
    background-color: ${({ theme }) => theme.colorWarningBg};
    font-weight: bold;
  }

  .side-action-container {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
  }

  .action-static {
    display: flex;
    align-items: center;
  }

  .action-hover {
    display: none;
    align-items: center;
    gap: ${({ theme }) => theme.sizeUnit * 0.5}px;
  }
`;

const ROW_HEIGHT = 28;

const getPinnedSchemasStorageKey = (
  dbId: number | undefined,
  catalog: string | null | undefined,
): string => `${dbId ?? ''}:${catalog ?? ''}`;

const getPinnedSchemasFromStorage = (
  dbId: number | undefined,
  catalog: string | null | undefined,
): Set<string> => {
  if (!dbId) return new Set();
  const stored = getItem(LocalStorageKeys.SqllabPinnedSchemas, {});
  const key = getPinnedSchemasStorageKey(dbId, catalog);
  const schemas = stored[key];
  return Array.isArray(schemas) ? new Set<string>(schemas) : new Set();
};

const savePinnedSchemasToStorage = (
  dbId: number | undefined,
  catalog: string | null | undefined,
  schemas: Set<string>,
) => {
  if (!dbId) return;
  const stored = getItem(LocalStorageKeys.SqllabPinnedSchemas, {});
  const key = getPinnedSchemasStorageKey(dbId, catalog);
  setItem(LocalStorageKeys.SqllabPinnedSchemas, {
    ...stored,
    [key]: [...schemas],
  });
};

const TableExploreTree: React.FC<Props> = ({ queryEditorId }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const treeRef = useRef<TreeApi<TreeNodeData>>(null);
  const tables = useSelector(
    ({ sqlLab }: SqlLabRootState) => sqlLab.tables,
    shallowEqual,
  );
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'catalog',
    'tabViewId',
  ]);
  const { dbId, catalog } = queryEditor;
  const editorId = queryEditor.tabViewId ?? queryEditor.id;
  const pinnedTables = useMemo(
    () =>
      Object.fromEntries(
        tables.map(({ queryEditorId, dbId, schema, name, persistData }) => [
          editorId === queryEditorId ? `${dbId}:${schema}:${name}` : '',
          persistData,
        ]),
      ),
    [tables, editorId],
  );

  // Tree data hook - manages schema/table/column data fetching and tree structure
  const {
    treeData,
    isFetching,
    refetch,
    loadingNodes,
    selectStarMap,
    handleToggle,
    handleRefreshTables,
    refreshTableSchema,
    errorPayload,
  } = useTreeData({
    dbId,
    catalog,
    pinnedTables,
  });

  const pinnedTableKeys = useMemo(
    () =>
      new Set(
        tables
          .filter(({ queryEditorId: qeId }) => editorId === qeId)
          .map(({ dbId, schema, name }) => `${dbId}:${schema}:${name}`),
      ),
    [tables, editorId],
  );

  const handlePinTable = useCallback(
    (tableName: string, schemaName: string, catalogName: string | null) =>
      dispatch(addTable(queryEditor, tableName, catalogName, schemaName)),
    [dispatch, queryEditor],
  );

  const handleUnpinTable = useCallback(
    (tableName: string, schemaName: string) => {
      const table = tables.find(
        t =>
          t.queryEditorId === editorId &&
          t.dbId === dbId &&
          t.schema === schemaName &&
          t.name === tableName,
      );
      if (table) {
        dispatch(removeTables([table]));
      }
    },
    [dispatch, tables, editorId, dbId],
  );
  const [pinnedSchemas, setPinnedSchemas] = useState<Set<string>>(() =>
    getPinnedSchemasFromStorage(dbId, catalog),
  );

  const previousDbIdRef = useRef<number | undefined>(dbId);
  const previousCatalogRef = useRef<string | null | undefined>(catalog);

  // Single effect handles both loading and persisting pinned schemas.
  // Using refs to detect source changes avoids the race condition where the
  // persist branch would run with stale pinnedSchemas right after a dbId/catalog
  // change, corrupting the new source's stored pins.
  useEffect(() => {
    const dbChanged = previousDbIdRef.current !== dbId;
    const catalogChanged = previousCatalogRef.current !== catalog;

    if (dbChanged || catalogChanged) {
      previousDbIdRef.current = dbId;
      previousCatalogRef.current = catalog;
      setPinnedSchemas(getPinnedSchemasFromStorage(dbId, catalog));
      return;
    }

    savePinnedSchemasToStorage(dbId, catalog, pinnedSchemas);
  }, [dbId, catalog, pinnedSchemas]);

  const handlePinSchema = useCallback((schemaName: string) => {
    setPinnedSchemas(prev => new Set([...prev, schemaName]));
  }, []);

  const handleUnpinSchema = useCallback((schemaName: string) => {
    setPinnedSchemas(prev => {
      const next = new Set(prev);
      next.delete(schemaName);
      return next;
    });
  }, []);

  const sortedTreeData = useMemo(() => {
    if (pinnedSchemas.size === 0) return treeData;
    const pinned = treeData.filter(node => pinnedSchemas.has(node.name));
    const rest = treeData.filter(node => !pinnedSchemas.has(node.name));
    return [...pinned, ...rest];
  }, [treeData, pinnedSchemas]);

  const [sortedTables, setSortedTables] = useState<Record<string, boolean>>({});
  const toggleSortColumns = useCallback((tableId: string) => {
    setSortedTables(prev => ({ ...prev, [tableId]: !prev[tableId] }));
  }, []);

  const displayTreeData = useMemo(() => {
    const activeSorted = Object.keys(sortedTables).filter(
      id => sortedTables[id],
    );
    if (activeSorted.length === 0) return sortedTreeData;

    const sortedSet = new Set(activeSorted);
    return sortedTreeData.map(schemaNode => ({
      ...schemaNode,
      children: schemaNode.children?.map(tableNode => {
        if (tableNode.type !== 'table' || !sortedSet.has(tableNode.id)) {
          return tableNode;
        }
        const { children } = tableNode;
        if (!children || children.length <= 1) return tableNode;
        return {
          ...tableNode,
          children: [...children].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
    }));
  }, [sortedTreeData, sortedTables]);

  const [searchTerm, setSearchTerm] = useState('');
  const handleSearchChange = useCallback(
    ({ target }: ChangeEvent<HTMLInputElement>) => setSearchTerm(target.value),
    [],
  );

  // Track manually opened nodes (not auto-expanded by search)
  const [manuallyOpenedNodes, setManuallyOpenedNodes] = useState<
    Record<string, boolean>
  >({});

  // Keep a ref so the treeData effect below always reads the latest value
  // without needing it as a dependency (we only want to re-open on data change).
  const manuallyOpenedNodesRef = useRef(manuallyOpenedNodes);
  manuallyOpenedNodesRef.current = manuallyOpenedNodes;

  // When treeData changes (e.g., children arrive after an async fetch),
  // react-arborist may reset the open state of nodes that just received children.
  // Explicitly re-open every node the user has manually opened so children
  // become visible immediately without requiring a second toggle.
  useEffect(() => {
    Object.entries(manuallyOpenedNodesRef.current)
      .filter(([, isOpen]) => isOpen)
      .forEach(([id]) => treeRef.current?.open(id));
  }, [treeData]);

  // Custom search match function for react-arborist
  const searchMatch = useCallback(
    (node: NodeApi<TreeNodeData>, term: string): boolean => {
      // Empty placeholder nodes should not match search
      if (node.data.type === 'empty') return false;
      if (!term) return true;

      const lowerTerm = term.toLowerCase();

      // Check if current node matches
      if (node.data.name.toLowerCase().includes(lowerTerm)) {
        return true;
      }

      // Check if any ancestor matches - if so, include this node (child of matching parent)
      // if (node.parent && node.parent.isRoot === false && node.parent.isOpen) {
      //   return true;
      // }
      let ancestor = node.parent;
      while (ancestor && !ancestor.isRoot) {
        if (ancestor.data.name.toLowerCase().includes(lowerTerm)) {
          return true;
        }
        ancestor = ancestor.parent;
      }
      return false;
    },
    [],
  );

  // Check if any nodes match the search term
  const hasMatchingNodes = useMemo(() => {
    if (!searchTerm) return true;

    const lowerTerm = searchTerm.toLowerCase();

    const checkNode = (node: TreeNodeData): boolean => {
      if (node.type === 'empty') return false;
      if (node.name.toLowerCase().includes(lowerTerm)) return true;
      if (node.children) {
        return node.children.some(child => checkNode(child));
      }
      return false;
    };

    return displayTreeData.some(node => checkNode(node));
  }, [searchTerm, displayTreeData]);

  // Node renderer for react-arborist
  const renderNode = useCallback(
    (props: Parameters<typeof TreeNodeRenderer>[0]) => (
      <TreeNodeRenderer
        {...props}
        manuallyOpenedNodes={manuallyOpenedNodes}
        loadingNodes={loadingNodes}
        searchTerm={searchTerm}
        catalog={catalog}
        pinnedTableKeys={pinnedTableKeys}
        pinnedSchemas={pinnedSchemas}
        selectStarMap={selectStarMap}
        handleRefreshTables={handleRefreshTables}
        handlePinTable={handlePinTable}
        handleUnpinTable={handleUnpinTable}
        handlePinSchema={handlePinSchema}
        handleUnpinSchema={handleUnpinSchema}
        refreshTableSchema={refreshTableSchema}
        sortedTables={sortedTables}
        toggleSortColumns={toggleSortColumns}
      />
    ),
    [
      catalog,
      pinnedTableKeys,
      pinnedSchemas,
      selectStarMap,
      handleRefreshTables,
      handlePinTable,
      handleUnpinTable,
      handlePinSchema,
      handleUnpinSchema,
      refreshTableSchema,
      sortedTables,
      toggleSortColumns,
      loadingNodes,
      manuallyOpenedNodes,
      searchTerm,
    ],
  );

  return (
    <>
      {/* Negative margin to align toolbar icons with other elements on the screen */}
      <div
        css={css`
          margin-left: -${theme.sizeUnit * 2}px;
        `}
      >
        <PanelToolbar
          viewId={ViewLocations.sqllab.leftSidebar}
          defaultPrimaryActions={
            <>
              <Button
                color="primary"
                variant="text"
                icon={<Icons.MinusSquareOutlined />}
                onClick={() => {
                  treeRef.current?.closeAll();
                  setManuallyOpenedNodes({});
                }}
                tooltip={t('Collapse all')}
              />
              <Button
                color="primary"
                variant="text"
                icon={<Icons.ReloadOutlined />}
                onClick={() => refetch()}
                loading={isFetching}
                tooltip={t('Force refresh schema list')}
              />
            </>
          }
        />
      </div>
      <Input
        allowClear
        type="text"
        className="form-control input-sm"
        placeholder={t('Enter a part of the object name')}
        onChange={handleSearchChange}
        value={searchTerm}
        css={css`
          margin-bottom: 2px;
        `}
      />
      {errorPayload && (
        <ErrorMessageWithStackTrace error={errorPayload} source="crud" />
      )}
      <StyledTreeContainer>
        <AutoSizer disableWidth>
          {({ height }) => {
            if (isFetching) {
              return <Skeleton active />;
            }

            if (searchTerm && !hasMatchingNodes) {
              return (
                <Empty
                  description={t('No matching results found')}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              );
            }

            return (
              <Tree<TreeNodeData>
                ref={treeRef}
                data={displayTreeData}
                width="100%"
                height={height || 500}
                rowHeight={ROW_HEIGHT}
                indent={16}
                searchTerm={searchTerm}
                searchMatch={searchMatch}
                disableDrag
                disableDrop
                openByDefault={false}
                initialOpenState={manuallyOpenedNodes}
                onToggle={id => {
                  // Skip empty placeholder nodes
                  if (id.startsWith(EMPTY_NODE_ID_PREFIX)) {
                    return;
                  }

                  // Determine the previous open state to compute the new state.
                  //
                  // When searchTerm is active, react-arborist auto-expands nodes whose
                  // descendants match the query. Those nodes have isOpen=true in the tree
                  // but are absent from manuallyOpenedNodes, so the original check
                  // (`manuallyOpenedNodes[id] ?? false`) misidentifies them as closed and
                  // inverts the toggle direction. Reading from treeRef (which holds the
                  // actual pre-toggle state because onToggle fires before the state change)
                  // fixes this.
                  //
                  // When searchTerm is empty, searchMatch returns true for every node and
                  // react-arborist marks all schemas as open (isOpen=true) even before any
                  // user interaction. Using treeRef in that case would treat every first
                  // click as a close action, so fall back to manuallyOpenedNodes instead.
                  const wasOpen = searchTerm
                    ? (treeRef.current?.get(id)?.isOpen ??
                      manuallyOpenedNodes[id] ??
                      false)
                    : (manuallyOpenedNodes[id] ?? false);
                  const isNowOpen = !wasOpen;

                  // Trigger data fetch when opening
                  if (isNowOpen) {
                    handleToggle(id, true);
                  }

                  // Track manually opened/closed state
                  setManuallyOpenedNodes(prev => ({
                    ...prev,
                    [id]: isNowOpen,
                  }));
                }}
              >
                {renderNode}
              </Tree>
            );
          }}
        </AutoSizer>
      </StyledTreeContainer>
    </>
  );
};

export default TableExploreTree;
