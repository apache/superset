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
import { styled, t, tn, DataMask } from '@superset-ui/core';
import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { FiltersSet, FilterState } from 'src/dashboard/reducers/types';
import { Input, Select } from 'src/common/components';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import {
  setFilterSetsConfiguration,
  updateExtraFormData,
} from 'src/dashboard/actions/nativeFilters';
import FilterConfigurationLink from './FilterConfigurationLink';
import { useFilters, useFilterSets, useFiltersStateNative } from './state';
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
    [filterId: string]: Omit<FilterState, 'id'>;
  }>({});
  const dispatch = useDispatch();
  const filtersStateNative = useFiltersStateNative();
  const filterSets = useFilterSets();
  const filterConfigs = useFilterConfiguration();
  const filterSetsConfigs = useSelector<any, FiltersSet[]>(
    state => state.dashboardInfo?.metadata?.filter_sets_configuration || [],
  );
  const filters = useFilters();
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
    filtersState: DataMask,
  ) => {
    setFilterData(prevFilterData => {
      const children = cascadeChildren[filter.id] || [];
      // force instant updating on initialization or for parent filters
      if (filter.isInstant || children.length > 0) {
        dispatch(updateExtraFormData(filter.id, filtersState));
      }

      if (!filtersState.nativeFilters) {
        return { ...prevFilterData };
      }
      return {
        ...prevFilterData,
        [filter.id]: filtersState.nativeFilters,
      };
    });
  };

  const takeFiltersSet = (value: string) => {
    setSelectedFiltersSetId(value);
    if (!value) {
      return;
    }
    const filtersSet = filterSets[value];
    Object.values(filtersSet.filtersState?.nativeFilters ?? []).forEach(
      filterState => {
        const { extraFormData, currentState, id } = filterState as FilterState;
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
          updateExtraFormData(filterId, {
            nativeFilters: filterData[filterId],
          }),
        );
      }
    });
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
            filtersState: {
              nativeFilters: filtersStateNative,
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

  const handleResetAll = () => {
    filterConfigs.forEach(filter => {
      dispatch(
        updateExtraFormData(filter.id, {
          nativeFilters: {
            currentState: {
              ...filterData[filter.id]?.currentState,
              value: filters[filter.id]?.defaultValue,
            },
          },
        }),
      );
    });
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
