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

import { FC, memo, useCallback, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { DataMaskStateWithId } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { useSelector } from 'react-redux';
import {
  getRisonFilterParam,
  parseRisonFilters,
  updateUrlWithUnmatchedFilters,
} from 'src/dashboard/util/risonFilters';
import FilterControls from './FilterControls/FilterControls';
import { useChartsVerboseMaps, getFilterBarTestId } from './utils';
import { HorizontalBarProps } from './types';
import FilterBarSettings from './FilterBarSettings';
import crossFiltersSelector from './CrossFilters/selectors';
import {
  getUrlFilterIndicators,
  getUrlFilterIdentity,
  UrlFilterIndicator,
} from './UrlFilters/selectors';
import UrlFilterTag from './UrlFilters/UrlFilterTag';

const HorizontalBar = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px ${
      theme.sizeUnit * 3
    }px ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgBase};
    box-shadow: inset 0px -2px 2px -1px ${theme.colorSplit};
  `}
`;

const HorizontalBarContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-start;
    .loading {
      margin: ${theme.sizeUnit * 2}px auto ${theme.sizeUnit * 2}px;
      padding: 0;
    }
  `}
`;

const FilterBarEmptyStateContainer = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    padding-left: ${theme.sizeUnit * 2}px;
  `}
`;

const UrlFiltersContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: 0 ${theme.sizeUnit * 2}px;
    margin-right: ${theme.sizeUnit * 2}px;
    border-right: 1px solid ${theme.colorBorder};
  `}
`;

const UrlFilterTitle = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const HorizontalFilterBar: FC<HorizontalBarProps> = ({
  actions,
  dataMaskSelected,
  filterValues,
  chartCustomizationValues,
  isInitialized,
  onSelectionChange,
  onPendingCustomizationDataMaskChange,
  clearAllTriggers,
  onClearAllComplete,
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

  const [activeUrlFilters, setActiveUrlFilters] = useState<
    UrlFilterIndicator[]
  >(() => getUrlFilterIndicators());

  const handleRemoveUrlFilter = useCallback(
    (filterToRemove: UrlFilterIndicator) => {
      const risonParam = getRisonFilterParam();
      if (!risonParam) return;

      const removeId = getUrlFilterIdentity(filterToRemove.filter);
      const currentFilters = parseRisonFilters(risonParam);
      const remaining = currentFilters.filter(
        f => getUrlFilterIdentity(f) !== removeId,
      );
      updateUrlWithUnmatchedFilters(remaining);
      setActiveUrlFilters(prev =>
        prev.filter(f => getUrlFilterIdentity(f.filter) !== removeId),
      );
    },
    [],
  );

  const urlFiltersComponent = useMemo(() => {
    if (activeUrlFilters.length === 0) return null;

    return (
      <UrlFiltersContainer>
        <UrlFilterTitle>
          <Icons.LinkOutlined iconSize="s" />
          {t('URL Filters')}
        </UrlFilterTitle>
        {activeUrlFilters.map(filter => (
          <UrlFilterTag
            key={getUrlFilterIdentity(filter.filter)}
            filter={filter}
            orientation={FilterBarOrientation.Horizontal}
            onRemove={handleRemoveUrlFilter}
          />
        ))}
      </UrlFiltersContainer>
    );
  }, [activeUrlFilters, handleRemoveUrlFilter]);

  const hasFilters =
    filterValues.length > 0 ||
    selectedCrossFilters.length > 0 ||
    activeUrlFilters.length > 0 ||
    chartCustomizationValues.length > 0;

  return (
    <HorizontalBar {...getFilterBarTestId()}>
      <HorizontalBarContent>
        {!isInitialized ? (
          <Loading position="inline-centered" size="s" muted />
        ) : (
          <>
            <FilterBarSettings />
            {!hasFilters && (
              <FilterBarEmptyStateContainer data-test="horizontal-filterbar-empty">
                {t('No filters are currently added to this dashboard.')}
              </FilterBarEmptyStateContainer>
            )}
            {hasFilters && (
              <>
                {urlFiltersComponent}
                <FilterControls
                  dataMaskSelected={dataMaskSelected}
                  onFilterSelectionChange={onSelectionChange}
                  onPendingCustomizationDataMaskChange={
                    onPendingCustomizationDataMaskChange
                  }
                  chartCustomizationValues={chartCustomizationValues}
                  clearAllTriggers={clearAllTriggers}
                  onClearAllComplete={onClearAllComplete}
                />
              </>
            )}
            {actions}
          </>
        )}
      </HorizontalBarContent>
    </HorizontalBar>
  );
};
export default memo(HorizontalFilterBar);
