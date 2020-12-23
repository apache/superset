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
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';
import { Form } from 'src/common/components';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import { getChartDataRequest } from 'src/chart/chartAction';
import { areObjectsEqual } from 'src/reduxUtils';
import Loading from 'src/components/Loading';
import FilterConfigurationLink from './FilterConfigurationLink';
// import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';

import {
  useCascadingFilters,
  useFilterConfiguration,
  useSetExtraFormData,
} from './state';
import { Filter, CascadeFilter } from './types';
import { buildCascadeFiltersTree, mapParentFiltersToChildren } from './utils';
import CascadePopover from './CascadePopover';

const barWidth = `250px`;

const BarWrapper = styled.div`
  width: ${({ theme }) => theme.gridUnit * 6}px;
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
    transition: transform ${({
    theme,
  }) => theme.transitionTiming}s;
    transition-delay: 0s;
  }  */
  &.open {
    display: flex;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({
      theme,
    }) => theme.transitionTiming * 2}s;
    } */
  }
`;

const CollapsedBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 6}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: none;
  text-align: center;
  /* &.animated {
    display: block;
    transform: translateX(-100%);
    transition: transform ${({
    theme,
  }) => theme.transitionTiming}s;
    transition-delay: 0s;
  } */
  &.open {
    display: block;
    /* &.animated {
      transform: translateX(0);
      transition-delay: ${({
      theme,
    }) => theme.transitionTiming * 3}s;
    } */
  }
  svg {
    width: ${({ theme }) => theme.gridUnit * 4}px;
    height: ${({ theme }) => theme.gridUnit * 4}px;
    cursor: pointer;
  }
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
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  text-transform: uppercase;
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
  onExtraFormDataChange: (filter: Filter, extraFormData: ExtraFormData) => void;
}

interface FiltersBarProps {
  filtersOpen: boolean;
  toggleFiltersBar: any;
}

const FilterValue: React.FC<FilterProps> = ({
  filter,
  onExtraFormDataChange,
}) => {
  const {
    id,
    allowsMultipleValues,
    inverseSelection,
    targets,
    currentValue,
    defaultValue,
  } = filter;
  const cascadingFilters = useCascadingFilters(id);
  const [loading, setLoading] = useState<boolean>(true);
  const [state, setState] = useState({ data: undefined });
  const [formData, setFormData] = useState<Partial<QueryFormData>>({});
  const [target] = targets;
  const { datasetId = 18, column } = target;
  const { name: groupby } = column;

  const getFormData = (): Partial<QueryFormData> => ({
    adhoc_filters: [],
    datasource: `${datasetId}__table`,
    extra_filters: [],
    extra_form_data: cascadingFilters,
    granularity_sqla: 'ds',
    groupby: [groupby],
    inverseSelection,
    metrics: ['count'],
    multiSelect: allowsMultipleValues,
    row_limit: 10000,
    showSearch: true,
    time_range: 'No filter',
    time_range_endpoints: ['inclusive', 'exclusive'],
    url_params: {},
    viz_type: 'filter_select',
    defaultValues: currentValue || defaultValue || [],
  });

  useEffect(() => {
    const newFormData = getFormData();
    if (!areObjectsEqual(formData || {}, newFormData)) {
      setFormData(newFormData);
      getChartDataRequest({
        formData: newFormData,
        force: false,
        requestParams: { dashboardId: 0 },
      }).then(response => {
        setState({ data: response.result[0].data });
        setLoading(false);
      });
    }
  }, [cascadingFilters]);

  const setExtraFormData = (extraFormData: ExtraFormData) =>
    onExtraFormDataChange(filter, extraFormData);

  if (loading) {
    return (
      <StyledLoadingBox>
        <Loading />
      </StyledLoadingBox>
    );
  }

  return (
    <Form
      onFinish={values => {
        setExtraFormData(values.value);
      }}
    >
      <Form.Item name="value">
        <SuperChart
          height={20}
          width={220}
          formData={getFormData()}
          queryData={state}
          chartType="filter_select"
          hooks={{ setExtraFormData }}
        />
      </Form.Item>
    </Form>
  );
};

