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
  useMemo,
  useCallback,
  useState,
  useRef,
  type ChangeEvent,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { css, styled, t } from '@apache-superset/core';
import AutoSizer from 'react-virtualized-auto-sizer';
// Due to performance issues with the virtual list in the existing Ant Design (antd)-based tree view,
// it has been replaced with react-arborist solution.
import { Tree, TreeApi, NodeRendererProps, NodeApi } from 'react-arborist';
import {
  Icons,
  Skeleton,
  Input,
  Tooltip,
  Empty,
  Typography,
  Button,
  Flex,
} from '@superset-ui/core/components';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import type { SqlLabRootState } from 'src/SqlLab/types';
import ColumnElement, {
  type ColumnKeyTypeType,
} from 'src/SqlLab/components/ColumnElement';
import {
  Table,
  TableMetaData,
  useSchemas,
  useLazyTablesQuery,
  useLazyTableMetadataQuery,
  useLazyTableExtendedMetadataQuery,
} from 'src/hooks/apiResources';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { addTable } from 'src/SqlLab/actions/sqlLab';
import IconButton from 'src/dashboard/components/IconButton';
import PanelToolbar from 'src/components/PanelToolbar';
import { ViewContribution } from 'src/SqlLab/contributions';

type Props = {
  queryEditorId: string;
};

interface TreeNodeData {
  id: string;
  name: string;
  type: 'schema' | 'table' | 'column' | 'empty';
  tableType?: string;
  columnData?: {
    name: string;
    keys?: { type: ColumnKeyTypeType }[];
    type: string;
  };
  children?: TreeNodeData[];
  disableCheckbox?: boolean;
}

