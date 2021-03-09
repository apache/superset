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
import { styled, t } from '@superset-ui/core';
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { Tabs } from 'src/common/components';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { updateDataMask } from 'src/dataMask/actions';
import {
  DataMaskUnitWithId,
  DataMaskUnit,
  DataMaskState,
} from 'src/dataMask/types';
import { useImmer } from 'use-immer';
import { getInitialMask } from 'src/dataMask/reducer';
import { areObjectsEqual } from 'src/reduxUtils';
import FilterConfigurationLink from './FilterConfigurationLink';
import { Filter } from '../types';
import { buildCascadeFiltersTree, mapParentFiltersToChildren } from './utils';
import CascadePopover from './CascadePopover';
import FilterSets from './FilterSets/FilterSets';
import { useFilters, useFilterSets } from './state';

const barWidth = `250px`;

const BarWrapper = styled.div`
  width: ${({ theme }) => theme.gridUnit * 8}px;

  &.open {
    width: ${barWidth}; // arbitrary...
  }
`;

const Bar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  flex-direction: column;
  flex-grow: 1;
  width: ${barWidth}; // arbitrary...
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  min-height: 100%;
  display: none;
  /* &.animated {
    display: flex;
    transform: translateX(-100%);
    transition: transform ${({ theme }) => theme.transitionTiming}s;
    transition-delay: 0s;
  }  */

  &.open {
    display: flex;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({ theme }) => theme.transitionTiming * 2}s;
    } */
  }
`;

const CollapsedBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 8}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: none;
  text-align: center;
  /* &.animated {
    display: block;
    transform: translateX(-100%);
    transition: transform ${({ theme }) => theme.transitionTiming}s;
    transition-delay: 0s;
  } */

  &.open {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({ theme }) => theme.transitionTiming * 3}s;
    } */
  }

  svg {
    width: ${({ theme }) => theme.gridUnit * 4}px;
    height: ${({ theme }) => theme.gridUnit * 4}px;
    cursor: pointer;
  }
`;

const StyledCollapseIcon = styled(Icon)`
  color: ${({ theme }) => theme.colors.primary.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
`;

const TitleArea = styled.h4`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 0;
  padding: ${({ theme }) => theme.gridUnit * 2}px;

  & > span {
    flex-grow: 1;
  }
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

const ActionButtons = styled.div`
  display: grid;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  grid-gap: 10px;
  grid-template-columns: 1fr 1fr;
  ${({ theme }) =>
    `padding: 0 ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px`};

  .btn {
    flex: 1;
  }
`;

const FilterControls = styled.div`
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px;
  &:hover {
    cursor: pointer;
  }
