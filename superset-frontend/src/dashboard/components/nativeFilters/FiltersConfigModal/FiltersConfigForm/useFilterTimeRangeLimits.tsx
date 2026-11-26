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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ClientErrorObject,
  DatasourceType,
  ErrorTypeEnum,
  FeatureFlag,
  isFeatureEnabled,
  NO_TIME_RANGE,
  SupersetClient,
  type SupersetError,
} from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import {
  checkTimeRange,
  dashboardFilterLimits,
  type DatasetLimitsPayload,
  hasLimits,
  type LimitCheck,
  type Policy,
} from 'src/utils/timeRangeLimits';
import type { RootState } from 'src/dashboard/types';
import {
  FILTERS_WITH_ADHOC_FILTERS,
  limitsUnavailableMessage,
} from 'src/dashboard/components/nativeFilters/utils';
import type { NativeFiltersForm } from '../types';
import type { DashboardTimeRangeLimitsState } from '../useDashboardTimeRangeLimits';
import { timeRangeCheckMessage } from '../utils';
import { setNativeFilterFieldValues } from './utils';

export const isUnboundedRangeError = (error?: SupersetError) =>
  error?.error_type === ErrorTypeEnum.TIME_RANGE_LIMIT_ERROR &&
  error?.extra?.reason_code === 'UNBOUNDED_RANGE';

type SetErroredFilters = (f: (filters: string[]) => string[]) => void;

const addErroredFilter = (
  setErroredFilters: SetErroredFilters,
  filterId: string,
) =>
  setErroredFilters(prevErroredFilters =>
    prevErroredFilters.includes(filterId)
      ? prevErroredFilters
      : [...prevErroredFilters, filterId],
  );

/** What the dashboard's time range limits mean for the edited filter. */
export function useFilterLimitsStatus({
  timeRangeLimits,
  isChartCustomization,
  itemTypeField,
  defaultValue,
}: {
  timeRangeLimits?: DashboardTimeRangeLimitsState;
  isChartCustomization: boolean;
  itemTypeField: string;
  defaultValue: string | undefined;
}) {
  const limitsFlag = isFeatureEnabled(FeatureFlag.TimeRangeLimits);
  const isTimeRangeFilter =
    !isChartCustomization && itemTypeField === 'filter_time';
  const limitsStatus = timeRangeLimits?.status ?? 'off';
  const loadedLimits =
    timeRangeLimits?.status === 'loaded' ? timeRangeLimits.limits : undefined;
  const limitsOn = !!loadedLimits && hasLimits(loadedLimits.levels);
  const checkDefaultTimeRange = isTimeRangeFilter && limitsOn;
  const limitsLoading = isTimeRangeFilter && limitsStatus === 'loading';
  const limitsFailed = isTimeRangeFilter && limitsStatus === 'failed';
  const optionQueryHeld =
    limitsFlag &&
    !isChartCustomization &&
    FILTERS_WITH_ADHOC_FILTERS.includes(itemTypeField) &&
    (limitsStatus === 'failed' ||
      (timeRangeLimits?.status === 'loading' && !!timeRangeLimits.afterFailed));
  const optionQueryHeldRef = useRef(false);
  optionQueryHeldRef.current = optionQueryHeld;
  return {
    limitsFlag,
    loadedLimits,
    checkDefaultTimeRange,
    limitsLoading,
    limitsFailed,
    optionQueryHeld,
    optionQueryHeldRef,
    defaultRequiredByLimits:
      checkDefaultTimeRange || limitsLoading || limitsFailed,
    defaultTimeRange: isTimeRangeFilter ? defaultValue : undefined,
  };
}

/**
 * The value preview's requests with limits on: a newer request or a hold
 * makes an older answer stale, and a preview the server refuses as unbounded
 * waits for the save.
 */
