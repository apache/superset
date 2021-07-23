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
  ensureIsArray,
  ExtraFormData,
  GenericDataType,
  JsonObject,
  smartDateDetailedFormatter,
  t,
} from '@superset-ui/core';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Select } from 'src/components';
import debounce from 'lodash/debounce';
import { SLOW_DEBOUNCE } from 'src/constants';
import { useImmerReducer } from 'use-immer';
import { FormItemProps } from 'antd/lib/form';
import { PluginFilterSelectProps, SelectValue } from './types';
import { StyledFormItem, FilterPluginStyle, StatusMessage } from '../common';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      __cache: JsonObject;
      extraFormData: ExtraFormData;
      filterState: { value: SelectValue; label?: string };
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

export default function PluginFilterSelect(props: PluginFilterSelectProps) {
  const {
    coltypeMap,
    filterState,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    loadData,
    appSection,
  } = props;
  const {
    enableEmptyFilter,
    multiSelect,
    showSearch,
    inverseSelection,
    inputRef,
    defaultToFirstItem,
    searchAllOptions,
  } = formData;
  const groupby = ensureIsArray<string>(formData.groupby);
  const [col] = groupby;
  const [initialColtypeMap] = useState(coltypeMap);
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });

  const updateDataMask = useCallback(
    (values: SelectValue) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !values?.length;

      const suffix =
        inverseSelection && values?.length ? ` (${t('excluded')})` : '';

      dispatchDataMask({
        type: 'filterState',
        __cache: filterState,
        extraFormData: getSelectExtraFormData(
          col,
          values,
          emptyFilter,
          inverseSelection,
        ),
        filterState: {
          ...filterState,
          label: values?.length
            ? `${(values || []).join(', ')}${suffix}`
            : undefined,
          value:
            appSection === AppSection.FILTER_CONFIG_MODAL && defaultToFirstItem
              ? undefined
              : values,
        },
      });
    },
    [
      appSection,
      col,
      defaultToFirstItem,
      dispatchDataMask,
      enableEmptyFilter,
      inverseSelection,
      JSON.stringify(filterState),
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

  const searchWrapper = (val: string) => {
    if (searchAllOptions) {
      debouncedOwnStateFunc(val);
    }
  };

  const clearSuggestionSearch = () => {
    if (searchAllOptions) {
      dispatchDataMask({
        type: 'ownState',
        ownState: {
          coltypeMap: initialColtypeMap,
          search: null,
        },
      });
    }
  };

  const handleBlur = () => {
    clearSuggestionSearch();
    unsetFocusedFilter();
  };

  const datatype: GenericDataType = coltypeMap[col];
  const labelFormatter = useMemo(
    () =>
      getDataRecordFormatter({
        timeFormatter: smartDateDetailedFormatter,
      }),
    [],
  );

  const handleChange = (value?: [{ value: string | number }]) => {
    const values = ensureIsArray(value);
    if (values.length === 0) {
      updateDataMask(null);
    } else {
      updateDataMask(values.map(element => element.value));
    }
  };

  useEffect(() => {
    if (isDisabled) {
      // empty selection if filter is disabled
      updateDataMask(null);
    } else {
      // reset data mask based on filter state
      updateDataMask(filterState.value);
    }
  }, [filterState.value, isDisabled, updateDataMask]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }

  const loadParsedData = useMemo(
    () => async (search: string, page: number, pageSize: number) => {
      const results = await loadData(search, page, pageSize);
      const result = results && results.length > 0 ? results[0] : undefined;
      const data = result?.data || [];
      const colName = result?.colnames[0];
      const options: { label: string; value: string | number }[] = [];
      if (colName) {
        data.forEach(row => {
          const value = row[colName];
          options.push({
            label: labelFormatter(value, datatype),
            value: typeof value === 'number' ? value : String(value),
          });
        });
      }

      if (
        defaultToFirstItem &&
        !filterState.value &&
        data.length > 0 &&
        colName
      ) {
        const value = data[0][colName];
        updateDataMask([typeof value === 'number' ? value : String(value)]);
      }

      return {
        data: options,
        totalCount: result?.rowcount || 0,
      };
    },
    [], // TODO: Add required dependencies
  );

  let value: { label: string; value: string | number }[];
  if (filterState.value) {
    value = filterState.value.map((element: string | number) => ({
      label: String(element),
      value: element,
    }));
  }

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        {...formItemData}
      >
        <Select
          allowClear
          allowNewOptions
          // @ts-ignore
          value={value}
          disabled={isDisabled}
          showSearch={showSearch}
          lazyLoading={!defaultToFirstItem}
          mode={multiSelect ? 'multiple' : 'single'}
          onSearch={searchWrapper}
          onSelect={clearSuggestionSearch}
          onBlur={handleBlur}
          onMouseEnter={setFocusedFilter}
          onMouseLeave={unsetFocusedFilter}
          // @ts-ignore
          onChange={handleChange}
          ref={inputRef}
          maxTagCount={5}
          invertSelection={inverseSelection}
          options={loadParsedData}
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