`;

interface FiltersBarProps {
  filtersOpen: boolean;
  toggleFiltersBar: any;
  directPathToChild?: string[];
}

const FilterBar: React.FC<FiltersBarProps> = ({
  filtersOpen,
  toggleFiltersBar,
  directPathToChild,
}) => {
  const [filterData, setFilterData] = useImmer<DataMaskUnit>({});
  const [
    lastAppliedFilterData,
    setLastAppliedFilterData,
  ] = useImmer<DataMaskUnit>({});
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filterSetsArray = Object.values(filterSets);
  const filters = useFilters();
  const filtersArray = Object.values(filters);
  const dataMaskState = useSelector<any, DataMaskUnitWithId>(
    state => state.dataMask.nativeFilters ?? {},
  );
  const canEdit = useSelector<any, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const handleApply = () => {
    const filterIds = Object.keys(filterData);
    filterIds.forEach(filterId => {
      if (filterData[filterId]) {
        dispatch(
          updateDataMask(filterId, {
            nativeFilters: filterData[filterId],
          }),
        );
      }
    });
    setLastAppliedFilterData(() => filterData);
  };

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const areFiltersInitialized = filtersArray.every(filterConfig =>
      areObjectsEqual(
        filterConfig.defaultValue,
        filterData[filterConfig.id]?.currentState?.value,
      ),
    );
    if (areFiltersInitialized) {
      handleApply();
      setIsInitialized(true);
    }
  }, [filtersArray, filterData, isInitialized]);

  useEffect(() => {
    if (filtersArray.length === 0 && filtersOpen) {
      toggleFiltersBar(false);
    }
  }, [filtersArray.length]);

  const cascadeChildren = useMemo(
    () => mapParentFiltersToChildren(filtersArray),
    [filtersArray],
  );

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filtersArray.map(filter => ({
      ...filter,
      currentValue: filterData[filter.id]?.currentState?.value,
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filtersArray, filterData]);

  const handleFilterSelectionChange = (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMaskState>,
  ) => {
    setFilterData(draft => {
      const children = cascadeChildren[filter.id] || [];
      // force instant updating on initialization or for parent filters
      if (filter.isInstant || children.length > 0) {
        dispatch(updateDataMask(filter.id, dataMask));
      }

      if (dataMask.nativeFilters) {
        draft[filter.id] = dataMask.nativeFilters;
      }
    });
  };

  const handleClearAll = () => {
    filtersArray.forEach(filter => {
      setFilterData(draft => {
        draft[filter.id] = getInitialMask(filter.id);
      });
    });
  };

  const isClearAllDisabled = Object.values(dataMaskState).every(
    filter =>
      filterData[filter.id]?.currentState?.value === null ||
      (!filterData[filter.id] && filter.currentState?.value === null),
  );

  const getFilterControls = () => (
    <FilterControls>
      {cascadeFilters.map(filter => (
        <CascadePopover
          data-test="cascade-filters-control"
          key={filter.id}
          visible={visiblePopoverId === filter.id}
          onVisibleChange={visible =>
            setVisiblePopoverId(visible ? filter.id : null)
          }
          filter={filter}
          onFilterSelectionChange={handleFilterSelectionChange}
          directPathToChild={directPathToChild}
        />
      ))}
    </FilterControls>
  );

  const isApplyDisabled =
    !isInitialized || areObjectsEqual(filterData, lastAppliedFilterData);

  return (
    <BarWrapper data-test="filter-bar" className={cx({ open: filtersOpen })}>
      <CollapsedBar
        className={cx({ open: !filtersOpen })}
        onClick={() => toggleFiltersBar(true)}
      >
        <StyledCollapseIcon name="collapse" />
        <Icon name="filter" />
      </CollapsedBar>
      <Bar className={cx({ open: filtersOpen })}>
        <TitleArea>
          <span>{t('Filters')}</span>
          {canEdit && (
            <FilterConfigurationLink
              createNewOnOpen={filtersArray.length === 0}
            >
              <Icon name="edit" data-test="create-filter" />
            </FilterConfigurationLink>
          )}
          <Icon name="expand" onClick={() => toggleFiltersBar(false)} />
        </TitleArea>
        <ActionButtons>
          <Button
            disabled={isClearAllDisabled}
            buttonStyle="tertiary"
            buttonSize="small"
            onClick={handleClearAll}
            data-test="filter-reset-button"
          >
            {t('Clear all')}
          </Button>
          <Button
            disabled={isApplyDisabled}
            buttonStyle="primary"
            htmlType="submit"
            buttonSize="small"
            onClick={handleApply}
            data-test="filter-apply-button"
          >
            {t('Apply')}
          </Button>
        </ActionButtons>
        {isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET) ? (
          <StyledTabs
            centered
            defaultActiveKey="allFilters"
            onChange={() => {}}
          >
            <Tabs.TabPane
              tab={t(`All Filters (${filtersArray.length})`)}
              key="allFilters"
            >
              {getFilterControls()}
            </Tabs.TabPane>
            <Tabs.TabPane
              tab={t(`Filter Sets (${filterSetsArray.length})`)}
              key="filterSets"
            >
              <FilterSets
                disabled={!isApplyDisabled}
                dataMaskState={dataMaskState}
                onFilterSelectionChange={handleFilterSelectionChange}
              />
            </Tabs.TabPane>
          </StyledTabs>
        ) : (
          getFilterControls()
        )}
      </Bar>
    </BarWrapper>
  );
};

export default FilterBar;
