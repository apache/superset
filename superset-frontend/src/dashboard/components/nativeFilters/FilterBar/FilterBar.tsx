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
import { DataMaskUnit, DataMaskState } from 'src/dataMask/types';
import { useImmer } from 'use-immer';
import { getInitialMask } from 'src/dataMask/reducer';
import { areObjectsEqual } from 'src/reduxUtils';
import FilterConfigurationLink from './FilterConfigurationLink';
import { Filter } from '../types';
import { buildCascadeFiltersTree, mapParentFiltersToChildren } from './utils';
import CascadePopover from './CascadePopover';
import FilterSets from './FilterSets/FilterSets';
import { useDataMask, useFilters, useFilterSets } from './state';
import EditSection from './FilterSets/EditSection';

const barWidth = `250px`;

const BarWrapper = styled.div`
  width: ${({ theme }) => theme.gridUnit * 8}px;
  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
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
  padding: ${({ theme }) => theme.gridUnit * 4}px;
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
  const [editFilterSetId, setEditFilterSetId] = useState<string | null>(null);
  const [dataMaskSelected, setDataMaskSelected] = useImmer<DataMaskUnit>({});
  const [
    lastAppliedFilterData,
    setLastAppliedFilterData,
  ] = useImmer<DataMaskUnit>({});
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const filters = useFilters();
  const filterValues = Object.values(filters);
  const dataMaskApplied = useDataMask();
  const canEdit = useSelector<any, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const handleApply = () => {
    const filterIds = Object.keys(dataMaskSelected);
    filterIds.forEach(filterId => {
      if (dataMaskSelected[filterId]) {
        dispatch(
          updateDataMask(filterId, {
            nativeFilters: dataMaskSelected[filterId],
          }),
        );
      }
    });
    setLastAppliedFilterData(() => dataMaskSelected);
  };

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const areFiltersInitialized = filterValues.every(filterValue =>
      areObjectsEqual(
        filterValue.defaultValue,
        dataMaskSelected[filterValue.id]?.currentState?.value,
      ),
    );
    if (areFiltersInitialized) {
      handleApply();
      setIsInitialized(true);
    }
  }, [filterValues, dataMaskSelected, isInitialized]);

  useEffect(() => {
    if (filterValues.length === 0 && filtersOpen) {
      toggleFiltersBar(false);
    }
  }, [filterValues.length]);

  const cascadeChildren = useMemo(
    () => mapParentFiltersToChildren(filterValues),
    [filterValues],
  );

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterValues.map(filter => ({
      ...filter,
      currentValue: dataMaskSelected[filter.id]?.currentState?.value,
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterValues, dataMaskSelected]);

  const handleFilterSelectionChange = (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMaskState>,
  ) => {
    setDataMaskSelected(draft => {
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
    filterValues.forEach(filter => {
      setDataMaskSelected(draft => {
        draft[filter.id] = getInitialMask(filter.id);
      });
    });
  };

  const isClearAllDisabled = Object.values(dataMaskApplied).every(
    filter =>
      dataMaskSelected[filter.id]?.currentState?.value === null ||
      (!dataMaskSelected[filter.id] && filter.currentState?.value === null),
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
    !isInitialized || areObjectsEqual(dataMaskSelected, lastAppliedFilterData);

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
              createNewOnOpen={filterValues.length === 0}
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
            activeKey={editFilterSetId ? 'allFilters' : undefined}
          >
            <Tabs.TabPane
              tab={t(`All Filters (${filterValues.length})`)}
              key="allFilters"
            >
              {editFilterSetId && (
                <EditSection
                  dataMaskSelected={dataMaskSelected}
                  disabled={!isApplyDisabled}
                  onCancel={() => setEditFilterSetId(null)}
                  filterSetId={editFilterSetId}
                />
              )}
              {getFilterControls()}
            </Tabs.TabPane>
            <Tabs.TabPane
              disabled={!!editFilterSetId}
              tab={t(`Filter Sets (${filterSetFilterValues.length})`)}
              key="filterSets"
            >
              <FilterSets
                onEditFilterSet={setEditFilterSetId}
                disabled={!isApplyDisabled}
                dataMaskSelected={dataMaskSelected}
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
