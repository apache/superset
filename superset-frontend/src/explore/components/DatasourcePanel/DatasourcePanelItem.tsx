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
import { CSSProperties } from 'react';

import { css, styled, useTheme } from '@superset-ui/core';

import { Icons } from 'src/components/Icons';
import DatasourcePanelDragOption from './DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';
import { DndItemValue, FlattenedItem, Folder } from './types';

const LabelWrapper = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${theme.typography.sizes.s}px;
    background-color: ${theme.colors.grayscale.light4};
    margin: ${theme.gridUnit * 2}px 0;
    border-radius: ${theme.borderRadius}px;
    padding: 0 ${theme.gridUnit}px;

    &:first-of-type {
      margin-top: 0;
    }
    &:last-of-type {
      margin-bottom: 0;
    }

    padding: 0;
    cursor: pointer;
    &:hover {
      background-color: ${theme.colors.grayscale.light3};
    }

    & > span {
      white-space: nowrap;
    }

    .option-label {
      display: inline;
    }

    .metric-option {
      & > svg {
        min-width: ${theme.gridUnit * 4}px;
      }
      & > .option-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `}
`;

const SectionHeaderButton = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding-inline: 0;
`;

const SectionHeader = styled.span`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.m}px;
    font-weight: ${theme.typography.weights.medium};
    line-height: 1.3;
  `}
`;

const Divider = styled.div`
  ${({ theme }) => css`
    height: 16px;
    border-bottom: 1px solid ${theme.colors.grayscale.light3};
  `}
`;

interface DatasourcePanelItemProps {
  index: number;
  style: CSSProperties;
  data: {
    flattenedItems: FlattenedItem[];
    folderMap: Map<string, Folder>;
    width: number;
    onToggleCollapse: (folderId: string) => void;
  };
}

const DatasourcePanelItem = ({
  index,
  style,
  data,
}: DatasourcePanelItemProps) => {
  const { flattenedItems, folderMap, width, onToggleCollapse } = data;
  const item = flattenedItems[index];
  const theme = useTheme();

  if (!item) return null;

  const folder = folderMap.get(item.folderId);
  if (!folder) return null;

  const indentation = item.depth * theme.gridUnit * 4;

  return (
    <div
      style={{
        ...style,
        paddingLeft: theme.gridUnit * 4 + indentation,
        paddingRight: theme.gridUnit * 4,
      }}
    >
      {item.type === 'header' && (
        <SectionHeaderButton onClick={() => onToggleCollapse(folder.id)}>
          <SectionHeader>{folder.name}</SectionHeader>
          {folder.isCollapsed ? (
            <Icons.DownOutlined iconSize="s" />
          ) : (
            <Icons.UpOutlined iconSize="s" />
          )}
        </SectionHeaderButton>
      )}

      {item.type === 'item' && item.item && (
        <LabelWrapper
          key={
            (item.item.type === 'column'
              ? item.item.column_name
              : item.item.metric_name) + String(width)
          }
          className="column"
        >
          <DatasourcePanelDragOption
            value={item.item as DndItemValue}
            type={
              item.item.type === 'column'
                ? DndItemType.Column
                : DndItemType.Metric
            }
          />
        </LabelWrapper>
      )}

      {item.type === 'divider' && <Divider />}
    </div>
  );
};

export default DatasourcePanelItem;
