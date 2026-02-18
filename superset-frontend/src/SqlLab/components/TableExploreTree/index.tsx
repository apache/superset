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
  useState,
  useRef,
  type ChangeEvent,
  useMemo,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { styled, css, t, useTheme } from '@apache-superset/core';
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
import { addTable } from 'src/SqlLab/actions/sqlLab';
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

const ROW_HEIGHT = 28;

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
    'schema',
    'catalog',
  ]);
  const { dbId, catalog, schema: selectedSchema } = queryEditor;
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

  // Tree data hook - manages schema/table/column data fetching and tree structure
  const {
    treeData,
    isFetching,
    refetch,
    loadingNodes,
    handleToggle,
    fetchLazyTables,
    errorPayload,
  } = useTreeData({
    dbId,
    catalog,
    selectedSchema,
    pinnedTables,
  });

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

  // Node renderer for react-arborist
  const renderNode = useCallback(
    (props: Parameters<typeof TreeNodeRenderer>[0]) => (
      <TreeNodeRenderer
        {...props}
        manuallyOpenedNodes={manuallyOpenedNodes}
        loadingNodes={loadingNodes}
        searchTerm={searchTerm}
        catalog={catalog}
        fetchLazyTables={fetchLazyTables}
        handlePinTable={handlePinTable}
      />
    ),
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
