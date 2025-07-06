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
import { styled, t } from '@superset-ui/core';
import { Icons, Badge, Tooltip } from '@superset-ui/core/components';
import { ChartCustomizationItem } from '../nativeFilters/ChartCustomization/types';
import { RootState } from '../../types';

export interface GroupByBadgeProps {
  chartId: number;
}

const StyledGroupByCount = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-items: center;
    align-items: center;
    cursor: pointer;
    margin-right: ${theme.sizeUnit}px;
    padding-left: ${theme.sizeUnit * 2}px;
    padding-right: ${theme.sizeUnit * 2}px;
    background: ${theme.colors.grayscale.light4};
    border-radius: 4px;
    height: 100%;
    .anticon {
      vertical-align: middle;
      color: ${theme.colors.primary.base};
      &:hover {
        color: ${theme.colors.primary.dark1};
      }
    }
    &:focus-visible {
      outline: 2px solid ${theme.colors.primary.dark2};
    }
  `}
`;

const StyledBadge = styled(Badge)`
  ${({ theme }) => `
    margin-left: ${theme.sizeUnit * 2}px;
    &>sup.antd5-badge-count {
      padding: 0 ${theme.sizeUnit}px;
      min-width: ${theme.sizeUnit * 4}px;
      height: ${theme.sizeUnit * 4}px;
      line-height: 1.5;
      font-weight: 500;
      font-size: ${theme.fontSizeSM - 1}px;
      box-shadow: none;
      padding: 0 ${theme.sizeUnit}px;
      background-color: ${theme.colors.primary.base};
    }
  `}
`;

const TooltipContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px;
    max-width: 300px;
  `}
`;

const GroupByInfo = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 2}px;

    &:last-child {
      margin-bottom: 0;
    }
  `}
`;

const GroupByLabel = styled.div`
  ${({ theme }) => `
    font-weight: 600;
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

export const GroupByBadge = ({ chartId }: GroupByBadgeProps) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const chartCustomizationItems = useSelector<
    RootState,
    ChartCustomizationItem[]
  >(
    ({ dashboardInfo }) =>
      dashboardInfo.metadata?.chart_customization_config || [],
  );

  const chartDataset = useSelector<RootState, string | null>(state => {
    const chart = state.charts[chartId];
    if (!chart?.latestQueryFormData?.datasource) {
      return null;
    }
    const chartDatasetParts = String(
      chart.latestQueryFormData.datasource,
    ).split('__');
    return chartDatasetParts[0];
  });

  const applicableGroupBys = useMemo(() => {
    if (!chartDataset) {
      return [];
    }

    return chartCustomizationItems.filter(item => {
      if (item.removed) return false;

      const targetDataset = item.customization?.dataset;
      if (!targetDataset) return false;

      const targetDatasetId = String(targetDataset);
      return chartDataset === targetDatasetId;
    });
  }, [chartCustomizationItems, chartDataset]);

  const groupByCount = applicableGroupBys.length;

  if (groupByCount === 0) {
    return null;
  }
  const tooltipContent = (
    <TooltipContent>
      <h4>{t('Chart Customization')}</h4>
      {applicableGroupBys.map(groupBy => (
        <GroupByInfo key={groupBy.id}>
          <div>
            {t('Grouped by: %s', groupBy.customization?.name || t('None'))}
          </div>
          {groupBy.description && <div>{groupBy.description}</div>}
        </GroupByInfo>
      ))}
    </TooltipContent>
  );

  return (
    <Tooltip
      title={tooltipContent}
      visible={tooltipVisible}
      onVisibleChange={setTooltipVisible}
      placement="bottom"
    >
      <StyledGroupByCount
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
      </StyledGroupByCount>
    </Tooltip>
  );
};

export default memo(GroupByBadge);
