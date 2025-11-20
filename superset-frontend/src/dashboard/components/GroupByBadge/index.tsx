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
import { memo, useMemo, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Icons, Badge, Tooltip, Tag } from '@superset-ui/core/components';
import { getFilterValueForDisplay } from '../nativeFilters/utils';
import { ChartCustomizationItem } from '../nativeFilters/ChartCustomization/types';
import { RootState } from '../../types';
import { isChartWithoutGroupBy } from '../../util/charts/chartTypeLimitations';

const makeSelectChartDataset = (chartId: number) =>
  createSelector(
    (state: RootState) => state.charts[chartId]?.latestQueryFormData,
    latestQueryFormData => {
      if (!latestQueryFormData?.datasource) {
        return null;
      }
      const chartDatasetParts = String(latestQueryFormData.datasource).split(
        '__',
      );
      return chartDatasetParts[0];
    },
  );

const makeSelectChartFormData = (chartId: number) =>
  createSelector(
    (state: RootState) => state.charts[chartId]?.latestQueryFormData,
    latestQueryFormData => latestQueryFormData,
  );

export interface GroupByBadgeProps {
  chartId: number;
}

const StyledTag = styled(Tag)`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    cursor: pointer;
    margin-left: ${theme.sizeUnit * 2}px;
    margin-right: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit * 0.5}px ${theme.sizeUnit}px;
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    height: auto;
    min-height: 20px;

    .anticon {
      vertical-align: middle;
      color: ${theme.colorTextSecondary};
      margin-right: ${theme.sizeUnit * 0.5}px;
      font-size: 12px;
      &:hover {
        color: ${theme.colorText};
      }
    }

    &:hover {
      background: ${theme.colorBgTextHover};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
    }
  `}
`;

const StyledBadge = styled(Badge)`
  ${({ theme }) => `
    margin-left: ${theme.sizeUnit * 0.5}px;
    &>sup.ant-badge-count {
      padding: 0 ${theme.sizeUnit * 0.5}px;
      min-width: ${theme.sizeUnit * 3}px;
      height: ${theme.sizeUnit * 3}px;
      line-height: 1.2;
      font-weight: ${theme.fontWeightStrong};
      font-size: ${theme.fontSizeSM - 2}px;
      box-shadow: none;
    }
  `}
`;

const TooltipContent = styled.div`
  ${({ theme }) => `
    min-width: 200px;
    max-width: 300px;
    overflow-x: hidden;
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const SectionName = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const GroupByInfo = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit}px;
    &:not(:last-child) {
      padding-bottom: ${theme.sizeUnit * 3}px;
    }
  `}
`;

const GroupByItem = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    margin-bottom: ${theme.sizeUnit}px;

    &:last-child {
      margin-bottom: 0;
    }
  `}
`;

const GroupByName = styled.span`
  ${({ theme }) => `
    padding-right: ${theme.sizeUnit}px;
    font-style: italic;
  `}
`;

const GroupByValue = styled.span`
  max-width: 100%;
  flex-grow: 1;
  overflow: auto;
