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
import { CSSProperties, FC } from 'react';

import { css, Metric, styled, t, useTheme } from '@superset-ui/core';

import Icons from 'src/components/Icons';
import DatasourcePanelDragOption from './DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';
import { DndItemValue } from './types';

export type DataSourcePanelColumn = {
  is_dttm?: boolean | null;
  description?: string | null;
  expression?: string | null;
  is_certified?: number | null;
  column_name?: string | null;
  name?: string | null;
  type?: string;
};

type Props = {
  index: number;
  style: CSSProperties;
  data: {
    metricSlice: Metric[];
    columnSlice: DataSourcePanelColumn[];
    totalMetrics: number;
    totalColumns: number;
    width: number;
    showAllMetrics: boolean;
    onShowAllMetricsChange: (showAll: boolean) => void;
    showAllColumns: boolean;
    onShowAllColumnsChange: (showAll: boolean) => void;
    collapseMetrics: boolean;
    onCollapseMetricsChange: (collapse: boolean) => void;
    collapseColumns: boolean;
    onCollapseColumnsChange: (collapse: boolean) => void;
    hiddenMetricCount: number;
    hiddenColumnCount: number;
  };
};

export const DEFAULT_MAX_COLUMNS_LENGTH = 50;
export const DEFAULT_MAX_METRICS_LENGTH = 50;
export const ITEM_HEIGHT = 30;

const Button = styled.button`
  background: none;
  border: none;
  text-decoration: underline;
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const ButtonContainer = styled.div`
  text-align: center;
  padding-top: 2px;
`;

const LabelWrapper = styled.div`
  ${({ theme }) => css`
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${theme.typography.sizes.s}px;
    background-color: ${theme.colors.grayscale.light4};
    margin: ${theme.gridUnit * 2}px 0;
    border-radius: 4px;
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
  padding-inline: 0px;
`;

const SectionHeader = styled.span`
  ${({ theme }) => `
    font-size: ${theme.typography.sizes.m}px;
    line-height: 1.3;
  `}
`;

const Box = styled.div`
  ${({ theme }) => `
    border: 1px ${theme.colors.grayscale.light4} solid;
    border-radius: ${theme.gridUnit}px;
    font-size: ${theme.typography.sizes.s}px;
    padding: ${theme.gridUnit}px;
    color: ${theme.colors.grayscale.light1};
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  `}
`;

const DatasourcePanelItem: FC<Props> = ({ index, style, data }) => {
  const {
    metricSlice: _metricSlice,
    columnSlice,
    totalMetrics,
    totalColumns,
    width,
    showAllMetrics,
    onShowAllMetricsChange,
    showAllColumns,
    onShowAllColumnsChange,
    collapseMetrics,
    onCollapseMetricsChange,
    collapseColumns,
    onCollapseColumnsChange,
    hiddenMetricCount,
    hiddenColumnCount,
  } = data;
  const metricSlice = collapseMetrics ? [] : _metricSlice;

  const EXTRA_LINES = collapseMetrics ? 1 : 2;
  const isColumnSection = collapseMetrics
    ? index >= 1
    : index > metricSlice.length + EXTRA_LINES;
  const HEADER_LINE = isColumnSection
    ? metricSlice.length + EXTRA_LINES + 1
    : 0;
  const SUBTITLE_LINE = HEADER_LINE + 1;
  const BOTTOM_LINE =
    (isColumnSection ? columnSlice.length : metricSlice.length) +
    (collapseMetrics ? HEADER_LINE : SUBTITLE_LINE) +
    1;
  const collapsed = isColumnSection ? collapseColumns : collapseMetrics;
  const setCollapse = isColumnSection
    ? onCollapseColumnsChange
    : onCollapseMetricsChange;
  const showAll = isColumnSection ? showAllColumns : showAllMetrics;
  const setShowAll = isColumnSection
    ? onShowAllColumnsChange
    : onShowAllMetricsChange;
  const theme = useTheme();
  const hiddenCount = isColumnSection ? hiddenColumnCount : hiddenMetricCount;

  return (
    <div
      style={style}
      css={css`
        padding: 0 ${theme.gridUnit * 4}px;
      `}
    >
      {index === HEADER_LINE && (
        <SectionHeaderButton onClick={() => setCollapse(!collapsed)}>
          <SectionHeader>
            {isColumnSection ? t('Columns') : t('Metrics')}
          </SectionHeader>
          {collapsed ? (
            <Icons.DownOutlined iconSize="s" />
          ) : (
            <Icons.UpOutlined iconSize="s" />
          )}
        </SectionHeaderButton>
      )}
      {index === SUBTITLE_LINE && !collapsed && (
        <div
          css={css`
            display: flex;
            gap: ${theme.gridUnit * 2}px;
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
            {isColumnSection
              ? t(`Showing %s of %s`, columnSlice?.length, totalColumns)
              : t(`Showing %s of %s`, metricSlice?.length, totalMetrics)}
          </div>
          {hiddenCount > 0 && (
            <Box>{t(`%s ineligible item(s) are hidden`, hiddenCount)}</Box>
          )}
        </div>
      )}
      {index > SUBTITLE_LINE && index < BOTTOM_LINE && (
        <LabelWrapper
          key={
            (isColumnSection
              ? columnSlice[index - SUBTITLE_LINE - 1].column_name
              : metricSlice[index - SUBTITLE_LINE - 1].metric_name) +
            String(width)
          }
          className="column"
        >
          <DatasourcePanelDragOption
            value={
              isColumnSection
                ? (columnSlice[index - SUBTITLE_LINE - 1] as DndItemValue)
                : metricSlice[index - SUBTITLE_LINE - 1]
            }
            type={isColumnSection ? DndItemType.Column : DndItemType.Metric}
          />
        </LabelWrapper>
      )}
      {index === BOTTOM_LINE &&
        !collapsed &&
        (isColumnSection
          ? totalColumns > DEFAULT_MAX_COLUMNS_LENGTH
          : totalMetrics > DEFAULT_MAX_METRICS_LENGTH) && (
          <ButtonContainer>
            <Button onClick={() => setShowAll(!showAll)}>
              {showAll ? t('Show less...') : t('Show all...')}
            </Button>
          </ButtonContainer>
        )}
    </div>
  );
};

export default DatasourcePanelItem;