export const FilterControl: React.FC<FilterProps> = ({
  filter,
  icon,
  onExtraFormDataChange,
}) => {
  const { name = '<undefined>' } = filter;
  return (
    <StyledFilterControlContainer>
      <StyledFilterControlTitleBox>
        <StyledFilterControlTitle>{name}</StyledFilterControlTitle>
        <div>{icon}</div>
      </StyledFilterControlTitleBox>
      <FilterValue
        filter={filter}
        onExtraFormDataChange={onExtraFormDataChange}
      />
    </StyledFilterControlContainer>
  );
};

interface CascadeFilterControlProps {
  filter: CascadeFilter;
  onExtraFormDataChange: (filter: Filter, extraFormData: ExtraFormData) => void;
}

export const CascadeFilterControl: React.FC<CascadeFilterControlProps> = ({
  filter,
  onExtraFormDataChange,
}) => {
  return (
    <>
      <StyledFilterControlBox>
        <StyledCaretIcon name="caret-down" />
        <FilterControl
          filter={filter}
          onExtraFormDataChange={onExtraFormDataChange}
        />
      </StyledFilterControlBox>

      <StyledCascadeChildrenList>
        {filter.cascadeChildren?.map(childFilter => (
          <li key={childFilter.id}>
            <CascadeFilterControl
              filter={childFilter}
              onExtraFormDataChange={onExtraFormDataChange}
            />
          </li>
        ))}
      </StyledCascadeChildrenList>
    </>
  );
};

const FilterBar: React.FC<FiltersBarProps> = ({
  filtersOpen,
  toggleFiltersBar,
}) => {
  const [filterData, setFilterData] = useState<{ [id: string]: ExtraFormData }>(
    {},
  );
  const setExtraFormData = useSetExtraFormData();
  const filterConfigs = useFilterConfiguration();
  const canEdit = useSelector<any, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);

  useEffect(() => {
    if (filterConfigs.length === 0 && filtersOpen) {
      toggleFiltersBar(false);
    }
  }, [filterConfigs]);

  const getFilterValue = useCallback(
    (filter: Filter): (string | number | boolean)[] | null => {
      const filters = filterData[filter.id]?.append_form_data?.filters;
      if (filters?.length) {
        const filter = filters[0];
        if ('val' in filter) {
          // need to nest these if statements to get a reference to val to appease TS
          const { val } = filter;
          if (Array.isArray(val)) {
            return val;
          }
          return [val];
        }
      }
      return null;
    },
    [filterData],
  );

  const cascadeChildren = useMemo(
    () => mapParentFiltersToChildren(filterConfigs),
    [filterConfigs],
  );

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterConfigs.map(filter => ({
      ...filter,
      currentValue: getFilterValue(filter),
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterConfigs, getFilterValue]);

  const handleExtraFormDataChange = (
    filter: Filter,
    extraFormData: ExtraFormData,
  ) => {
    setFilterData(prevFilterData => ({
      ...prevFilterData,
      [filter.id]: extraFormData,
    }));

    const children = cascadeChildren[filter.id] || [];
    // force instant updating for parent filters
    if (filter.isInstant || children.length > 0) {
      setExtraFormData(filter.id, extraFormData);
    }
  };

  const handleApply = () => {
    const filterIds = Object.keys(filterData);
    filterIds.forEach(filterId => {
      if (filterData[filterId]) {
        setExtraFormData(filterId, filterData[filterId]);
      }
    });
  };

  const handleResetAll = () => {
    setFilterData({});
    const filterIds = Object.keys(filterData);
    filterIds.forEach(filterId => {
      if (filterData[filterId]) {
        setExtraFormData(filterId, {});
      }
    });
  };

  return (
    <BarWrapper data-test="filter-bar" className={cx({ open: filtersOpen })}>
      <CollapsedBar
        className={cx({ open: !filtersOpen })}
        onClick={() => toggleFiltersBar(true)}
      >
        <Icon name="collapse" />
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
            buttonSize="sm"
            onClick={handleResetAll}
          >
            {t('Reset All')}
          </Button>
          <Button
            buttonStyle="primary"
            type="submit"
            buttonSize="sm"
            onClick={handleApply}
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
              onExtraFormDataChange={handleExtraFormDataChange}
            />
          ))}
        </FilterControls>
      </Bar>
    </BarWrapper>
  );
};

export default FilterBar;
