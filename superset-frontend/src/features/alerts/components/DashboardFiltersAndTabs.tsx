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
import {
  DataMask,
  DataMaskStateWithId,
  DataMaskWithId,
  Filter,
  isFilterDivider,
} from '@superset-ui/core';
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
import { getInitialDataMask } from 'src/dataMask/reducer';
import { DashboardPermalinkState } from 'src/dashboard/types';
import { StyledInputContainer } from '../AlertReportModal';

interface DashboardFiltersAndTabsProps {
  dashboardId: number | string;
  onFilterSelectionChange: (dataMask: DataMask) => void;
  onTabSelectionChange: (tabId: string) => void;
  extra?: DashboardPermalinkState;
}

// Dashboard Filters and Tabs
export const DashboardFiltersAndTabs: FunctionComponent<DashboardFiltersAndTabsProps> =
  ({ dashboardId, onFilterSelectionChange, onTabSelectionChange, extra }) => {
    const dispatch = useDispatch();
    const { result: dashboard } = useDashboard(dashboardId);
    const [selectedDashboardFilter, setSelectedDashboardFilter] = useState<any>(
      extra?.dataMask?.id,
    );
    const dataMaskApplied = useNativeFiltersDataMask();
    const [dataMaskSelected, setDataMaskSelected] =
      useState<DataMaskStateWithId>(dataMaskApplied);
    const filters = useFilters();
    const filterValues = useMemo(() => Object.values(filters), [filters]);
    const filterWithDataMask: Filter | undefined = useMemo(() => {
      const selectFilter = filterValues.find(
        filter =>
          filter.id === selectedDashboardFilter && !isFilterDivider(filter),
      ) as Filter | undefined;
      if (selectFilter) {
        return {
          ...selectFilter,
          dataMask: dataMaskSelected[selectFilter.id],
        };
      }
      return undefined;
    }, [filterValues, dataMaskSelected, selectedDashboardFilter]);
    const dashboardFilterOptions = useMemo(
      () =>
        filterValues.map(filter => ({
          label: filter.name,
          value: filter.id,
        })),
      [filterValues],
    );
    const handleFilterSelectionChange = (
      filter: Pick<Filter, 'id'> & Partial<Filter>,
      dataMask: Partial<DataMask>,
    ) => {
      dataMaskSelected[filter.id] = {
        ...(getInitialDataMask(filter.id) as DataMaskWithId),
        ...dataMask,
      };
      setDataMaskSelected({ ...dataMaskSelected });
      onFilterSelectionChange(dataMaskSelected);
    };

    const readyToRender = Boolean(dashboard);
    useEffect(() => {
      if (readyToRender) {
        dispatch(
          setDashboardNativeFilter(
            dashboard?.metadata?.native_filter_configuration,
          ),
        );

        if (dashboard?.metadata) {
          dispatch(
            setDataMaskForReport(dashboard?.metadata, extra?.dataMask || {}),
          );
        }
      }
    }, [readyToRender, dashboardId, dispatch, extra]);

    const allTabsNames: any[] = [];
    const layout = dashboard?.position_data;
    const rootChildId = dashboard?.position_data[DASHBOARD_ROOT_ID].children[0];
    const getAllTabsName = (node: any) => {
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
    console.log('extra', extra);
    return (
      <>
        {dataMaskSelected && dashboardFilterOptions.length ? (
          <StyledInputContainer>
            <div className="control-label">Dashboard filter</div>
            <Select
              onChange={setSelectedDashboardFilter}
              options={dashboardFilterOptions}
            />
            {filterWithDataMask ? (
              <>
                <div className="control-label">value</div>
                <FilterValue
                  dataMaskSelected={dataMaskSelected}
                  filter={filterWithDataMask}
                  onFilterSelectionChange={handleFilterSelectionChange}
                />
              </>
            ) : null}
          </StyledInputContainer>
        ) : null}
        {allTabsNames.length > 0 && (
          <StyledInputContainer>
            <div className="control-label">Select Tab</div>
            <Select
              value={(extra?.activeTabs || [])[0]}
              onChange={onTabSelectionChange}
              options={allTabsNames}
            />
          </StyledInputContainer>
        )}
      </>
    );
  };