`;

export const GroupByBadge = ({ chartId }: GroupByBadgeProps) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const chartCustomizationItems = useSelector<
    RootState,
    ChartCustomizationItem[]
  >(
    ({ dashboardInfo }) =>
      dashboardInfo.metadata?.chart_customization_config || [],
  );

  // Use memoized selectors for chart data
  const selectChartDataset = useMemo(
    () => makeSelectChartDataset(chartId),
    [chartId],
  );
  const selectChartFormData = useMemo(
    () => makeSelectChartFormData(chartId),
    [chartId],
  );

  const chartDataset = useSelector(selectChartDataset);
  const chartFormData = useSelector(selectChartFormData);
  const chartType = chartFormData?.viz_type;

  const applicableGroupBys = useMemo(() => {
    if (!chartDataset) {
      return [];
    }

    return chartCustomizationItems.filter(item => {
      if (item.removed) return false;

      const targetDataset = item.customization?.dataset;
      if (!targetDataset) return false;

      const targetDatasetId = String(targetDataset);
      const matchesDataset = chartDataset === targetDatasetId;

      const hasColumn = item.customization?.column;

      return matchesDataset && hasColumn;
    });
  }, [chartCustomizationItems, chartDataset]);

  const effectiveGroupBys = useMemo(() => {
    if (!chartType || applicableGroupBys.length === 0) {
      return [];
    }

    if (isChartWithoutGroupBy(chartType)) {
      return [];
    }

    if (!chartFormData) {
      return applicableGroupBys;
    }

    const existingColumns = new Set<string>();

    const extractColumnNames = (columns: unknown[]): void => {
      if (Array.isArray(columns)) {
        columns.forEach((col: unknown) => {
          if (typeof col === 'string') {
            existingColumns.add(col);
          } else if (col && typeof col === 'object' && 'column_name' in col) {
            existingColumns.add((col as { column_name: string }).column_name);
          }
        });
      }
    };

    const existingGroupBy = Array.isArray(chartFormData.groupby)
      ? chartFormData.groupby
      : chartFormData.groupby
        ? [chartFormData.groupby]
        : [];
    existingGroupBy.forEach((col: string) => existingColumns.add(col));

    if (chartFormData.x_axis) {
      existingColumns.add(chartFormData.x_axis);
    }

    const metrics = chartFormData.metrics || [];
    metrics.forEach((metric: any) => {
      if (typeof metric === 'string') {
        existingColumns.add(metric);
      } else if (metric && typeof metric === 'object' && 'column' in metric) {
        const metricColumn = metric.column;
        if (typeof metricColumn === 'string') {
          existingColumns.add(metricColumn);
        } else if (
          metricColumn &&
          typeof metricColumn === 'object' &&
          'column_name' in metricColumn
        ) {
          existingColumns.add(metricColumn.column_name);
        }
      }
    });

    if (chartFormData.series) {
      existingColumns.add(chartFormData.series);
    }
    if (chartFormData.entity) {
      existingColumns.add(chartFormData.entity);
    }
    if (chartFormData.source) {
      existingColumns.add(chartFormData.source);
    }
    if (chartFormData.target) {
      existingColumns.add(chartFormData.target);
    }

    if (chartType === 'pivot_table_v2') {
      extractColumnNames(chartFormData.groupbyColumns || []);
    }

    if (chartType === 'box_plot') {
      extractColumnNames(chartFormData.columns || []);
    }

    return applicableGroupBys.filter(item => {
      if (!item.customization?.column) return false;

      let columnNames: string[] = [];
      if (typeof item.customization.column === 'string') {
        columnNames = [item.customization.column];
      } else if (Array.isArray(item.customization.column)) {
        columnNames = item.customization.column.filter(
          col => typeof col === 'string' && col.trim() !== '',
        );
      } else if (
        typeof item.customization.column === 'object' &&
        item.customization.column !== null
      ) {
        const columnObj = item.customization.column as any;
        const columnName =
          columnObj.column_name || columnObj.name || String(columnObj);
        if (columnName && columnName.trim() !== '') {
          columnNames = [columnName];
        }
      }

      return columnNames.length > 0;
    });
  }, [applicableGroupBys, chartType, chartFormData]);

  const groupByCount = effectiveGroupBys.length;

  if (groupByCount === 0) {
    return null;
  }
  const tooltipContent = (
    <TooltipContent>
      <div>
        <SectionName>
          {t('Chart Customization (%d)', applicableGroupBys.length)}
        </SectionName>
        <GroupByInfo>
          {effectiveGroupBys.map(groupBy => (
            <GroupByItem key={groupBy.id}>
              <div>
                {groupBy.customization?.name &&
                groupBy.customization?.column ? (
                  <>
                    <GroupByName>{groupBy.customization.name}: </GroupByName>
                    <GroupByValue>
                      {getFilterValueForDisplay(groupBy.customization.column)}
                    </GroupByValue>
                  </>
                ) : (
                  groupBy.customization?.name || t('None')
                )}
              </div>
            </GroupByItem>
          ))}
        </GroupByInfo>
      </div>
    </TooltipContent>
  );

  return (
    <Tooltip
      title={tooltipContent}
      visible={tooltipVisible}
      onVisibleChange={setTooltipVisible}
      placement="bottom"
      overlayStyle={{
        color: theme.colorText,
        backgroundColor: theme.colorBgContainer,
        border: `1px solid ${theme.colorBorder}`,
        boxShadow: theme.boxShadow,
      }}
      overlayInnerStyle={{
        color: theme.colorText,
        backgroundColor: theme.colorBgContainer,
      }}
    >
      <StyledTag
        ref={triggerRef}
        aria-label={t('Group by settings (%s)', groupByCount)}
        role="button"
        tabIndex={0}
      >
        <Icons.GroupOutlined iconSize="m" />
        <StyledBadge
          data-test="applied-groupby-count"
          count={groupByCount}
          showZero={false}
        />
      </StyledTag>
    </Tooltip>
  );
};

export default memo(GroupByBadge);
