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
import { styled, t, tn } from '@superset-ui/core';
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { FiltersSet } from 'src/dashboard/reducers/types';
import { Input, Select } from 'src/common/components';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { updateDataMask } from 'src/dataMask/actions';
import {
  DataMaskUnitWithId,
  MaskWithId,
  DataMaskUnit,
  DataMaskState,
} from 'src/dataMask/types';
import { useImmer } from 'use-immer';
import { getInitialMask } from 'src/dataMask/reducer';
import { areObjectsEqual } from 'src/reduxUtils';
import FilterConfigurationLink from './FilterConfigurationLink';
import { useFilterSets } from './state';
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
  padding: ${({ theme }) => theme.gridUnit * 2}px;

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
  display: grid;
  flex-direction: row;
  grid-template-columns: 1fr 1fr;
  ${({ theme }) =>
    `padding: 0 ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};

  .btn {
    flex: 1;
  }
`;

const Sets = styled(ActionButtons)`
  grid-template-columns: 1fr;
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
  const [filterData, setFilterData] = useImmer<DataMaskUnit>({});
  const [
    lastAppliedFilterData,
    setLastAppliedFilterData,
  ] = useImmer<DataMaskUnit>({});
  const dispatch = useDispatch();
  const dataMaskState = useSelector<any, DataMaskUnitWithId>(
    state => state.dataMask.nativeFilters ?? {},
  );
  const filterSets = useFilterSets();
  const filterConfigs = useFilterConfiguration();
  const filterSetsConfigs = useSelector<any, FiltersSet[]>(
    state => state.dashboardInfo?.metadata?.filter_sets_configuration || [],
  );
  const [filtersSetName, setFiltersSetName] = useState('');
  const [selectedFiltersSetId, setSelectedFiltersSetId] = useState<
    string | null
  >(null);
  const canEdit = useSelector<any, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    const areFiltersInitialized = filterConfigs.every(
      filterConfig =>
        filterConfig.defaultValue ===
        filterData[filterConfig.id]?.currentState?.value,
    );
    if (areFiltersInitialized) {
      setIsInitialized(true);
    }
  }, [filterConfigs, filterData, isInitialized]);

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
  }, [filterConfigs, filterData]);

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

  const takeFiltersSet = (value: string) => {
    setSelectedFiltersSetId(value);
    if (!value) {
      return;
    }
    const filtersSet = filterSets[value];
    Object.values(filtersSet.dataMask?.nativeFilters ?? []).forEach(
      dataMask => {
        const { extraFormData, currentState, id } = dataMask as MaskWithId;
        handleFilterSelectionChange(
          { id },
          { nativeFilters: { extraFormData, currentState } },
        );
      },
    );
  };

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
      handleApply();
    }
  }, [isInitialized]);

  const handleSaveFilterSets = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetsConfigs.concat([
          {
            name: filtersSetName.trim(),
            id: generateFiltersSetId(),
            dataMask: {
              nativeFilters: dataMaskState,
            },
          },
        ]),
      ),
    );
    setFiltersSetName('');
  };

  const handleDeleteFilterSets = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetsConfigs.filter(
          filtersSet => filtersSet.id !== selectedFiltersSetId,
        ),
      ),
    );
    setFiltersSetName('');
    setSelectedFiltersSetId(null);
  };

  const handleClearAll = () => {
    filterConfigs.forEach(filter => {
      setFilterData(draft => {
        draft[filter.id] = getInitialMask(filter.id);
      });
    });
  };

  const isClearAllDisabled = !Object.values(dataMaskState).every(
    filter =>
      filterData[filter.id]?.currentState?.value === null ||
      (!filterData[filter.id] && filter.currentState?.value === null),
  );

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
            disabled={!isClearAllDisabled}
            buttonStyle="tertiary"
            buttonSize="small"
            onClick={handleClearAll}
            data-test="filter-reset-button"
          >
            {t('Clear all')}
          </Button>
          <Button
            disabled={
              !isInitialized ||
              areObjectsEqual(filterData, lastAppliedFilterData)
            }
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
          <Sets>
            <FilterSet>
              <StyledTitle>
                <div>{t('Choose filters set')}</div>
                <Select
                  size="small"
                  allowClear
                  value={selectedFiltersSetId as string}
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
              <Button
                buttonStyle="warning"
                buttonSize="small"
                disabled={!selectedFiltersSetId}
                onClick={handleDeleteFilterSets}
                data-test="filter-save-filters-set-button"
              >
                {t('Delete Filters Set')}
              </Button>
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
          </Sets>
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
