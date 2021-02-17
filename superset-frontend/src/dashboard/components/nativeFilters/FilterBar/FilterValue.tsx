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
import React, { useEffect, useRef, useState } from 'react';
import {
  ExtraFormData,
  QueryFormData,
  styled,
  SuperChart,
  t,
} from '@superset-ui/core';
import { areObjectsEqual } from 'src/reduxUtils';
import { getChartDataRequest } from 'src/chart/chartAction';
import Loading from 'src/components/Loading';
import BasicErrorAlert from 'src/components/ErrorMessage/BasicErrorAlert';
import { CurrentFilterState } from 'src/dashboard/reducers/types';
import { FilterProps } from './types';
import { getFormData } from '../utils';
import { useCascadingFilters, useFilterState } from './state';

const StyledLoadingBox = styled.div`
  position: relative;
  height: ${({ theme }) => theme.gridUnit * 8}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 6}px;
`;

const FilterItem = styled.div`
  padding-bottom: 10px;
`;

const FilterValue: React.FC<FilterProps> = ({
  filter,
  directPathToChild,
  onFilterSelectionChange,
}) => {
  const { id, targets, filterType } = filter;
  const cascadingFilters = useCascadingFilters(id);
  const filterState = useFilterState(id);
  const [state, setState] = useState([]);
  const [error, setError] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<QueryFormData>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [target] = targets;
  const {
    datasetId,
    column = {},
  }: Partial<{ datasetId: number; column: { name?: string } }> = target;
  const { name: groupby } = column;
  const currentValue = filterState.currentState?.value;
  const hasDataSource = !!(datasetId && groupby);
  const [loading, setLoading] = useState<boolean>(hasDataSource);
  useEffect(() => {
    const newFormData = getFormData({
      ...filter,
      datasetId,
      cascadingFilters,
      groupby,
      currentValue,
      inputRef,
    });
    if (!areObjectsEqual(formData || {}, newFormData)) {
      setFormData(newFormData);
      if (!hasDataSource) {
        return;
      }
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
  }, [cascadingFilters, datasetId, groupby, filter.defaultValue, currentValue]);

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
        // For charts that don't have datasource we need workaround for empty placeholder
        queriesData={hasDataSource ? state : [{ data: [null] }]}
        chartType={filterType}
        // @ts-ignore (update superset-ui)
        hooks={{ setExtraFormData }}
      />
    </FilterItem>
  );
};

export default FilterValue;
