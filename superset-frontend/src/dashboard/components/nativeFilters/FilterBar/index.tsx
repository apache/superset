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

/* eslint-disable no-param-reassign */
import { DataMask, HandlerFunction, styled, t } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import cx from 'classnames';
import Icons from 'src/components/Icons';
import { Tabs } from 'src/common/components';
import { usePrevious } from 'src/common/hooks/usePrevious';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { updateDataMask } from 'src/dataMask/actions';
import { DataMaskStateWithId, DataMaskWithId } from 'src/dataMask/types';
import { useImmer } from 'use-immer';
import { testWithId } from 'src/utils/testUtils';
import { Filter } from 'src/dashboard/components/nativeFilters/types';
import Loading from 'src/components/Loading';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { areObjectsEqual } from 'src/reduxUtils';
import { checkIsApplyDisabled, TabIds } from './utils';
import FilterSets from './FilterSets';
import {
  useNativeFiltersDataMask,
  useFilters,
  useFilterSets,
  useFilterUpdates,
  useInitialization,
} from './state';
import EditSection from './FilterSets/EditSection';
import Header from './Header';
import FilterControls from './FilterControls/FilterControls';
import { usePreselectNativeFilters } from '../state';

export const FILTER_BAR_TEST_ID = 'filter-bar';
export const getFilterBarTestId = testWithId(FILTER_BAR_TEST_ID);

const BarWrapper = styled.div<{ width: number }>`
  width: ${({ theme }) => theme.gridUnit * 8}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${({ width }) => width}px; // arbitrary...
  }
`;

const Bar = styled.div<{ width: number }>`
  & .ant-typography-edit-content {
    left: 0;
    margin-top: 0;
    width: 100%;
  }
  position: absolute;
  top: 0;
  left: 0;
  flex-direction: column;
  flex-grow: 1;
  width: ${({ width }) => width}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  min-height: 100%;
  display: none;

  &.open {
    display: flex;
  }
`;

const CollapsedBar = styled.div<{ offset: number }>`
  position: absolute;
  top: ${({ offset }) => offset}px;
  left: 0;
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 8}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: none;
  text-align: center;

  &.open {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${({ theme }) => theme.gridUnit * 2}px;
  }

  svg {
    cursor: pointer;
  }
`;

const StyledCollapseIcon = styled(Icons.Collapse)`
  color: ${({ theme }) => theme.colors.primary.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledFilterIcon = styled(Icons.Filter)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledTabs = styled(Tabs)`
  & .ant-tabs-nav-list {
    width: 100%;
  }
  & .ant-tabs-tab {
    display: flex;
    justify-content: center;
    margin: 0;
    flex: 1;
  }
