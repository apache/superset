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
import { CSSProperties, ReactNode, useCallback } from 'react';

import {
  css,
  styled,
  t,
  useCSSTextTruncation,
  useTheme,
} from '@superset-ui/core';

import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components/Tooltip';
import { Typography } from '@superset-ui/core/components';
import DatasourcePanelDragOption from './DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';
import { DndItemValue, FlattenedItem, Folder } from './types';

const LabelWrapper = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${theme.fontSizeSM}px;
    background-color: ${theme.colorBgTextActive};
    margin: ${theme.sizeUnit * 2}px 0;
    border-radius: ${theme.borderRadius}px;
    padding: 0 ${theme.sizeUnit}px;

    &:first-of-type {
      margin-top: 0;
    }
    &:last-of-type {
      margin-bottom: 0;
    }

    padding: 0;
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }

    & > span {
      white-space: nowrap;
    }

    .option-label {
      display: inline;
    }

    .metric-option {
      & > svg {
        min-width: ${theme.sizeUnit * 4}px;
      }
      & > .option-label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  `}
`;

const SectionHeaderButton = styled.button`
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding-inline: 0;
`;

const SectionHeaderTextContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const SectionHeader = styled(Typography.Text)`
  ${({ theme }) => css`
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 1.3;
    text-align: left;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  `}
`;

const Divider = styled.div`
  ${({ theme }) => css`
    height: 16px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

export interface DatasourcePanelItemProps {
  index: number;
  style: CSSProperties;
  data: {
    flattenedItems: FlattenedItem[];
    folderMap: Map<string, Folder>;
    width: number;
    onToggleCollapse: (folderId: string) => void;
    collapsedFolderIds: Set<string>;
  };
}

const DatasourcePanelItem = ({
  index,
  style,
  data,
}: DatasourcePanelItemProps) => {
  const {
    flattenedItems,
    folderMap,
    width,
    onToggleCollapse,
    collapsedFolderIds,
  } = data;
  const item = flattenedItems[index];
  const theme = useTheme();
  const [labelRef, labelIsTruncated] = useCSSTextTruncation<HTMLSpanElement>({
    isVertical: true,
    isHorizontal: false,
  });

  const getTooltipNode = useCallback(
    (folder: Folder) => {
      let tooltipNode: ReactNode | null = null;
      if (labelIsTruncated) {
        tooltipNode = (
          <div>
            <b>{t('Name')}:</b> {folder.name}
          </div>
        );
      }
      if (folder.description) {
        tooltipNode = (
          <div>
            {tooltipNode}
            <div
              css={
                tooltipNode &&
                css`
                  margin-top: ${theme.sizeUnit}px;
                `
              }
            >
              <b>{t('Description')}:</b> {folder.description}
            </div>
          </div>
        );
      }
      return tooltipNode;
    },
    [labelIsTruncated],
  );

  if (!item) return null;

  const folder = folderMap.get(item.folderId);
  if (!folder) return null;

  const indentation = item.depth * theme.sizeUnit * 4;

  return (
    <div
      style={{
        ...style,
        paddingLeft: theme.sizeUnit * 4 + indentation,
        paddingRight: theme.sizeUnit * 4,
      }}
    >
      {item.type === 'header' && (
        <SectionHeaderButton onClick={() => onToggleCollapse(folder.id)}>
          <Tooltip title={getTooltipNode(folder)}>
            <SectionHeaderTextContainer>
              <SectionHeader ref={labelRef}>{folder.name}</SectionHeader>
              {collapsedFolderIds.has(folder.id) ? (
                <Icons.DownOutlined iconSize="s" iconColor={theme.colorText} />
              ) : (
                <Icons.UpOutlined iconSize="s" iconColor={theme.colorText} />
              )}
            </SectionHeaderTextContainer>
          </Tooltip>
        </SectionHeaderButton>
      )}

      {item.type === 'subtitle' && (
        <div
          css={css`
            display: flex;
            gap: ${theme.sizeUnit * 2}px;
            justify-content: space-between;
            align-items: baseline;
          `}
        >
          <div
            className="field-length"
            css={css`
              flex-shrink: 0;
            `}
          >
            {t(`Showing %s of %s items`, item.showingItems, item.totalItems)}
          </div>
        </div>
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

      {item.type === 'divider' && (
        <Divider data-test="datasource-panel-divider" />
      )}
    </div>
  );
};

export default DatasourcePanelItem;
