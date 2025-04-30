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

import { FC, memo, useMemo } from 'react';
import { DataMaskStateWithId, styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { RootState } from 'src/dashboard/types';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { useSelector } from 'react-redux';
import FilterControls from './FilterControls/FilterControls';
import { useChartsVerboseMaps, getFilterBarTestId } from './utils';
import { HorizontalBarProps } from './types';
import FilterBarSettings from './FilterBarSettings';
import crossFiltersSelector from './CrossFilters/selectors';

const HorizontalBar = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 3}px ${theme.gridUnit * 2}px ${
      theme.gridUnit * 3
    }px ${theme.gridUnit * 4}px;
    background: ${theme.colors.grayscale.light5};
    box-shadow: inset 0px -2px 2px -1px ${theme.colors.grayscale.light2};
  `}
`;

const HorizontalBarContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    line-height: 0;

    .loading {
      margin: ${theme.gridUnit * 2}px auto ${theme.gridUnit * 2}px;
      padding: 0;
    }
  `}
`;

const FilterBarEmptyStateContainer = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.grayscale.base};
    font-size: ${theme.typography.sizes.s}px;
    padding-left: ${theme.gridUnit * 2}px;
  `}
`;

const HorizontalFilterBar: FC<HorizontalBarProps> = ({
  actions,
  dataMaskSelected,
  filterValues,
  isInitialized,
  onSelectionChange,
}) => {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const chartIds = useChartIds();
  const chartLayoutItems = useChartLayoutItems();
  const verboseMaps = useChartsVerboseMaps();

  const selectedCrossFilters = useMemo(
    () =>
      crossFiltersSelector({
        dataMask,
        chartIds,
        chartLayoutItems,
        verboseMaps,
      }),
    [chartIds, chartLayoutItems, dataMask, verboseMaps],
  );

  const hasFilters = filterValues.length > 0 || selectedCrossFilters.length > 0;

  return (
    <HorizontalBar {...getFilterBarTestId()}>
      <HorizontalBarContent>
        {!isInitialized ? (
          <Loading position="inline-centered" />
        ) : (
          <>
            <FilterBarSettings />
            {!hasFilters && (
              <FilterBarEmptyStateContainer data-test="horizontal-filterbar-empty">
                {t('No filters are currently added to this dashboard.')}
              </FilterBarEmptyStateContainer>
            )}
            {hasFilters && (
              <FilterControls
                dataMaskSelected={dataMaskSelected}
                onFilterSelectionChange={onSelectionChange}
              />
            )}
            {actions}
          </>
        )}
      </HorizontalBarContent>
    </HorizontalBar>
  );
};
export default memo(HorizontalFilterBar);