export function usePreviewRequests({
  limitsFlag,
  form,
  filterId,
  setError,
  forceUpdate,
}: {
  limitsFlag: boolean;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  setError: (error: ClientErrorObject | undefined) => void;
  forceUpdate: () => void;
}) {
  const [needsSave, setNeedsSave] = useState(false);
  const fullPreviewSent = useRef(false);
  const requestId = useRef(0);
  const aborts = useRef(new Set<AbortController>());
  const wasHeld = useRef(false);

  const start = () => {
    requestId.current += 1;
    const id = requestId.current;
    const controller = limitsFlag ? new AbortController() : null;
    if (controller) {
      aborts.current.add(controller);
    }
    const isStale = () => {
      if (!controller) {
        return false;
      }
      aborts.current.delete(controller);
      return controller.signal.aborted || id !== requestId.current;
    };
    return { signal: controller?.signal, isStale };
  };

  const needsSaveError = (error: ClientErrorObject) => {
    setNativeFilterFieldValues(form, filterId, {
      defaultValueQueriesData: [],
    });
    setNeedsSave(true);
    setError(error);
    forceUpdate();
  };

  const reset = () => {
    requestId.current += 1;
    setError(undefined);
    setNeedsSave(false);
    fullPreviewSent.current = false;
  };

  const abortAll = () => {
    aborts.current.forEach(controller => controller.abort());
    aborts.current.clear();
    requestId.current += 1;
  };

  return {
    needsSave,
    setNeedsSave,
    fullPreviewSent,
    wasHeld,
    start,
    needsSaveError,
    reset,
    abortAll,
  };
}

/**
 * With limits on, the preview waits for the form's filter type, and a held
 * preview is dropped, then sent again once the hold ends.
 */
