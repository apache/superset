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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  QueryFormData,
  SuperChart,
  DataMask,
  t,
  styled,
  Behavior,
  ChartDataResponseResult,
  JsonObject,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual, isEqualWith } from 'lodash';
import { getChartDataRequest } from 'src/chart/chartAction';
import Loading from 'src/components/Loading';
import BasicErrorAlert from 'src/components/ErrorMessage/BasicErrorAlert';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import { RootState } from 'src/dashboard/types';
import { dispatchFocusAction } from './utils';
import { FilterProps } from './types';
import { getFormData } from '../../utils';
import { useCascadingFilters } from './state';
import { checkIsMissingRequiredValue } from '../utils';

const HEIGHT = 32;

// Overrides superset-ui height with min-height
const StyledDiv = styled.div`
  & > div {
    height: auto !important;
    min-height: ${HEIGHT}px;
  }
`;

const queriesDataPlaceholder = [{ data: [{}] }];
const behaviors = [Behavior.NATIVE_FILTER];

const FilterValue: React.FC<FilterProps> = ({
  dataMaskSelected,
  filter,
  directPathToChild,
  onFilterSelectionChange,
  inView = true,
  showOverflow,
  parentRef,
}) => {
  const { id, targets, filterType, adhoc_filters, time_range } = filter;
  const metadata = getChartMetadataRegistry().get(filterType);
  const cascadingFilters = useCascadingFilters(id, dataMaskSelected);
  const isDashboardRefreshing = useSelector<RootState, boolean>(
    state => state.dashboardState.isRefreshing,
  );
  const [state, setState] = useState<ChartDataResponseResult[]>([]);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Partial<QueryFormData>>({
    inView: false,
  });
  const [ownState, setOwnState] = useState<JsonObject>({});
  const [inViewFirstTime, setInViewFirstTime] = useState(inView);
  const inputRef = useRef<HTMLInputElement>(null);
  const [target] = targets;
  const {
    datasetId,
    column = {},
  }: Partial<{ datasetId: number; column: { name?: string } }> = target;
  const { name: groupby } = column;
  const hasDataSource = !!datasetId;
  const [isLoading, setIsLoading] = useState<boolean>(hasDataSource);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!inViewFirstTime && inView) {
      setInViewFirstTime(true);
    }
  }, [inView, inViewFirstTime, setInViewFirstTime]);

  useEffect(() => {
    if (!inViewFirstTime) {
      return;
    }
    const newFormData = getFormData({
      ...filter,
      datasetId,
      cascadingFilters,
      groupby,
      inputRef,
      adhoc_filters,
      time_range,
    });
    const filterOwnState = filter.dataMask?.ownState || {};
    // TODO: We should try to improve our useEffect hooks to depend more on
    // granular information instead of big objects that require deep comparison.
    const customizer = (
      objValue: Partial<QueryFormData>,
      othValue: Partial<QueryFormData>,
      key: string,
    ) => (key === 'url_params' ? true : undefined);
    if (
      !isRefreshing &&
      (!isEqualWith(formData, newFormData, customizer) ||
        !isEqual(ownState, filterOwnState) ||
        isDashboardRefreshing)
    ) {
      setFormData(newFormData);
      setOwnState(filterOwnState);
      if (!hasDataSource) {
        return;
      }
      setIsRefreshing(true);
      getChartDataRequest({
        formData: newFormData,
        force: false,
        requestParams: { dashboardId: 0 },
        ownState: filterOwnState,
      })
        .then(({ response, json }) => {
          if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
            // deal with getChartDataRequest transforming the response data
            const result = 'result' in json ? json.result[0] : json;

            if (response.status === 200) {
              setIsRefreshing(false);
              setIsLoading(false);
              setState([result]);
            } else if (response.status === 202) {
              waitForAsyncData(result)
                .then((asyncResult: ChartDataResponseResult[]) => {
                  setIsRefreshing(false);
                  setIsLoading(false);
                  setState(asyncResult);
                })
                .catch((error: ClientErrorObject) => {
                  setError(
                    error.message || error.error || t('Check configuration'),
                  );
                  setIsRefreshing(false);
                  setIsLoading(false);
                });
            } else {
              throw new Error(
                `Received unexpected response status (${response.status}) while fetching chart data`,
              );
            }
          } else {
            setState(json.result);
            setError('');
            setIsRefreshing(false);
            setIsLoading(false);
          }
        })
        .catch((error: Response) => {
          setError(error.statusText);
          setIsRefreshing(false);
          setIsLoading(false);
        });
    }
  }, [
    inViewFirstTime,
    cascadingFilters,
    datasetId,
    groupby,
    JSON.stringify(filter),
    hasDataSource,
    isRefreshing,
    isDashboardRefreshing,
  ]);

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

  const setDataMask = useCallback(
    (dataMask: DataMask) => onFilterSelectionChange(filter, dataMask),
    [filter, onFilterSelectionChange],
  );

  const setFocusedFilter = useCallback(
    () => dispatchFocusAction(dispatch, id),
    [dispatch, id],
  );
  const unsetFocusedFilter = useCallback(() => dispatchFocusAction(dispatch), [
    dispatch,
  ]);

  const hooks = useMemo(
    () => ({ setDataMask, setFocusedFilter, unsetFocusedFilter }),
    [setDataMask, setFocusedFilter, unsetFocusedFilter],
  );

  const isMissingRequiredValue = checkIsMissingRequiredValue(
    filter,
    filter.dataMask?.filterState,
  );

  const filterState = useMemo(
    () => ({
      ...filter.dataMask?.filterState,
      validateStatus: isMissingRequiredValue && 'error',
    }),
    [filter.dataMask?.filterState, isMissingRequiredValue],
  );

  if (error) {
    return (
      <BasicErrorAlert
        title={t('Cannot load filter')}
        body={error}
        level="error"
      />
    );
  }

  return (
    <StyledDiv data-test="form-item-value">
      {isLoading ? (
        <Loading position="inline-centered" />
      ) : (
        <SuperChart
          height={HEIGHT}
          width="100%"
          showOverflow={showOverflow}
          formData={formData}
          parentRef={parentRef}
          // For charts that don't have datasource we need workaround for empty placeholder
          queriesData={hasDataSource ? state : queriesDataPlaceholder}
          chartType={filterType}
          behaviors={behaviors}
          filterState={filterState}
          ownState={filter.dataMask?.ownState}
          enableNoResults={metadata?.enableNoResults}
          isRefreshing={isRefreshing}
          hooks={hooks}
        />
      )}
    </StyledDiv>
  );
};
export default FilterValue;
