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
import {
  QueryFormData,
  styled,
  SuperChart,
  t,
  ExtraFormData,
} from '@superset-ui/core';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { getChartDataRequest } from 'src/chart/chartAction';
import { areObjectsEqual } from 'src/reduxUtils';
import Loading from 'src/components/Loading';
import BasicErrorAlert from 'src/components/ErrorMessage/BasicErrorAlert';
import FilterConfigurationLink from './FilterConfigurationLink';
import {
  useCascadingFilters,
  useFilterConfiguration,
  useFilters,
  useFilterState,
  useSetExtraFormData,
} from './state';
import { Filter, CascadeFilter, CurrentFilterState } from './types';
import {
  buildCascadeFiltersTree,
  getFormData,
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

const FilterItem = styled.div`
  padding-bottom: 10px;
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

const StyledCascadeChildrenList = styled.ul`
  list-style-type: none;
  & > * {
    list-style-type: none;
  }
`;

const StyledFilterControlTitle = styled.h4`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: break-word;
`;

const StyledFilterControlTitleBox = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const StyledFilterControlContainer = styled.div`
  width: 100%;
`;

const StyledFilterControlBox = styled.div`
  display: flex;
`;

const StyledCaretIcon = styled(Icon)`
  margin-top: ${({ theme }) => -theme.gridUnit}px;
`;

const StyledLoadingBox = styled.div`
  position: relative;
  height: ${({ theme }) => theme.gridUnit * 8}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 6}px;
`;

interface FilterProps {
  filter: Filter;
  icon?: React.ReactElement;
  directPathToChild?: string[];
  onFilterSelectionChange: (
    filter: Filter,
    extraFormData: ExtraFormData,
    currentState: CurrentFilterState,
  ) => void;
}

interface FiltersBarProps {
  filtersOpen: boolean;
  toggleFiltersBar: any;
  directPathToChild?: string[];
}

const FilterValue: React.FC<FilterProps> = ({
  filter,
  directPathToChild,
  onFilterSelectionChange,
}) => {
  const {
    id,
    allowsMultipleValues,
    inverseSelection,
    targets,
    defaultValue,
    filterType,
  } = filter;
  const cascadingFilters = useCascadingFilters(id);
  const filterState = useFilterState(id);
  const [loading, setLoading] = useState<boolean>(true);
  const [state, setState] = useState([]);
  const [error, setError] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<QueryFormData>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [target] = targets;
  const { datasetId = 18, column } = target;
  const { name: groupby } = column;
  const currentValue = filterState.currentState?.value;
  useEffect(() => {
    const newFormData = getFormData({
      datasetId,
      cascadingFilters,
      groupby,
      allowsMultipleValues,
      defaultValue,
      currentValue,
      inverseSelection,
    });
    if (!areObjectsEqual(formData || {}, newFormData)) {
      setFormData(newFormData);
      getChartDataRequest({
        formData: newFormData,
        force: false,
        requestParams: { dashboardId: 0 },
      })
        .then(response => {
          setState(response.result);
          setError(false);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [cascadingFilters, datasetId, groupby, defaultValue, currentValue]);

  useEffect(() => {
    if (directPathToChild?.[0] === filter.id) {
      // wait for Cascade Popover to open
      const timeout = setTimeout(() => {
        inputRef?.current?.focus();
      }, 200);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [inputRef, directPathToChild, filter.id]);

  const setExtraFormData = ({
    extraFormData,
    currentState,
  }: {
    extraFormData: ExtraFormData;
    currentState: CurrentFilterState;
  }) => onFilterSelectionChange(filter, extraFormData, currentState);

  if (loading) {
    return (
      <StyledLoadingBox>
        <Loading />
      </StyledLoadingBox>
    );
  }

  if (error) {
    return (
      <BasicErrorAlert
        title={t('Cannot load filter')}
        body={t('Check configuration')}
        level="error"
      />
    );
  }

  return (
    <FilterItem data-test="form-item-value">
      <SuperChart
        height={20}
        width={220}
        formData={formData}
        queriesData={state}
        chartType={filterType}
        // @ts-ignore (update superset-ui)
        hooks={{ setExtraFormData }}
      />
    </FilterItem>
  );
};

export const FilterControl: React.FC<FilterProps> = ({
  filter,
  icon,
  onFilterSelectionChange,
  directPathToChild,
}) => {
  const { name = '<undefined>' } = filter;
  return (
    <StyledFilterControlContainer>
      <StyledFilterControlTitleBox>
        <StyledFilterControlTitle data-test="filter-control-name">
          {name}
        </StyledFilterControlTitle>
        <div data-test="filter-icon">{icon}</div>
      </StyledFilterControlTitleBox>
      <FilterValue
        filter={filter}
        directPathToChild={directPathToChild}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    </StyledFilterControlContainer>
  );
};

interface CascadeFilterControlProps {
  filter: CascadeFilter;
  directPathToChild?: string[];
  onFilterSelectionChange: (
    filter: Filter,
    extraFormData: ExtraFormData,
    currentState: CurrentFilterState,
  ) => void;
}

export const CascadeFilterControl: React.FC<CascadeFilterControlProps> = ({
  filter,
  directPathToChild,
  onFilterSelectionChange,
}) => (
  <>
    <StyledFilterControlBox>
      <StyledCaretIcon name="caret-down" />
      <FilterControl
        filter={filter}
        directPathToChild={directPathToChild}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    </StyledFilterControlBox>

    <StyledCascadeChildrenList>
      {filter.cascadeChildren?.map(childFilter => (
        <li key={childFilter.id}>
          <CascadeFilterControl
            filter={childFilter}
            directPathToChild={directPathToChild}
            onFilterSelectionChange={onFilterSelectionChange}
          />
        </li>
      ))}
    </StyledCascadeChildrenList>
  </>
);

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
  const setExtraFormData = useSetExtraFormData();
  const filterConfigs = useFilterConfiguration();
  const filters = useFilters();
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
    setFilterData(prevFilterData => ({
      ...prevFilterData,
      [filter.id]: {
        extraFormData,
        currentState,
      },
    }));

    const children = cascadeChildren[filter.id] || [];
    // force instant updating for parent filters
    if (filter.isInstant || children.length > 0) {
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

  const handleResetAll = () => {
    filterConfigs.forEach(filter => {
      setExtraFormData(filter.id, filterData[filter.id]?.extraFormData, {
        ...filterData[filter.id]?.currentState,
        value: filters[filter.id]?.defaultValue,
      });
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
