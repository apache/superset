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
import { styled, t, tn, ExtraFormData } from '@superset-ui/core';
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { CurrentFilterState } from 'src/dashboard/reducers/types';
import { Input, Select } from 'src/common/components';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import {
  saveFilterSets,
  setFiltersState,
} from 'src/dashboard/actions/nativeFilters';
import { SelectValue } from 'antd/lib/select';
import FilterConfigurationLink from './FilterConfigurationLink';
import {
  useFilters,
  useFilterSets,
  useFiltersState,
  useSetExtraFormData,
} from './state';
import { useFilterConfiguration } from '../state';
import { Filter } from '../types';
import {
  buildCascadeFiltersTree,
  generateFiltersSetId,
  mapParentFiltersToChildren,
} from './utils';
import CascadePopover from './CascadePopover';

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

const StyledTitle = styled.h4`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: break-word;
  & > .ant-select {
    width: 100%;
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

const FilterSet = styled.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  grid-gap: 10px;
  padding-top: 10px;
`;

const TitleArea = styled.h4`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 0;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  & > span {
    flex-grow: 1;
  }
  & :not(:first-child) {
    margin-left: ${({ theme }) => theme.gridUnit}px;
    &:hover {
      cursor: pointer;
    }
  }
`;

const ActionButtons = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  padding-top: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  .btn {
    flex: 1 1 50%;
  }
`;

const FilterControls = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
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
  const [filterData, setFilterData] = useState<{
    [id: string]: {
      extraFormData: ExtraFormData;
      currentState: CurrentFilterState;
    };
  }>({});
  const dispatch = useDispatch();
  const setExtraFormData = useSetExtraFormData();
  const filtersState = useFiltersState();
  const filterSets = useFilterSets();
  const filterConfigs = useFilterConfiguration();
  const filters = useFilters();
  const [filtersSetName, setFiltersSetName] = useState('');
  const canEdit = useSelector<any, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);

  useEffect(() => {
    if (filterConfigs.length === 0 && filtersOpen) {
      toggleFiltersBar(false);
    }
  }, [filterConfigs]);

  const cascadeChildren = useMemo(
    () => mapParentFiltersToChildren(filterConfigs),
    [filterConfigs],
  );

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterConfigs.map(filter => ({
      ...filter,
      currentValue: filterData[filter.id]?.currentState?.value,
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterConfigs]);

  const handleFilterSelectionChange = (
    filter: Filter,
    extraFormData: ExtraFormData,
    currentState: CurrentFilterState,
  ) => {
    let isInitialized = false;
    setFilterData(prevFilterData => {
      if (filter.id in prevFilterData) {
        isInitialized = true;
      }
      return {
        ...prevFilterData,
        [filter.id]: {
          extraFormData,
          currentState,
        },
      };
    });

    const children = cascadeChildren[filter.id] || [];
    // force instant updating on initialization or for parent filters
    if (!isInitialized || filter.isInstant || children.length > 0) {
      setExtraFormData(filter.id, extraFormData, currentState);
    }
  };

  const handleApply = () => {
    const filterIds = Object.keys(filterData);
    filterIds.forEach(filterId => {
      if (filterData[filterId]) {
        setExtraFormData(
          filterId,
          filterData[filterId]?.extraFormData,
          filterData[filterId]?.currentState,
        );
      }
    });
  };

  const handleSaveFilterSets = () => {
    dispatch(
      saveFilterSets(
        filtersSetName.trim(),
        generateFiltersSetId(),
        filtersState,
      ),
    );
    setFiltersSetName('');
  };

  const handleResetAll = () => {
    filterConfigs.forEach(filter => {
      setExtraFormData(filter.id, filterData[filter.id]?.extraFormData, {
        ...filterData[filter.id]?.currentState,
        value: filters[filter.id]?.defaultValue,
      });
    });
  };

  const takeFiltersSet = (value: SelectValue) => {
    dispatch(setFiltersState(filterSets[String(value)]?.filtersState));
  };

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
          <span>
            {t('Filters')} ({filterConfigs.length})
          </span>
          {canEdit && (
            <FilterConfigurationLink
              createNewOnOpen={filterConfigs.length === 0}
            >
              <Icon name="edit" data-test="create-filter" />
            </FilterConfigurationLink>
          )}
          <Icon name="expand" onClick={() => toggleFiltersBar(false)} />
        </TitleArea>
        <ActionButtons>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={handleResetAll}
            data-test="filter-reset-button"
          >
            {t('Reset all')}
          </Button>
          <Button
            buttonStyle="primary"
            htmlType="submit"
            buttonSize="small"
            onClick={handleApply}
            data-test="filter-apply-button"
          >
            {t('Apply')}
          </Button>
        </ActionButtons>
        {isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET) && (
          <ActionButtons>
            <FilterSet>
              <StyledTitle>
                <div>{t('Choose filters set')}</div>
                <Select
                  size="small"
                  allowClear
                  placeholder={tn(
                    'Available %d sets',
                    Object.keys(filterSets).length,
                  )}
                  onChange={takeFiltersSet}
                >
                  {Object.values(filterSets).map(({ name, id }) => (
                    <Select.Option value={id}>{name}</Select.Option>
                  ))}
                </Select>
              </StyledTitle>
              <StyledTitle>
                <div>{t('Name')}</div>
                <Input
                  size="small"
                  placeholder={t('Enter filter set name')}
                  value={filtersSetName}
                  onChange={({
                    target: { value },
                  }: ChangeEvent<HTMLInputElement>) => {
                    setFiltersSetName(value);
                  }}
                />
              </StyledTitle>
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                disabled={filtersSetName.trim() === ''}
                onClick={handleSaveFilterSets}
                data-test="filter-save-filters-set-button"
              >
                {t('Save Filters Set')}
              </Button>
            </FilterSet>
          </ActionButtons>
        )}
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
      </Bar>
    </BarWrapper>
  );
};

export default FilterBar;
