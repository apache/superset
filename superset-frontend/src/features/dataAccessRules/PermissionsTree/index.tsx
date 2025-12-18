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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/ui';
import { Tree, Tooltip, Spin, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  DatabaseOutlined,
  FolderOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { TreeProps } from 'antd';
import type {
  PermissionNode,
  TreeState,
  PermissionsPayload,
} from './types';
import {
  fetchDatabases,
  fetchCatalogs,
  fetchSchemas,
  fetchTables,
  type DatabaseInfo,
} from './api';
import {
  makeKey,
  getEffectiveState,
  getExplicitState,
  cyclePermissionState,
  updateTreeData,
  generatePermissionsPayload,
  loadPermissionsFromPayload,
  countDescendantPermissions,
} from './utils';

const DEFAULT_PAGE_SIZE = 50;

const StyledContainer = styled.div`
  ${({ theme }) => css`
    .search-input {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .tree-container {
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      padding: ${theme.sizeUnit * 2}px;
      max-height: 500px;
      overflow: auto;
    }

    .ant-tree-title {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
    }

    .permission-icon {
      cursor: pointer;
      font-size: 16px;
    }

    .permission-icon-allow {
      color: ${theme.colorSuccess};
    }

    .permission-icon-deny {
      color: ${theme.colorError};
    }

    .permission-icon-inherit {
      color: ${theme.colorTextSecondary};
    }

    .node-title {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
    }

    .load-more-btn {
      margin-left: ${theme.sizeUnit * 3}px;
      font-size: 12px;
    }

    .node-count {
      font-size: 11px;
      color: ${theme.colorTextSecondary};
      margin-left: ${theme.sizeUnit}px;
    }
  `}
`;

export interface PermissionsTreeProps {
  value?: PermissionsPayload;
  onChange?: (payload: PermissionsPayload) => void;
  pageSize?: number;
}

function PermissionsTree({
  value,
  onChange,
  pageSize = DEFAULT_PAGE_SIZE,
}: PermissionsTreeProps) {
  const [treeState, setTreeState] = useState<TreeState>({
    expandedKeys: [],
    loadedKeys: [],
    treeData: [],
    permissionStates: {},
  });
  const [loading, setLoading] = useState(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);

  // Map of database ID -> name and name -> ID
  const databaseMaps = useMemo(() => {
    const idToName = new Map<number, string>();
    const nameToId = new Map<string, number>();
    databases.forEach(db => {
      idToName.set(db.id, db.database_name);
      nameToId.set(db.database_name, db.id);
    });
    return { idToName, nameToId };
  }, [databases]);

  // Track if we're in the middle of an internal update to avoid circular updates
  const isInternalUpdateRef = useRef(false);

  // Load initial databases
  useEffect(() => {
    loadDatabases();
  }, []);

  // Load initial value (only on mount or when value changes externally)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (value && databaseMaps.nameToId.size > 0) {
      const states = loadPermissionsFromPayload(value, databaseMaps.nameToId);
      setTreeState(prev => ({
        ...prev,
        permissionStates: states,
      }));
    }
  }, [value, databaseMaps.nameToId]);

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const dbs = await fetchDatabases();
      setDatabases(dbs);

      const treeData: PermissionNode[] = dbs.map(db => ({
        key: makeKey({ databaseId: db.id }),
        title: db.database_name,
        nodeType: 'database',
        databaseId: db.id,
        databaseName: db.database_name,
        children: [],
        isLeaf: false,
      }));

      setTreeState(prev => ({
        ...prev,
        treeData,
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = useCallback(
    async (node: PermissionNode): Promise<PermissionNode[]> => {
      const { databaseId, catalogName, schemaName, nodeType } = node;

      if (!databaseId) return [];

      // Database level -> load catalogs or schemas
      if (nodeType === 'database') {
        // First try to load catalogs
        try {
          const catalogs = await fetchCatalogs(databaseId, undefined, 0, 1);
          if (catalogs.result.length > 0) {
            // Database has catalogs
            const catalogsResult = await fetchCatalogs(
              databaseId,
              undefined,
              0,
              pageSize,
            );
            return catalogsResult.result.map(cat => ({
              key: makeKey({ databaseId, catalogName: cat }),
              title: cat,
              nodeType: 'catalog' as const,
              databaseId,
              databaseName: node.databaseName,
              catalogName: cat,
              children: [],
              isLeaf: false,
              hasMore: catalogsResult.count > pageSize,
              totalCount: catalogsResult.count,
            }));
          }
        } catch {
          // Database doesn't support catalogs, load schemas directly
        }

        // Load schemas directly
        const schemasResult = await fetchSchemas(
          databaseId,
          undefined,
          undefined,
          0,
          pageSize,
        );
        return schemasResult.result.map(schema => ({
          key: makeKey({ databaseId, schemaName: schema }),
          title: schema,
          nodeType: 'schema' as const,
          databaseId,
          databaseName: node.databaseName,
          schemaName: schema,
          children: [],
          isLeaf: false,
          hasMore: schemasResult.count > pageSize,
          totalCount: schemasResult.count,
        }));
      }

      // Catalog level -> load schemas
      if (nodeType === 'catalog' && catalogName) {
        const schemasResult = await fetchSchemas(
          databaseId,
          catalogName,
          undefined,
          0,
          pageSize,
        );
        return schemasResult.result.map(schema => ({
          key: makeKey({ databaseId, catalogName, schemaName: schema }),
          title: schema,
          nodeType: 'schema' as const,
          databaseId,
          databaseName: node.databaseName,
          catalogName,
          schemaName: schema,
          children: [],
          isLeaf: false,
          hasMore: schemasResult.count > pageSize,
          totalCount: schemasResult.count,
        }));
      }

      // Schema level -> load tables
      if (nodeType === 'schema' && schemaName) {
        const tablesResult = await fetchTables(
          databaseId,
          schemaName,
          catalogName,
          undefined,
          0,
          pageSize,
        );
        return tablesResult.result.map(table => ({
          key: makeKey({
            databaseId,
            catalogName,
            schemaName,
            tableName: table.value,
          }),
          title: table.value,
          nodeType: 'table' as const,
          databaseId,
          databaseName: node.databaseName,
          catalogName,
          schemaName,
          tableName: table.value,
          isLeaf: true,
        }));
      }

      return [];
    },
    [pageSize],
  );

  const onLoadData = async (node: PermissionNode): Promise<void> => {
    if (node.children && node.children.length > 0) {
      return;
    }

    const children = await loadChildren(node);
    const updatedTreeData = updateTreeData(
      treeState.treeData,
      node.key as string,
      children,
    );

    setTreeState(prev => ({
      ...prev,
      treeData: updatedTreeData,
      loadedKeys: [...prev.loadedKeys, node.key as string],
    }));
  };

  const onExpand: TreeProps['onExpand'] = expandedKeysValue => {
    setTreeState(prev => ({
      ...prev,
      expandedKeys: expandedKeysValue as string[],
    }));
  };

  const handlePermissionClick = (
    nodeKey: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    const newStates = cyclePermissionState(nodeKey, treeState.permissionStates);

    // Mark as internal update to prevent circular updates
    isInternalUpdateRef.current = true;

    setTreeState(prev => ({
      ...prev,
      permissionStates: newStates,
    }));

    // Notify parent of changes
    if (onChange && databaseMaps.idToName.size > 0) {
      const payload = generatePermissionsPayload(newStates, databaseMaps.idToName);
      onChange(payload);
    }
  };

  const getStateIcon = (nodeKey: string) => {
    const explicitState = getExplicitState(nodeKey, treeState.permissionStates);
    const effectiveState = getEffectiveState(
      nodeKey,
      treeState.permissionStates,
    );

    const getTooltipText = () => {
      if (explicitState === 'allow') return t('Allowed (click to deny)');
      if (explicitState === 'deny') return t('Denied (click to allow)');
      if (effectiveState === 'allow')
        return t('Inherits Allow (click to deny)');
      return t('Inherits Deny (click to allow)');
    };

    if (explicitState === 'allow') {
      return (
        <Tooltip title={getTooltipText()}>
          <CheckCircleOutlined
            className="permission-icon permission-icon-allow"
            onClick={e => handlePermissionClick(nodeKey, e)}
          />
        </Tooltip>
      );
    }
    if (explicitState === 'deny') {
      return (
        <Tooltip title={getTooltipText()}>
          <CloseCircleOutlined
            className="permission-icon permission-icon-deny"
            onClick={e => handlePermissionClick(nodeKey, e)}
          />
        </Tooltip>
      );
    }
    return (
      <Tooltip title={getTooltipText()}>
        <MinusCircleOutlined
          className="permission-icon permission-icon-inherit"
          onClick={e => handlePermissionClick(nodeKey, e)}
        />
      </Tooltip>
    );
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'database':
        return <DatabaseOutlined />;
      case 'catalog':
      case 'schema':
        return <FolderOutlined />;
      case 'table':
        return <TableOutlined />;
      default:
        return null;
    }
  };

  const titleRender = (node: PermissionNode) => {
    const nodeKey = node.key as string;
    const isExpanded = treeState.expandedKeys.includes(nodeKey);
    const isLeaf = node.isLeaf || node.nodeType === 'table';
    const title = node.title as string;

    // Count descendants with custom permissions when collapsed
    const counts =
      !isExpanded && !isLeaf
        ? countDescendantPermissions(nodeKey, treeState.permissionStates)
        : null;
    const hasCustomRules = counts && (counts.allowed > 0 || counts.denied > 0);

    return (
      <div className="node-title">
        {getStateIcon(nodeKey)}
        {getNodeIcon(node.nodeType)}
        <span>{title}</span>
        {hasCustomRules && (
          <span className="node-count">
            (
            <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
              {counts.allowed}
            </span>
            {' / '}
            <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
              {counts.denied}
            </span>
            )
          </span>
        )}
        {node.hasMore && node.totalCount && (
          <span className="node-count" style={{ marginLeft: 4 }}>
            [{node.children?.length || 0}/{node.totalCount}]
          </span>
        )}
      </div>
    );
  };

  const clearAll = () => {
    isInternalUpdateRef.current = true;
    setTreeState(prev => ({
      ...prev,
      permissionStates: {},
    }));
    if (onChange) {
      onChange({ allowed: [], denied: [] });
    }
  };

  return (
    <StyledContainer>
      <div style={{ marginBottom: 8 }}>
        <Button size="small" onClick={clearAll}>
          {t('Reset All')}
        </Button>
      </div>
      <Spin spinning={loading}>
        <div className="tree-container">
          <Tree
            loadData={onLoadData as TreeProps['loadData']}
            treeData={treeState.treeData}
            expandedKeys={treeState.expandedKeys}
            onExpand={onExpand}
            titleRender={titleRender as TreeProps['titleRender']}
            showLine={{ showLeafIcon: false }}
            blockNode
          />
        </div>
      </Spin>
    </StyledContainer>
  );
}

export default PermissionsTree;