`;

export interface FiltersBarProps {
  filtersOpen: boolean;
  toggleFiltersBar: any;
  directPathToChild?: string[];
  width: number;
  height: number | string;
  offset: number;
}

const FilterBar: React.FC<FiltersBarProps> = ({
  filtersOpen,
  toggleFiltersBar,
  directPathToChild,
  width,
  height,
  offset,
}) => {
  const dataMaskApplied: DataMaskStateWithId = useNativeFiltersDataMask();
  const [editFilterSetId, setEditFilterSetId] = useState<string | null>(null);
  const [dataMaskSelected, setDataMaskSelected] = useImmer<DataMaskStateWithId>(
    dataMaskApplied,
  );
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const [tab, setTab] = useState(TabIds.AllFilters);
  const filters = useFilters();
  const previousFilters = usePrevious(filters);
  const filterValues = Object.values<Filter>(filters);
  const [isFilterSetChanged, setIsFilterSetChanged] = useState(false);
  const preselectNativeFilters = usePreselectNativeFilters();
  const [initializedFilters, setInitializedFilters] = useState<any[]>([]);

  useEffect(() => {
    setDataMaskSelected(() => dataMaskApplied);
  }, [JSON.stringify(dataMaskApplied), setDataMaskSelected]);

  // reset filter state if filter type changes
  useEffect(() => {
    setDataMaskSelected(draft => {
      Object.values(filters).forEach(filter => {
        if (
          filter.filterType !== previousFilters?.[filter.id]?.filterType &&
          previousFilters?.[filter.id]?.filterType !== undefined
        ) {
          draft[filter.id] = getInitialDataMask(filter.id) as DataMaskWithId;
        }
      });
    });
  }, [
    JSON.stringify(filters),
    JSON.stringify(previousFilters),
    setDataMaskSelected,
  ]);

  const handleFilterSelectionChange = (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMask>,
  ) => {
    setIsFilterSetChanged(tab !== TabIds.AllFilters);
    setDataMaskSelected(draft => {
      // check if a filter has preselect filters
      if (
        preselectNativeFilters?.[filter.id] !== undefined &&
        !initializedFilters.includes(filter.id)
      ) {
        /**
         * since preselect filters don't have extraFormData, they need to iterate
         * a few times to populate the full state necessary for proper filtering.
         * Once both filterState and extraFormData are identical, we can coclude
         * that the filter has been fully initialized.
         */
        if (
          areObjectsEqual(
            dataMask.filterState,
            dataMaskSelected[filter.id]?.filterState,
          ) &&
          areObjectsEqual(
            dataMask.extraFormData,
            dataMaskSelected[filter.id]?.extraFormData,
          )
        ) {
          setInitializedFilters(prevState => [...prevState, filter.id]);
        }
        dispatch(updateDataMask(filter.id, dataMask));
      }
      // force instant updating on initialization for filters with `requiredFirst` is true or instant filters
      else if (
        // filterState.value === undefined - means that value not initialized
        dataMask.filterState?.value !== undefined &&
        dataMaskSelected[filter.id]?.filterState?.value === undefined &&
        filter.requiredFirst
      ) {
        dispatch(updateDataMask(filter.id, dataMask));
      }

      draft[filter.id] = {
        ...(getInitialDataMask(filter.id) as DataMaskWithId),
        ...dataMask,
      };
    });
  };

  const handleApply = () => {
    const filterIds = Object.keys(dataMaskSelected);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(updateDataMask(filterId, dataMaskSelected[filterId]));
      }
    });
  };

  useFilterUpdates(dataMaskSelected, setDataMaskSelected);
  const isApplyDisabled = checkIsApplyDisabled(
    dataMaskSelected,
    dataMaskApplied,
    filterValues,
  );
  const isInitialized = useInitialization();

  return (
    <BarWrapper
      {...getFilterBarTestId()}
      className={cx({ open: filtersOpen })}
      width={width}
    >
      <CollapsedBar
        {...getFilterBarTestId('collapsable')}
        className={cx({ open: !filtersOpen })}
        onClick={() => toggleFiltersBar(true)}
        offset={offset}
      >
        <StyledCollapseIcon
          {...getFilterBarTestId('expand-button')}
          iconSize="l"
        />
        <StyledFilterIcon {...getFilterBarTestId('filter-icon')} iconSize="l" />
      </CollapsedBar>
      <Bar className={cx({ open: filtersOpen })} width={width}>
        <Header
          toggleFiltersBar={toggleFiltersBar}
          onApply={handleApply}
          isApplyDisabled={isApplyDisabled}
          dataMaskSelected={dataMaskSelected}
          dataMaskApplied={dataMaskApplied}
        />
        {!isInitialized ? (
          <div css={{ height }}>
            <Loading />
          </div>
        ) : isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET) ? (
          <StyledTabs
            centered
            onChange={setTab as HandlerFunction}
            defaultActiveKey={TabIds.AllFilters}
            activeKey={editFilterSetId ? TabIds.AllFilters : undefined}
          >
            <Tabs.TabPane
              tab={t(`All Filters (${filterValues.length})`)}
              key={TabIds.AllFilters}
              css={{ overflow: 'auto', height }}
            >
              {editFilterSetId && (
                <EditSection
                  dataMaskSelected={dataMaskSelected}
                  disabled={!isApplyDisabled}
                  onCancel={() => setEditFilterSetId(null)}
                  filterSetId={editFilterSetId}
                />
              )}
              <FilterControls
                dataMaskSelected={dataMaskSelected}
                directPathToChild={directPathToChild}
                onFilterSelectionChange={handleFilterSelectionChange}
              />
            </Tabs.TabPane>
            <Tabs.TabPane
              disabled={!!editFilterSetId}
              tab={t(`Filter Sets (${filterSetFilterValues.length})`)}
              key={TabIds.FilterSets}
              css={{ overflow: 'auto', height }}
            >
              <FilterSets
                onEditFilterSet={setEditFilterSetId}
                disabled={!isApplyDisabled}
                dataMaskSelected={dataMaskSelected}
                isFilterSetChanged={isFilterSetChanged}
                onFilterSelectionChange={handleFilterSelectionChange}
              />
            </Tabs.TabPane>
          </StyledTabs>
        ) : (
          <div css={{ overflow: 'auto', height }}>
            <FilterControls
              dataMaskSelected={dataMaskSelected}
              directPathToChild={directPathToChild}
              onFilterSelectionChange={handleFilterSelectionChange}
            />
          </div>
        )}
      </Bar>
    </BarWrapper>
  );
};

export default FilterBar;
