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
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';
import { Form } from 'src/common/components';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';
import FilterConfigurationLink from './FilterConfigurationLink';
// import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';

import {
  useCascadingFilters,
  useFilterConfiguration,
  useSetExtraFormData,
} from './state';
import { Filter } from './types';
import { getChartDataRequest } from '../../../chart/chartAction';
import { areObjectsEqual } from '../../../reduxUtils';

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
  height: 100%;
  max-height: 100%;
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

interface FilterProps {
  filter: Filter;
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
  const { id } = filter;
  const cascadingFilters = useCascadingFilters(id);
  const [state, setState] = useState({ data: undefined });
  const [formData, setFormData] = useState<Partial<QueryFormData>>({});
  const { allowsMultipleValues, inverseSelection, targets } = filter;
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
      });
    }
  }, [cascadingFilters]);

  const setExtraFormData = (extraFormData: ExtraFormData) =>
    onExtraFormDataChange(filter, extraFormData);

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

const FilterControl: React.FC<FilterProps> = ({
  filter,
  onExtraFormDataChange,
}) => {
  const { name = '<undefined>' } = filter;
  return (
    <div>
      <h3>{name}</h3>
      <FilterValue
        filter={filter}
        onExtraFormDataChange={onExtraFormDataChange}
      />
    </div>
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

  useEffect(() => {
    if (filterConfigs.length === 0 && filtersOpen) {
      toggleFiltersBar(false);
    }
  }, [filterConfigs]);

  const handleExtraFormDataChange = (
    filter: Filter,
    extraFormData: ExtraFormData,
  ) => {
    setFilterData(prevFilterData => ({
      ...prevFilterData,
      [filter.id]: extraFormData,
    }));

    if (filter.isInstant) {
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

  return (
    <BarWrapper data-test="filter-bar" className={cx({ open: filtersOpen })}>
      <CollapsedBar
        className={cx({ open: !filtersOpen })}
        onClick={toggleFiltersBar}
      >
        <Icon name="filter" />
        <Icon name="collapse" />
      </CollapsedBar>
      <Bar className={cx({ open: filtersOpen })}>
        <TitleArea>
          <span>
            {t('Filters')} ({filterConfigs.length})
          </span>
          {canEdit && (
            <FilterConfigurationLink createNewOnOpen>
              <Icon name="edit" data-test="create-filter" />
            </FilterConfigurationLink>
          )}
          <Icon name="expand" onClick={toggleFiltersBar} />
        </TitleArea>
        <ActionButtons>
          <Button
            buttonStyle="primary"
            type="submit"
            buttonSize="sm"
            onClick={handleApply}
          >
            {t('Apply')}
          </Button>
          <Button buttonStyle="secondary" buttonSize="sm">
            {t('Reset All')}
          </Button>
        </ActionButtons>
        <FilterControls>
          {filterConfigs.map(filter => (
            <FilterControl
              data-test="filters-control"
              key={filter.id}
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
