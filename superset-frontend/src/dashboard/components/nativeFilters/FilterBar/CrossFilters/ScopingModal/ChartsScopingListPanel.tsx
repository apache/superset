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

import { ReactNode, useMemo } from 'react';
import { css, styled, t, useTheme } from '@superset-ui/core';
import {
  ChartConfiguration,
  DashboardLayout,
  isCrossFilterScopeGlobal,
  RootState,
} from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { FilterTitle } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FilterTitleContainer';
import { NEW_CHART_SCOPING_ID } from './constants';

const AddButtonContainer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit * 2}px;

    & button > [role='img']:first-of-type {
      margin-right: ${theme.gridUnit}px;
      line-height: 0;
    }

    span[role='img'] {
      padding-bottom: 1px;
    }

    .ant-btn > .anticon + span {
      margin-left: 0;
    }
  `}
`;

const ScopingTitle = ({
  isActive,
  onClick,
  id,
  label,
  onRemove,
}: {
  isActive: boolean;
  onClick: (id: number) => void;
  id: number;
  label: ReactNode;
  onRemove: (id: number) => void;
}) => {
  const theme = useTheme();
  return (
    <FilterTitle
      className={isActive ? 'active' : ''}
      onClick={() => onClick(id)}
    >
      {label}
      <Icons.Trash
        iconColor={theme.colors.grayscale.light3}
        onClick={event => {
          event.stopPropagation();
          onRemove(id);
        }}
        css={css`
          margin-left: auto;
        `}
      />
    </FilterTitle>
  );
};

export interface ChartsScopingListPanelProps {
  activeChartId: number | undefined;
  chartConfigs: ChartConfiguration;
  setCurrentChartId: (chartId: number | undefined) => void;
  removeCustomScope: (chartId: number) => void;
  addNewCustomScope: () => void;
}
export const ChartsScopingListPanel = ({
  activeChartId,
  chartConfigs,
  setCurrentChartId,
  removeCustomScope,
  addNewCustomScope,
}: ChartsScopingListPanelProps) => {
  const theme = useTheme();
  const layout = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const customScopedCharts = useMemo(() => {
    const chartLayoutItems = Object.values(layout).filter(
      item => item.type === CHART_TYPE,
    );
    return Object.values(chartConfigs)
      .filter(
        config =>
          !isCrossFilterScopeGlobal(config.crossFilters.scope) &&
          config.id !== NEW_CHART_SCOPING_ID,
      )
      .map(config => {
        const chartLayoutItem = chartLayoutItems.find(
          item => item.meta.chartId === config.id,
        );
        return {
          id: config.id,
          label:
            chartLayoutItem?.meta.sliceNameOverride ||
            chartLayoutItem?.meta.sliceName ||
            '',
        };
      });
  }, [chartConfigs, layout]);

  const newScoping = chartConfigs[NEW_CHART_SCOPING_ID];
  return (
    <>
      <AddButtonContainer>
        <Button
          buttonStyle="link"
          buttonSize="xsmall"
          onClick={addNewCustomScope}
        >
          <Icons.PlusSmall /> {t('Add custom scoping')}
        </Button>
      </AddButtonContainer>
      <FilterTitle
        role="button"
        onClick={() => setCurrentChartId(undefined)}
        className={activeChartId === undefined ? 'active' : ''}
      >
        {t('All charts/global scoping')}
      </FilterTitle>
      <div
        css={css`
          width: 100%;
          height: 1px;
          background-color: ${theme.colors.grayscale.light3};
          margin: ${theme.gridUnit * 3}px 0;
        `}
      />
      {customScopedCharts.map(chartInfo => (
        <ScopingTitle
          key={chartInfo.id}
          id={chartInfo.id}
          onClick={setCurrentChartId}
          onRemove={removeCustomScope}
          isActive={activeChartId === chartInfo.id}
          label={chartInfo.label}
        />
      ))}
      {newScoping && (
        <ScopingTitle
          id={newScoping.id}
          onClick={setCurrentChartId}
          onRemove={removeCustomScope}
          isActive={activeChartId === newScoping.id}
          label={`[${t('new custom scoping')}]`}
        />
      )}
    </>
  );
};
