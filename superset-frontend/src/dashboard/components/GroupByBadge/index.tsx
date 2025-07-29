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
import { Icons, Badge, Tooltip, Tag } from '@superset-ui/core/components';
import { ChartCustomizationItem } from '../nativeFilters/ChartCustomization/types';
import { RootState } from '../../types';

export interface GroupByBadgeProps {
  chartId: number;
}

const StyledTag = styled(Tag)`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    cursor: pointer;
    margin-right: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    background: ${theme.colors.grayscale.light4};
    border: 1px solid ${theme.colors.grayscale.light3};
    border-radius: 4px;
    height: 100%;

    .anticon {
      vertical-align: middle;
      color: ${theme.colors.grayscale.base};
      margin-right: ${theme.sizeUnit}px;
      &:hover {
        color: ${theme.colors.grayscale.light1};
      }
    }

    &:hover {
      background: ${theme.colors.grayscale.light3};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
    }
  `}
`;

const StyledBadge = styled(Badge)`
  ${({ theme }) => `
    margin-left: ${theme.sizeUnit}px;
    &>sup.ant-badge-count {
      padding: 0 ${theme.sizeUnit}px;
      min-width: ${theme.sizeUnit * 4}px;
      height: ${theme.sizeUnit * 4}px;
      line-height: 1.5;
      font-weight: ${theme.fontWeightStrong};
      font-size: ${theme.fontSizeSM - 1}px;
      box-shadow: none;
      padding: 0 ${theme.sizeUnit}px;
    }
  `}
`;

const TooltipContent = styled.div`
  ${({ theme }) => `
    min-width: 200px;
    max-width: 300px;
    overflow-x: hidden;
    color: ${theme.colors.grayscale.light5};
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
      const matchesDataset = chartDataset === targetDatasetId;

      const hasColumn = item.customization?.column;

      return matchesDataset && hasColumn;
    });
  }, [chartCustomizationItems, chartDataset]);

  const groupByCount = applicableGroupBys.length;

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
          {applicableGroupBys.map(groupBy => (
            <GroupByItem key={groupBy.id}>
              <div>
                {groupBy.customization?.name && groupBy.customization?.column
                  ? `${groupBy.customization.name}:${groupBy.customization.column}`
                  : groupBy.customization?.name || t('None')}
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
