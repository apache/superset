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
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { NodeRendererProps } from 'react-arborist';
import { Icons, Typography } from '@superset-ui/core/components';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import ColumnElement from 'src/SqlLab/components/ColumnElement';
import { ActionButton } from '@superset-ui/core/components/ActionButton';
import copyTextToClipboard from 'src/utils/copy';
import type { TreeNodeData } from './types';

const StyledColumnNode = styled.div`
  & > .ant-flex {
    flex: 1;
    margin-right: ${({ theme }) => theme.sizeUnit * 4}px;
    cursor: default;
  }

  .col-copy-action {
    opacity: 0;
    flex-shrink: 0;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
  }

  &:hover .col-copy-action {
    opacity: 1;
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
  pinnedTableKeys: Set<string>;
  selectStarMap: Record<string, string>;
  handleRefreshTables: (params: {
    dbId: number;
    catalog: string | null | undefined;
    schema: string;
  }) => void;
  handlePinTable: (
    tableName: string,
    schemaName: string,
    catalogName: string | null,
  ) => void;
  handleUnpinTable: (tableName: string, schemaName: string) => void;
}

const TreeNodeRenderer: React.FC<TreeNodeRendererProps> = ({
  node,
  style,
  manuallyOpenedNodes,
  loadingNodes,
  searchTerm,
  catalog,
  pinnedTableKeys,
  selectStarMap,
  handleRefreshTables,
  handlePinTable,
  handleUnpinTable,
}) => {
  const theme = useTheme();
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
        data.tableType === 'view'
          ? Icons.FunctionOutlined
          : Icons.TableOutlined;
      if (isLoading) {
        return (
          <>
            <Icons.LoadingOutlined iconSize="l" />
            <TableTypeIcon iconSize="l" />
          </>
        );
      }
      return <TableTypeIcon iconSize="l" />;
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
        <ColumnElement
          column={data.columnData}
          actions={
            <span
              className="col-copy-action"
              onClick={e => e.stopPropagation()}
            >
              <ActionButton
                label={`copy-col-${data.name}`}
                tooltip={t('Copy column name')}
                icon={<Icons.CopyOutlined iconSize="m" />}
                onClick={() =>
                  copyTextToClipboard(() => Promise.resolve(data.name))
                }
              />
            </span>
          }
        />
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
              handleRefreshTables({
                dbId: Number(_dbId),
                catalog,
                schema,
              });
            }}
            tooltipContent={t('Force refresh table list')}
          />
        </div>
      )}
      {identifier === 'table' &&
        (() => {
          const nodeDbId = Number(_dbId);
          const tableKey = `${nodeDbId}:${schema}:${tableName}`;
          const isPinned = pinnedTableKeys.has(tableKey);
          const selectStar = selectStarMap[tableKey];
          return (
            <div
              className="side-action-container"
              role="menu"
              onClick={e => e.stopPropagation()}
            >
              {isPinned && (
                <div className="action-static">
                  <ActionButton
                    label={`pinned-${schema}-${tableName}`}
                    icon={
                      <Icons.PushpinFilled
                        iconSize="m"
                        css={css`
                          color: ${theme.colorTextDescription};
                        `}
                      />
                    }
                    onClick={() => handleUnpinTable(tableName, schema)}
                  />
                </div>
              )}
              <div className="action-hover">
                {selectStar && (
                  <ActionButton
                    label={`copy-select-${schema}-${tableName}`}
                    tooltip={t('Copy SELECT statement to the clipboard')}
                    icon={<Icons.CopyOutlined iconSize="m" />}
                    onClick={() =>
                      copyTextToClipboard(() => Promise.resolve(selectStar))
                    }
                  />
                )}
                <ActionButton
                  label={
                    isPinned
                      ? `unpin-${schema}-${tableName}`
                      : `pin-${schema}-${tableName}`
                  }
                  tooltip={
                    isPinned
                      ? t('Unpin from the result panel')
                      : t('Pin to the result panel')
                  }
                  icon={
                    isPinned ? (
                      <Icons.PushpinFilled iconSize="m" />
                    ) : (
                      <Icons.PushpinOutlined iconSize="m" />
                    )
                  }
                  onClick={() =>
                    isPinned
                      ? handleUnpinTable(tableName, schema)
                      : handlePinTable(tableName, schema, catalog ?? null)
                  }
                />
              </div>
              <ActionButton
                label={`toggle-${schema}-${tableName}`}
                icon={
                  isManuallyOpen ? (
                    <Icons.UpOutlined iconSize="m" />
                  ) : (
                    <Icons.DownOutlined iconSize="m" />
                  )
                }
                onClick={() => node.toggle()}
              />
            </div>
          );
        })()}
    </div>
  );
};

export default TreeNodeRenderer;