export function usePreviewHoldEffects({
  preview,
  limitsFlag,
  optionQueryHeld,
  filterType,
  hasDataset,
  datasetId,
  refreshHandler,
  setError,
}: {
  preview: ReturnType<typeof usePreviewRequests>;
  limitsFlag: boolean;
  optionQueryHeld: boolean;
  filterType: string | undefined;
  hasDataset: boolean;
  datasetId: number | undefined;
  refreshHandler: () => void;
  setError: (error: ClientErrorObject | undefined) => void;
}) {
  const { fullPreviewSent, wasHeld } = preview;
  useEffect(() => {
    if (!limitsFlag || fullPreviewSent.current || !filterType || !datasetId) {
      return;
    }
    fullPreviewSent.current = true;
    refreshHandler();
  }, [limitsFlag, filterType, datasetId, refreshHandler, fullPreviewSent]);

  useEffect(() => {
    if (optionQueryHeld) {
      preview.abortAll();
      wasHeld.current = true;
      setError(undefined);
      return;
    }
    if (!wasHeld.current) {
      return;
    }
    wasHeld.current = false;
    if (filterType && hasDataset && datasetId) {
      fullPreviewSent.current = true;
      refreshHandler();
    }
    // Only a change of the hold sends the held preview again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionQueryHeld]);
}

/**
 * Checks a Time Range filter's default against the dashboard's limits: the
 * message under the default value, its validator, and the limits the picker
 * gets.
 */
export function useDefaultTimeRangeCheck({
  status,
  form,
  filterId,
  setErroredFilters,
}: {
  status: ReturnType<typeof useFilterLimitsStatus>;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  setErroredFilters: SetErroredFilters;
}) {
  const {
    checkDefaultTimeRange,
    loadedLimits,
    limitsFailed,
    defaultTimeRange,
  } = status;
  const [defaultCheck, setDefaultCheck] = useState<LimitCheck>();
  const defaultCheckRequest = useRef<{
    timeRange: string;
    check: Promise<LimitCheck>;
  }>();
  const defaultValuePath = useMemo<['filters', string, 'defaultDataMask']>(
    () => ['filters', filterId, 'defaultDataMask'],
    [filterId],
  );

  useEffect(() => {
    if (!checkDefaultTimeRange || !loadedLimits) {
      defaultCheckRequest.current = undefined;
      return undefined;
    }
    const timeRange = defaultTimeRange || NO_TIME_RANGE;
    const request = {
      timeRange,
      check: checkTimeRange(timeRange, loadedLimits.levels),
    };
    defaultCheckRequest.current = request;
    let current = true;
    request.check.then(check => {
      if (!current) {
        return;
      }
      setDefaultCheck(check);
      if (defaultTimeRange || form.getFieldError(defaultValuePath).length) {
        form.validateFields([defaultValuePath]);
      }
    });
    return () => {
      current = false;
    };
  }, [
    checkDefaultTimeRange,
    defaultTimeRange,
    defaultValuePath,
    form,
    loadedLimits,
  ]);

  useEffect(() => {
    if (limitsFailed) {
      form.validateFields([defaultValuePath]);
    }
  }, [defaultValuePath, form, limitsFailed]);

  const checkStoredTimeRange = (timeRange: string) =>
    defaultCheckRequest.current?.timeRange === timeRange
      ? defaultCheckRequest.current.check
      : checkTimeRange(timeRange, loadedLimits?.levels ?? []);

  let defaultValueMessage: string | undefined;
  if (limitsFailed) {
    defaultValueMessage = limitsUnavailableMessage();
  } else if (
    checkDefaultTimeRange &&
    defaultTimeRange &&
    defaultCheck?.timeRange === defaultTimeRange
  ) {
    defaultValueMessage = timeRangeCheckMessage(defaultCheck);
  }
  // antd's help replaces every error of the item, so it is set only while
  // the limits message shows.
  const defaultValueErrorId = `${filterId}-default-value-error`;
  const defaultValueHelp =
    checkDefaultTimeRange && defaultValueMessage ? (
      <span id={defaultValueErrorId} role="alert">
        {defaultValueMessage}
      </span>
    ) : undefined;
  let pickerLimits: typeof loadedLimits;
  if (checkDefaultTimeRange && loadedLimits) {
    pickerLimits = defaultValueHelp
      ? { ...loadedLimits, describedBy: defaultValueErrorId }
      : loadedLimits;
  }

  /** The validator's answer while the limits can't be loaded. */
  const rejectLimitsFailed = () => {
    addErroredFilter(setErroredFilters, filterId);
    return Promise.reject(new Error(limitsUnavailableMessage()));
  };

  /** The validator's check of a set default against the limits. */
  const validateDefaultTimeRange = () => {
    const timeRange = form.getFieldValue(defaultValuePath)?.filterState?.value;
    return checkStoredTimeRange(timeRange || NO_TIME_RANGE).then(check => {
      const message = timeRangeCheckMessage(check);
      if (!message) {
        // The field still holds its error from the last check.
        const otherFieldsError = form
          .getFieldsError()
          .filter(f => f.name.join() !== defaultValuePath.join());
        setErroredFilters(prevErroredFilters => {
          if (
            prevErroredFilters.length &&
            !otherFieldsError.some(f => f.errors.length > 0)
          ) {
            return [];
          }
          return prevErroredFilters;
        });
        return;
      }
      addErroredFilter(setErroredFilters, filterId);
      throw new Error(message);
    });
  };

  return {
    defaultCheck,
    defaultValueMessage,
    defaultValueHelp,
    pickerLimits,
    rejectLimitsFailed,
    validateDefaultTimeRange,
  };
}

/**
 * The "Pre-filter available values" time range under the limits the filter's
 * option query is checked against: the global and dashboard limits and those
 * of the filter's own dataset. The dashboard's limits list only its charts'
 * datasets, so the policy of a table only a filter uses is read from
 * `GET /api/v1/dataset/{id}/time_range_limits/`. The picker gets the limits,
 * and the validator checks the chosen range as the Default value of a Time
 * Range filter is checked; while that policy can't be loaded it refuses.
 */
export function usePreFilterTimeRangeCheck({
  status,
  form,
  filterId,
  datasetId,
  datasourceType,
}: {
  status: ReturnType<typeof useFilterLimitsStatus>;
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  datasetId: number | string | undefined;
  datasourceType: DatasourceType;
}) {
  const [message, setMessage] = useState<string>();
  const [fetched, setFetched] = useState<Record<number, Policy | null>>({});
  const datasetRequest = useRef<{
    id: number;
    policy: Promise<Policy | null>;
  }>();
  const payload = useSelector(
    (state: RootState) => state.timeRangeLimits.payload,
  );
  const { loadedLimits } = status;
  const ready = !!loadedLimits && !!payload;
  const id = Number(datasetId);
  const tableId =
    datasourceType === DatasourceType.Table && Number.isInteger(id)
      ? id
      : undefined;
  const listed =
    tableId === undefined ||
    !!payload?.datasets?.some(dataset => dataset.id === tableId);
  const listedFailed = !!payload?.datasets?.some(
    dataset => dataset.id === tableId && dataset.error,
  );
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const scopedLimits = (tablePolicy: Policy | null) => {
    if (!loadedLimits || !payload) {
      return undefined;
    }
    let datasets = payload.datasets ?? [];
    if (!listed) {
      datasets =
        tablePolicy && tableId !== undefined
          ? [{ id: tableId, name: '', policy: tablePolicy }]
          : [];
    }
    const scoped = dashboardFilterLimits(
      { ...payload, datasets },
      loadedLimits.dashboardId,
      new Set(tableId === undefined ? [] : [tableId]),
    );
    return hasLimits(scoped.levels) ? scoped : undefined;
  };

  const datasetPolicy = (table: number) => {
    if (datasetRequest.current?.id !== table) {
      const request = SupersetClient.get({
        endpoint: `/api/v1/dataset/${table}/time_range_limits/`,
      }).then(({ json }) => {
        const policy =
          (json as { result?: Partial<DatasetLimitsPayload> }).result
            ?.dataset ?? null;
        if (mounted.current) {
          setFetched(previous => ({ ...previous, [table]: policy }));
        }
        return policy;
      });
      request.catch(() => {
        if (datasetRequest.current?.policy === request) {
          datasetRequest.current = undefined;
        }
      });
      datasetRequest.current = { id: table, policy: request };
    }
    return datasetRequest.current.policy;
  };

  useEffect(() => {
    if (ready && !listed && tableId !== undefined) {
      datasetPolicy(tableId).catch(() => undefined);
    }
  }, [ready, listed, tableId]);

  const limits = useMemo(() => {
    if (!ready || listedFailed) {
      return undefined;
    }
    if (listed) {
      return scopedLimits(null);
    }
    return tableId !== undefined && tableId in fetched
      ? scopedLimits(fetched[tableId])
      : undefined;
  }, [ready, listed, listedFailed, tableId, fetched, payload, loadedLimits]);
  const errorId = `${filterId}-pre-filter-time-range-error`;
  const timeRangePath: ['filters', string, 'time_range'] = [
    'filters',
    filterId,
    'time_range',
  ];

  const validatePreFilterTimeRange = () => {
    const timeRange = form.getFieldValue(timeRangePath);
    if (!ready || !timeRange || timeRange === NO_TIME_RANGE) {
      setMessage(undefined);
      return Promise.resolve();
    }
    let scoped: Promise<ReturnType<typeof scopedLimits>>;
    if (listedFailed) {
      scoped = Promise.reject(new Error(limitsUnavailableMessage()));
    } else if (listed || tableId === undefined) {
      scoped = Promise.resolve(scopedLimits(null));
    } else {
      scoped = datasetPolicy(tableId).then(scopedLimits);
    }
    return scoped
      .then(
        found =>
          found
            ? checkTimeRange(timeRange, found.levels).then(
                timeRangeCheckMessage,
              )
            : undefined,
        () => limitsUnavailableMessage(),
      )
      .then(next => {
        if (form.getFieldValue(timeRangePath) === timeRange) {
          setMessage(next);
        }
        if (next) {
          throw new Error(next);
        }
      });
  };

  useEffect(() => {
    const timeRange = form.getFieldValue(timeRangePath);
    if (limits && timeRange && timeRange !== NO_TIME_RANGE) {
      form.validateFields([timeRangePath]).catch(() => undefined);
    }
  }, [limits, filterId]);

  const shown = ready ? message : undefined;
  return {
    preFilterPickerLimits:
      limits && shown ? { ...limits, describedBy: errorId } : limits,
    preFilterTimeRangeHelp: shown ? (
      <span id={errorId} role="alert">
        {shown}
      </span>
    ) : undefined,
    validatePreFilterTimeRange,
  };
}
