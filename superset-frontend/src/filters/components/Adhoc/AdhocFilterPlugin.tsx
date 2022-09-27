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
import {
  AppSection,
  DataMask,
  DataRecordValue,
  ensureIsArray,
  ExtraFormData,
  GenericDataType,
  getColumnLabel,
  JsonObject,
  JsonResponse,
  QueryFormColumn,
  smartDateDetailedFormatter,
  SupersetApiError,
  SupersetClient,
  t,
  tn,
} from '@superset-ui/core';
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import debounce from 'lodash/debounce';
// eslint-disable-next-line import/no-unresolved
import { SLOW_DEBOUNCE } from 'src/constants';
import { useImmerReducer } from 'use-immer';
import { propertyComparator } from 'src/components/Select/Select';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
// eslint-disable-next-line import/no-unresolved
import { addDangerToast } from 'src/components/MessageToasts/actions';
// eslint-disable-next-line import/no-unresolved
import { cacheWrapper } from 'src/utils/cacheWrapper';
// eslint-disable-next-line import/no-unresolved
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
// eslint-disable-next-line import/no-unresolved
import { useChangeEffect } from 'src/hooks/useChangeEffect';
import { PluginFilterAdhocProps, SelectValue } from './types';
import { StyledFormItem, FilterPluginStyle, StatusMessage } from '../common';
import { getDataRecordFormatter, getAdhocExtraFormData } from '../../utils';

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      __cache: JsonObject;
      extraFormData: ExtraFormData;
      filterState: {
        label?: string;
        filters?: AdhocFilter[];
        value: AdhocFilter[];
      };
    };

function reducer(
  draft: DataMask & { __cache?: JsonObject },
  action: DataMaskAction,
) {
  switch (action.type) {
    case 'ownState':
      draft.ownState = {
        ...draft.ownState,
        ...action.ownState,
      };
      return draft;
    case 'filterState':
      draft.extraFormData = action.extraFormData;
      // eslint-disable-next-line no-underscore-dangle
      draft.__cache = action.__cache;
      draft.filterState = { ...draft.filterState, ...action.filterState };
      return draft;
    default:
      return draft;
  }
}

export default function PluginFilterAdhoc(props: PluginFilterAdhocProps) {
  const {
    coltypeMap,
    data,
    filterState,
    formData,
    height,
    isRefreshing,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    appSection,
    showOverflow,
    parentRef,
    inputRef,
  } = props;
  const {
    enableEmptyFilter,
    multiSelect,
    showSearch,
    inverseSelection,
    defaultToFirstItem,
    searchAllOptions,
  } = formData;
  const groupby = useMemo(
    () => ensureIsArray(formData.groupby).map(getColumnLabel),
    [formData.groupby],
  );
  const datasetId = useMemo(
    () => formData.datasource.split('_')[0],
    [formData.datasource],
  );
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();
  const [col, setCol] = useState('');
  console.log(formData.columns);
  const [columns, setColumns] = useState();
  const [initialColtypeMap] = useState(coltypeMap);
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const datatype: GenericDataType = coltypeMap[col];
  const labelFormatter = useMemo(
    () =>
      getDataRecordFormatter({
        timeFormatter: smartDateDetailedFormatter,
      }),
    [],
  );

  const localCache = new Map<string, any>();

  const cachedSupersetGet = cacheWrapper(
    SupersetClient.get,
    localCache,
    ({ endpoint }) => endpoint || '',
  );

  useChangeEffect(datasetId, () => {
    if (datasetId) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      })
        .then((response: JsonResponse) => {
          const dataset = response.json?.result;
          // modify the response to fit structure expected by AdhocFilterControl
          dataset.type = dataset.datasource_type;
          dataset.filter_select = true;
          setDatasetDetails(dataset);
        })
        .catch((response: SupersetApiError) => {
          addDangerToast(response.message);
        });
    }
  });

  useChangeEffect(datasetId, () => {
    if (datasetId != null) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      }).then(
        ({ json: { result } }) => {
          setColumns(result.columns);
        },
        async badResponse => {
          const { error, message } = await getClientErrorObject(badResponse);
          let errorText = message || error || t('An error has occurred');
          if (message === 'Forbidden') {
            errorText = t('You do not have permission to edit this dashboard');
          }
          addDangerToast(errorText);
        },
      );
    }
  });

  const updateDataMask = useCallback(
    (adhoc_filters: AdhocFilter[]) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !adhoc_filters?.length;

      dispatchDataMask({
        type: 'filterState',
        __cache: filterState,
        extraFormData: getAdhocExtraFormData(
          adhoc_filters,
          emptyFilter,
          inverseSelection,
        ),
        filterState: {
          ...filterState,
          label: (adhoc_filters || []).map(f => String(f.subject)).join(', '),
          value: adhoc_filters,
          filters: adhoc_filters,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      appSection,
      col,
      datatype,
      defaultToFirstItem,
      dispatchDataMask,
      enableEmptyFilter,
      inverseSelection,
      JSON.stringify(filterState),
      labelFormatter,
    ],
  );

  useEffect(() => {
    updateDataMask(filterState.value);
  }, [JSON.stringify(filterState.value)]);

  const isDisabled =
    appSection === AppSection.FILTER_CONFIG_MODAL && defaultToFirstItem;

  const debouncedOwnStateFunc = useCallback(
    debounce((val: string) => {
      dispatchDataMask({
        type: 'ownState',
        ownState: {
          coltypeMap: initialColtypeMap,
          search: val,
        },
      });
    }, SLOW_DEBOUNCE),
    [],
  );

  const searchWrapper = useCallback(
    (val: string) => {
      if (searchAllOptions) {
        debouncedOwnStateFunc(val);
      }
    },
    [debouncedOwnStateFunc, searchAllOptions],
  );

  const clearSuggestionSearch = useCallback(() => {
    if (searchAllOptions) {
      dispatchDataMask({
        type: 'ownState',
        ownState: {
          coltypeMap: initialColtypeMap,
          search: null,
        },
      });
    }
  }, [dispatchDataMask, initialColtypeMap, searchAllOptions]);

  const handleBlur = useCallback(() => {
    clearSuggestionSearch();
    unsetFocusedFilter();
  }, [clearSuggestionSearch, unsetFocusedFilter]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  const placeholderText =
    data.length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);

  const formItemExtra = useMemo(() => {
    if (filterState.validateMessage) {
      return (
        <StatusMessage status={filterState.validateStatus}>
          {filterState.validateMessage}
        </StatusMessage>
      );
    }
    return undefined;
  }, [filterState.validateMessage, filterState.validateStatus]);

  const options = useMemo(() => {
    const options: { label: string; value: DataRecordValue }[] = [];
    data.forEach(row => {
      const [value] = groupby.map(col => row[col]);
      options.push({
        label: labelFormatter(value, datatype),
        value,
      });
    });
    return options;
  }, [data, datatype, groupby, labelFormatter]);

  const sortComparator = useCallback(
    (a: AntdLabeledValue, b: AntdLabeledValue) => {
      const labelComparator = propertyComparator('label');
      if (formData.sortAscending) {
        return labelComparator(a, b);
      }
      return labelComparator(b, a);
    },
    [formData.sortAscending],
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        extra={formItemExtra}
      >
        <AdhocFilterControl
          columns={columns || []}
          savedMetrics={[]}
          datasource={datasetDetails}
          onChange={(filters: AdhocFilter[]) => {
            // New Adhoc Filters Selected
            updateDataMask(filters);
          }}
          label={' '}
          value={filterState.filters || []}
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