const EMPTY_NODE_ID_PREFIX = 'empty:';

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

      .side-action-container {
        opacity: 1;
      }
    }

    &[data-selected='true'] {
      background-color: ${({ theme }) => theme.colorBgTextActive};

      .side-action-container {
        opacity: 1;
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
    opacity: 0;
    position: absolute;
    right: ${({ theme }) => theme.sizeUnit * 1.5}px;
    top: 50%;
    transform: translateY(-50%);
    z-index: ${({ theme }) => theme.zIndexPopupBase};
  }
`;

const StyledColumnNode = styled.div`
  & > .ant-flex {
    flex: 1;
    margin-right: ${({ theme }) => theme.sizeUnit * 1.5}px;
    cursor: default;
  }
`;

const ROW_HEIGHT = 28;

const getOpacity = (disableCheckbox: boolean | undefined) => ({
  opacity: disableCheckbox ? 0.6 : 1,
});

const highlightText = (text: string, keyword: string): React.ReactNode => {
  if (!keyword) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    return text;
  }

  const beforeStr = text.substring(0, index);
  const matchStr = text.substring(index, index + keyword.length);
  const afterStr = text.slice(index + keyword.length);

  return (
    <>
      {beforeStr}
      <span className="highlighted">{matchStr}</span>
      {afterStr}
    </>
  );
};

const TableExploreTree: React.FC<Props> = ({ queryEditorId }) => {
  const dispatch = useDispatch();
  const treeRef = useRef<TreeApi<TreeNodeData>>(null);
  const tables = useSelector(
    ({ sqlLab }: SqlLabRootState) => sqlLab.tables,
    shallowEqual,
  );
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'schema',
    'catalog',
  ]);
  const { dbId, catalog } = queryEditor;
  const pinnedTables = useMemo(
    () =>
      Object.fromEntries(
        tables.map(({ queryEditorId, dbId, schema, name, persistData }) => [
          queryEditor.id === queryEditorId ? `${dbId}:${schema}:${name}` : '',
          persistData,
        ]),
      ),
    [tables, queryEditor.id],
  );
  const {
    currentData: schemaData,
    isFetching,
    refetch,
  } = useSchemas({ dbId, catalog: catalog || undefined });
  const [tableData, setTableData] = useState<
    Record<string, { options: Table[] }>
  >({});
  const [tableSchemaData, setTableSchemaData] = useState<
    Record<string, TableMetaData>
  >({});
  const [fetchLazyTables] = useLazyTablesQuery();
  const [fetchTableMetadata] = useLazyTableMetadataQuery();
  const [fetchTableExtendedMetadata] = useLazyTableExtendedMetadataQuery();

  const handlePinTable = useCallback(
    (tableName: string, schemaName: string, catalogName: string | null) =>
      dispatch(addTable(queryEditor, tableName, catalogName, schemaName)),
    [dispatch, queryEditor],
  );
  const [searchTerm, setSearchTerm] = useState('');
  const handleSearchChange = useCallback(
    ({ target }: ChangeEvent<HTMLInputElement>) => setSearchTerm(target.value),
    [],
  );

  // Track manually opened nodes (not auto-expanded by search)
  const [manuallyOpenedNodes, setManuallyOpenedNodes] = useState<
    Record<string, boolean>
  >({});

  // Track nodes that are currently loading
  const [loadingNodes, setLoadingNodes] = useState<Record<string, boolean>>({});

  // Version counter to force tree re-render when data changes during search
  const [dataVersion, setDataVersion] = useState(0);

  // Helper to create empty placeholder node
  const createEmptyNode = (parentId: string): TreeNodeData => ({
    id: `${EMPTY_NODE_ID_PREFIX}${parentId}`,
    name: t('No items'),
    type: 'empty',
  });

  // Tree data for react-arborist
  // children must be [] (not undefined) to make node expandable
  const treeData = useMemo((): TreeNodeData[] => {
    const data = schemaData?.map(schema => {
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
      };
    });

    return data ?? [];
  }, [dbId, schemaData, tableData, tableSchemaData, pinnedTables]);

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

    return treeData.some(node => checkNode(node));
  }, [searchTerm, treeData]);

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

  // Node renderer for react-arborist
  const NodeRenderer = useCallback(
    ({ node, style }: NodeRendererProps<TreeNodeData>) => {
      const { data } = node;
      const parts = data.id.split(':');
      const [identifier, _dbId, schema, tableName] = parts;

      // Use manually tracked open state for icon display
      // This prevents search auto-expansion from affecting the icon
      const isManuallyOpen = manuallyOpenedNodes[data.id] ?? false;
      const isLoading = loadingNodes[data.id] ?? false;

      const renderIcon = () => {
        if (identifier === 'schema') {
          // Show loading icon when fetching data for schema
          if (isLoading) {
            return <Icons.LoadingOutlined iconSize="l" />;
          }
          return isManuallyOpen ? (
            <Icons.FolderOpenOutlined iconSize="l" />
          ) : (
            <Icons.FolderOutlined iconSize="l" />
          );
        }

        if (identifier === 'table') {
          const TableTypeIcon =
            data.tableType === 'view' ? Icons.EyeOutlined : Icons.TableOutlined;
          // Show loading icon with table type icon when loading
          if (isLoading) {
            return (
              <>
                <Icons.LoadingOutlined iconSize="l" />
                <TableTypeIcon iconSize="l" />
              </>
            );
          }
          const ExpandIcon = isManuallyOpen
            ? Icons.MinusSquareOutlined
            : Icons.PlusSquareOutlined;
          return (
            <>
              <ExpandIcon iconSize="l" />
              <TableTypeIcon iconSize="l" />
            </>
          );
        }

        return null;
      };

      // Empty placeholder node - no actions allowed
      if (data.type === 'empty') {
        return (
          <div
            className="tree-node"
            style={{
              ...style,
              opacity: 0.5,
              fontStyle: 'italic',
              cursor: 'default',
            }}
          >
            <span className="tree-node-icon">
              <Icons.FileOutlined iconSize="l" />
            </span>
            <span className="tree-node-title">{data.name}</span>
          </div>
        );
      }

      // Column nodes use ColumnElement
      if (identifier === 'column' && data.columnData) {
        return (
          <StyledColumnNode
            className="tree-node"
            style={style}
            data-selected={node.isSelected}
            onClick={() => node.select()}
          >
            <ColumnElement column={data.columnData} />
          </StyledColumnNode>
        );
      }

      return (
        <div
          className="tree-node"
          style={style}
          data-selected={node.isSelected}
          onClick={e => {
            e.stopPropagation();
            if (node.isLeaf) {
              node.select();
            } else {
              node.toggle();
            }
          }}
        >
          <span className="tree-node-icon">{renderIcon()}</span>
          <Typography.Text
            className="tree-node-title"
            style={getOpacity(data.disableCheckbox)}
            ellipsis={{
              tooltip: { title: data.name, placement: 'topLeft' },
            }}
          >
            {highlightText(data.name, searchTerm)}
          </Typography.Text>
          {identifier === 'schema' && (
            <div className="side-action-container" role="menu">
              <RefreshLabel
                onClick={e => {
                  e.stopPropagation();
                  fetchLazyTables({
                    dbId: _dbId,
                    catalog,
                    schema,
                    forceRefresh: true,
                  });
                }}
                tooltipContent={t('Force refresh table list')}
              />
            </div>
          )}
          {identifier === 'table' && (
            <div
              className="side-action-container"
              role="menu"
              css={css`
                position: inherit;
              `}
            >
              <IconButton
                icon={
                  <Tooltip title={t('Pin to the result panel')}>
                    <Icons.FolderAddOutlined iconSize="xl" />
                  </Tooltip>
                }
                onClick={e => {
                  e.stopPropagation();
                  handlePinTable(tableName, schema, catalog ?? null);
                }}
              />
            </div>
          )}
        </div>
      );
    },
    [
      catalog,
      fetchLazyTables,
      handlePinTable,
      loadingNodes,
      manuallyOpenedNodes,
      searchTerm,
    ],
  );

  return (
    <>
      <Flex
        css={css`
          flex-direction: row-reverse;
        `}
      >
        <PanelToolbar
          viewId={ViewContribution.LeftSidebar}
          defaultPrimaryActions={
            <>
              <Button
                color="primary"
                variant="text"
                icon={<Icons.FolderOpenOutlined />}
                onClick={() => {
                  treeRef.current?.openAll();
                  const allNodeIds: Record<string, boolean> = {};
                  const collectNodeIds = (nodes: TreeNodeData[]) => {
                    nodes.forEach(node => {
                      if (node.type !== 'empty' && node.type !== 'column') {
                        allNodeIds[node.id] = true;
                        if (node.children) {
                          collectNodeIds(node.children);
                        }
                      }
                    });
                  };
                  collectNodeIds(treeData);
                  setManuallyOpenedNodes(allNodeIds);
                }}
                tooltip={t('Expand all')}
              />
              <Button
                color="primary"
                variant="text"
                icon={<Icons.FolderOutlined />}
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
      </Flex>
      <Input
        allowClear
        type="text"
        className="form-control input-sm"
        placeholder={t('Enter a part of the object name')}
        onChange={handleSearchChange}
        value={searchTerm}
      />
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
                key={`tree-${dataVersion}`}
                ref={treeRef}
                data={treeData}
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

                  // Track manually opened/closed state
                  setManuallyOpenedNodes(prev => {
                    const wasOpen = prev[id] ?? false;
                    const isNowOpen = !wasOpen;

                    // Trigger data fetch when opening
                    if (isNowOpen) {
                      handleToggle(id, true);
                    }

                    return { ...prev, [id]: isNowOpen };
                  });
                }}
              >
                {NodeRenderer}
              </Tree>
            );
          }}
        </AutoSizer>
      </StyledTreeContainer>
    </>
  );
};

export default TableExploreTree;
