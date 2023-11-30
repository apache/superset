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
import React, { FunctionComponent, useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { DataMask, Filter, isFilterDivider } from '@superset-ui/core';
import { Select } from 'src/components';
import { useDashboard } from 'src/hooks/apiResources';
import {
  useFilters,
  useNativeFiltersDataMask,
} from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { setDashboardNativeFilter } from 'src/dashboard/actions/nativeFilters';
import FilterValue from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterValue';
import { setDataMaskForReport } from 'src/dataMask/actions';
import { StyledInputContainer } from '../AlertReportModal';

interface DashboardFiltersAndTabsProps {
  dashboardId: number | string;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
  onTabSelectionChange: (tabId: string) => void;
}

// Dashboard Filters and Tabs
export const DashboardFiltersAndTabs: FunctionComponent<DashboardFiltersAndTabsProps> =
  ({ dashboardId, onFilterSelectionChange, onTabSelectionChange }) => {
    const dispatch = useDispatch();
    const { result: dashboard } = useDashboard(dashboardId);
    const [selectedDashboardFilters, setSelectedDashboardFilters] =
      useState<string>();
    const dataMaskApplied = useNativeFiltersDataMask();
    const filters = useFilters();
    const filterValues = useMemo(() => Object.values(filters), [filters]);
    const filterWithDataMask: Filter | undefined = useMemo(() => {
      const selectFilter = filterValues.find(
        filter =>
          filter.id === selectedDashboardFilters && !isFilterDivider(filter),
      ) as Filter | undefined;
      if (selectFilter) {
        return {
          ...selectFilter,
          dataMask: dataMaskApplied[selectFilter.id],
        };
      }
      return undefined;
    }, [filterValues, dataMaskApplied, selectedDashboardFilters]);
    const dashboardFilterOptions = useMemo(
      () =>
        filterValues.map(filter => ({
          label: filter.name,
          value: filter.id,
        })),
      [filterValues],
    );
    const readyToRender = Boolean(dashboard);
    useEffect(() => {
      if (readyToRender) {
        dispatch(
          setDashboardNativeFilter(
            dashboard?.metadata?.native_filter_configuration,
          ),
        );
        if (dashboard?.metadata) {
          dispatch(setDataMaskForReport(dashboard?.metadata, {}));
        }
      }
    }, [readyToRender, dashboardId]);

    const allTabsNames: any[] = [];
    const layout = dashboard?.position_data;
    const rootChildId = dashboard?.position_data[DASHBOARD_ROOT_ID].children[0];
    const getAllTabsName = node => {
      if (node.type !== 'TAB' && node.type !== 'TABS') {
        return;
      }
      const label = node?.meta?.text || node?.meta?.defaultText;
      if (label) {
        allTabsNames.push({
          label,
          value: node.id,
        });
      }
      if (node.children) {
        node.children.forEach((childId: string) => {
          getAllTabsName(layout[childId]);
        });
      }
    };
    if (layout) {
      getAllTabsName(layout[rootChildId]);
    }

    return (
      <>
        {dataMaskApplied && dashboardFilterOptions.length ? (
          <StyledInputContainer>
            <div className="control-label">Dashboard filter</div>
            <Select
              onChange={value => setSelectedDashboardFilters(value)}
              options={dashboardFilterOptions}
            />
            {filterWithDataMask ? (
              <>
                <div className="control-label">value</div>
                <FilterValue
                  dataMaskSelected={dataMaskApplied}
                  filter={filterWithDataMask}
                  onFilterSelectionChange={onFilterSelectionChange}
                />
              </>
            ) : null}
          </StyledInputContainer>
        ) : null}
        {allTabsNames.length > 0 && (
          <StyledInputContainer>
            <div className="control-label">Select Tab</div>
            <Select onChange={onTabSelectionChange} options={allTabsNames} />
          </StyledInputContainer>
        )}
      </>
    );
  };
