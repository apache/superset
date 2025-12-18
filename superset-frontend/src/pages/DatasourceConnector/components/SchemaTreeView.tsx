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
import { useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Tree } from 'antd';
import type { DataNode as TreeDataNode } from 'antd/es/tree';
import { Flex, Icons, Typography } from '@superset-ui/core/components';
import type { AnalyzedTable, SchemaSelection } from '../types';

interface SchemaTreeViewProps {
  tables: AnalyzedTable[];
  selection: SchemaSelection;
  onSelectionChange: (selection: SchemaSelection) => void;
  schemaName: string | null;
}

const TreeContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    overflow: hidden;

    .ant-tree {
      background: transparent;
      padding: ${theme.paddingSM}px;
    }

    .ant-tree-treenode {
      padding: ${theme.paddingXXS}px 0;
    }

    .ant-tree-node-content-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
    }

    .ant-tree-title {
      display: flex;
      align-items: center;
      gap: ${theme.marginXS}px;
      width: 100%;
    }
  `}
`;

const HeaderContainer = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingSM}px ${theme.paddingMD}px;
    border-bottom: 1px solid ${theme.colorBorder};
    background-color: ${theme.colorBgLayout};
  `}
`;

const TableIcon = styled.span`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    color: ${theme.colorPrimary};
  `}
`;

const KeyIcon = styled.span`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    color: ${theme.colorError};
  `}
`;

const ColumnIcon = styled.span`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    color: ${theme.colorTextSecondary};
  `}
`;

const ColumnType = styled(Typography.Text)`
  ${({ theme }) => `
    margin-left: auto;
    padding-left: ${theme.paddingMD}px;
    font-family: monospace;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const TreeNodeTitle = styled(Flex)`
  width: 100%;
`;

export default function SchemaTreeView({
  tables,
  selection,
  onSelectionChange,
  schemaName,
}: SchemaTreeViewProps) {
  const theme = useTheme();
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  const treeData: TreeDataNode[] = useMemo(
    () =>
      tables.map(table => ({
        key: `table-${table.id}`,
        title: (
          <TreeNodeTitle align="center" gap={4}>
            <TableIcon>
              <Icons.TableOutlined iconSize="s" />
            </TableIcon>
            <Typography.Text strong>{table.name}</Typography.Text>
          </TreeNodeTitle>
        ),
        children: table.columns.map(column => ({
          key: `column-${table.id}-${column.id}`,
          title: (
            <TreeNodeTitle align="center" justify="space-between">
              <Flex align="center" gap={4}>
                {column.is_primary_key || column.is_foreign_key ? (
                  <KeyIcon>
                    <Icons.KeyOutlined iconSize="s" />
                  </KeyIcon>
                ) : (
                  <ColumnIcon>
                    <Icons.FieldNumberOutlined iconSize="s" />
                  </ColumnIcon>
                )}
                <Typography.Text>{column.name}</Typography.Text>
              </Flex>
              <ColumnType type="secondary">({column.type})</ColumnType>
            </TreeNodeTitle>
          ),
          isLeaf: true,
        })),
      })),
    [tables],
  );

  const handleSelect = (
    _selectedKeys: React.Key[],
    info: { node: TreeDataNode },
  ) => {
    const key = String(info.node.key);

    if (key.startsWith('table-')) {
      const tableId = parseInt(key.replace('table-', ''), 10);
      const table = tables.find(t => t.id === tableId);
      if (table) {
        onSelectionChange({ type: 'table', table });
      }
    } else if (key.startsWith('column-')) {
      // Format: column-{tableId}-{columnId}
      const parts = key.split('-');
      const tableId = parseInt(parts[1], 10);
      const columnId = parseInt(parts[2], 10);
      const table = tables.find(t => t.id === tableId);
      const column = table?.columns.find(c => c.id === columnId);
      if (table && column) {
        onSelectionChange({ type: 'column', column, table });
      }
    }
  };

  // Compute selected key from selection
  const selectedKeys = useMemo(() => {
    if (!selection) return [];
    if (selection.type === 'table') {
      return [`table-${selection.table.id}`];
    }
    return [`column-${selection.table.id}-${selection.column.id}`];
  }, [selection]);

  // Collapse by default on first render to reduce vertical space.
  // Users can expand as needed.
  const initialExpandedKeys =
    autoCollapsed && expandedKeys.length === 0
      ? []
      : expandedKeys.length > 0
        ? expandedKeys
        : tables.map(table => `table-${table.id}`);

  // Once we compute collapsed state the first time, avoid reapplying.
  useMemo(() => {
    if (!autoCollapsed) {
      setExpandedKeys([]);
      setAutoCollapsed(true);
    }
  }, [autoCollapsed]);

  return (
    <TreeContainer>
      <HeaderContainer align="center" gap={8}>
        <Icons.DatabaseOutlined iconSize="s" iconColor={theme.colorPrimary} />
        <Typography.Text strong>{t('Database Schema')}</Typography.Text>
      </HeaderContainer>
      {schemaName && (
        <Flex
          align="center"
          gap={4}
          css={{
            padding: `${theme.paddingXS}px ${theme.paddingMD}px`,
            borderBottom: `1px solid ${theme.colorBorderSecondary}`,
          }}
        >
          <Typography.Text type="secondary">
            {t('Connected to:')}
          </Typography.Text>
          <Typography.Text
            css={{
              color: theme.colorPrimary,
              fontWeight: theme.fontWeightStrong,
            }}
          >
            {schemaName}
          </Typography.Text>
        </Flex>
      )}
      <Tree
        treeData={treeData}
        selectedKeys={selectedKeys}
        expandedKeys={initialExpandedKeys}
        onExpand={keys => setExpandedKeys(keys)}
        onSelect={handleSelect}
        showIcon={false}
        blockNode
      />
    </TreeContainer>
  );
}
