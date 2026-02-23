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
import { css, styled, t } from '@apache-superset/core';
import type { NodeRendererProps } from 'react-arborist';
import { Icons, Tooltip, Typography } from '@superset-ui/core/components';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import ColumnElement from 'src/SqlLab/components/ColumnElement';
import IconButton from 'src/dashboard/components/IconButton';
import type { TreeNodeData, FetchLazyTablesParams } from './types';

const StyledColumnNode = styled.div`
  & > .ant-flex {
    flex: 1;
    margin-right: ${({ theme }) => theme.sizeUnit * 1.5}px;
    cursor: default;
  }
`;

const getOpacity = (disableCheckbox: boolean | undefined) =>
  disableCheckbox ? 0.6 : 1;

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

export interface TreeNodeRendererProps extends NodeRendererProps<TreeNodeData> {
  manuallyOpenedNodes: Record<string, boolean>;
  loadingNodes: Record<string, boolean>;
  searchTerm: string;
  catalog: string | null | undefined;
  fetchLazyTables: (params: FetchLazyTablesParams) => void;
  handlePinTable: (
    tableName: string,
    schemaName: string,
    catalogName: string | null,
  ) => void;
}

const TreeNodeRenderer: React.FC<TreeNodeRendererProps> = ({
  node,
  style,
  manuallyOpenedNodes,
  loadingNodes,
  searchTerm,
  catalog,
  fetchLazyTables,
  handlePinTable,
}) => {
  const { data } = node;
  const parts = data.id.split(':');
  const [identifier, dbId, schema, tableName] = parts;

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
      <span
        className="tree-node-icon"
        css={css`
          opacity: ${getOpacity(data.disableCheckbox)};
        `}
      >
        {renderIcon()}
      </span>
      <Typography.Text
        className="tree-node-title"
        css={css`
          opacity: ${getOpacity(data.disableCheckbox)};
        `}
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
                dbId,
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
                <Icons.PushpinOutlined iconSize="xl" />
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
};

export default TreeNodeRenderer;
