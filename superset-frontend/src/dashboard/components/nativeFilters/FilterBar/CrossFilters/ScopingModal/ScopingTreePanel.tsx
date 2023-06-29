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
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  css,
  isDefined,
  NativeFilterScope,
  styled,
  t,
  useTheme,
} from '@superset-ui/core';
import { Select } from 'src/components';
import { noOp } from 'src/utils/common';
import ScopingTree from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FilterScope/ScopingTree';
import {
  ChartConfiguration,
  DashboardLayout,
  isCrossFilterScopeGlobal,
  RootState,
} from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { SelectOptionsType } from 'src/components/Select/types';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import Alert from 'src/components/Alert';
import { NEW_CHART_SCOPING_ID } from './constants';

interface ScopingTreePanelProps {
  chartId: number | undefined;
  currentScope: NativeFilterScope;
  onScopeUpdate: ({ scope }: { scope: NativeFilterScope }) => void;
  onSelectChange: (chartId: number) => void;
  chartConfigs: ChartConfiguration;
}

const InfoText = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.base};
    margin-bottom: ${theme.gridUnit * 7}px;
  `}
`;

const ChartSelect = ({
  value,
  onSelectChange,
  chartConfigs,
}: {
  value: number | undefined;
  onSelectChange: (chartId: number) => void;
  chartConfigs: ChartConfiguration;
}) => {
  const theme = useTheme();
  const layout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const options: SelectOptionsType = useMemo(() => {
    const chartLayoutItems = Object.values(layout).filter(
      item => item.type === CHART_TYPE,
    );
    return Object.values(chartConfigs)
      .filter(
        chartConfig =>
          isCrossFilterScopeGlobal(chartConfig.crossFilters.scope) ||
          (chartConfig.id === value && value !== NEW_CHART_SCOPING_ID),
      )
      .map(chartConfig => {
        const chartLayoutItem = chartLayoutItems.find(
          item => item.meta.chartId === Number(chartConfig.id),
        );
        return {
          value: Number(chartConfig.id),
          label:
            chartLayoutItem?.meta.sliceNameOverride ||
            chartLayoutItem?.meta.sliceName ||
            '',
        };
      });
  }, [chartConfigs, layout, value]);

  return (
    <div
      css={css`
        margin-bottom: ${theme.gridUnit * 6}px;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          margin-bottom: ${theme.gridUnit}px;
        `}
      >
        <InfoText
          css={css`
            color: ${theme.colors.grayscale.dark1};
            margin-right: ${theme.gridUnit}px;
            margin-bottom: 0;
          `}
        >{`${t('Chart')} *`}</InfoText>
        <Tooltip title={t('Tooltip')} placement="top">
          <Icons.InfoCircleOutlined
            iconSize="xs"
            iconColor={theme.colors.grayscale.base}
            css={css`
              & > span {
                line-height: 0;
              }
            `}
          />
        </Tooltip>
      </div>
      <Select
        data-test="select-chart"
        ariaLabel={t('Select chart')}
        options={options}
        value={value && value === NEW_CHART_SCOPING_ID ? undefined : value}
        onChange={value => {
          onSelectChange(Number(value));
        }}
      />
    </div>
  );
};

export const ScopingTreePanel = ({
  onScopeUpdate,
  currentScope,
  chartId,
  onSelectChange,
  chartConfigs,
}: ScopingTreePanelProps) => {
  const theme = useTheme();
  const isCrossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );
  return (
    <div
      data-test="scoping-tree-panel"
      css={css`
        flex: 1;
      `}
    >
      {!isCrossFiltersEnabled && (
        <Alert
          message={
            <span
              css={css`
                font-weight: ${theme.typography.weights.bold};
              `}
            >
              {t('Cross-filtering is not enabled in this dashboard')}
            </span>
          }
          type="info"
          closable={false}
          css={css`
            margin-bottom: ${theme.gridUnit * 6}px;
          `}
        />
      )}
      {isDefined(chartId) && (
        <ChartSelect
          value={chartId}
          onSelectChange={onSelectChange}
          chartConfigs={chartConfigs}
        />
      )}
      <InfoText>
        {isDefined(chartId)
          ? t(
              `Select the charts to which you want to apply cross-filters when interacting with this chart. You can select "All charts" to apply filters to all charts that use the same dataset or contain the same column name in the dashboard.`,
            )
          : t(
              `Select the charts to which you want to apply cross-filters in this dashboard. Deselecting a chart will exclude it from being filtered when applying cross-filters from any chart on the dashboard. You can select "All charts" to apply cross-filters to all charts that use the same dataset or contain the same column name in the dashboard.`,
            )}
      </InfoText>
      <ScopingTree
        updateFormValues={onScopeUpdate}
        initialScope={currentScope}
        forceUpdate={noOp}
        chartId={chartId}
        title={t('All charts')}
      />
    </div>
  );
};
