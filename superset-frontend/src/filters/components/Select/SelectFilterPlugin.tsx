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
  DataRecord,
  ensureIsArray,
  ExtraFormData,
  GenericDataType,
  JsonObject,
  smartDateDetailedFormatter,
  styled,
  t,
  tn,
} from '@superset-ui/core';
import React, {
  RefObject,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Select } from 'src/common/components';
import debounce from 'lodash/debounce';
import { SLOW_DEBOUNCE } from 'src/constants';
import { useImmerReducer } from 'use-immer';
import Icons from 'src/components/Icons';
import { usePrevious } from 'src/common/hooks/usePrevious';
import { PluginFilterSelectProps, SelectValue } from './types';
import { StyledFormItem, StyledSelect, Styles } from '../common';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';

const { Option } = Select;

const Error = styled.div`
  color: ${({ theme }) => theme.colors.error.base};
`;

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
    data,
    filterState,
    formData,
    height,
    isRefreshing,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
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
  const [selectedValues, setSelectedValues] = useState<SelectValue>(
    filterState.value,
  );
  const sortedData = useMemo(() => {
    const firstData: DataRecord[] = [];
    const restData: DataRecord[] = [];
    data.forEach(row => {
      // @ts-ignore
      if (selectedValues?.includes(row[col])) {
        firstData.push(row);
      } else {
        restData.push(row);
      }
    });
    return [...firstData, ...restData];
  }, [col, selectedValues, data]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const wasDropdownVisible = usePrevious(isDropdownVisible);
  const [currentSuggestionSearch, setCurrentSuggestionSearch] = useState('');
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
    if (!isDropdownVisible) {
      setSelectedValues(filterState.value);
    }
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
    setCurrentSuggestionSearch(val);
  };

  const clearSuggestionSearch = () => {
    setCurrentSuggestionSearch('');
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
    setSelectedValues(filterState.value);
  };

  const datatype: GenericDataType = coltypeMap[col];
  const labelFormatter = getDataRecordFormatter({
    timeFormatter: smartDateDetailedFormatter,
  });

  const handleChange = (value?: SelectValue | number | string) => {
    const values = ensureIsArray(value);
    if (values.length === 0) {
      updateDataMask(null);
    } else {
      updateDataMask(values);
    }
  };

  useEffect(() => {
    if (defaultToFirstItem && filterState.value === undefined) {
      // initialize to first value if set to default to first item
      const firstItem: SelectValue = data[0]
        ? (groupby.map(col => data[0][col]) as string[])
        : null;
      // firstItem[0] !== undefined for a case when groupby changed but new data still not fetched
      // TODO: still need repopulate default value in config modal when column changed
      if (firstItem && firstItem[0] !== undefined) {
        updateDataMask(firstItem);
      }
    } else if (isDisabled) {
      // empty selection if filter is disabled
      updateDataMask(null);
    } else {
      // reset data mask based on filter state
      updateDataMask(filterState.value);
    }
  }, [
    col,
    isDisabled,
    defaultToFirstItem,
    enableEmptyFilter,
    inverseSelection,
    updateDataMask,
    data,
    groupby,
    JSON.stringify(filterState),
  ]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  const placeholderText =
    data.length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);
  const Icon = inverseSelection ? Icons.StopOutlined : Icons.CheckOutlined;

  return (
    <Styles height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateMessage && 'error'}
        extra={<Error>{filterState.validateMessage}</Error>}
      >
        <StyledSelect
          allowClear
          // @ts-ignore
          value={filterState.value || []}
          disabled={isDisabled}
          showSearch={showSearch}
          mode={multiSelect ? 'multiple' : undefined}
          placeholder={placeholderText}
          onSearch={searchWrapper}
          onSelect={clearSuggestionSearch}
          onBlur={handleBlur}
          onDropdownVisibleChange={setIsDropdownVisible}
          dropdownRender={(
            originNode: ReactElement & { ref?: RefObject<HTMLElement> },
          ) => {
            if (isDropdownVisible && !wasDropdownVisible) {
              originNode.ref?.current?.scrollTo({ top: 0 });
            }
            return originNode;
          }}
          onFocus={setFocusedFilter}
          // @ts-ignore
          onChange={handleChange}
          ref={inputRef}
          loading={isRefreshing}
          maxTagCount={5}
          menuItemSelectedIcon={<Icon iconSize="m" />}
        >
          {sortedData.map(row => {
            const [value] = groupby.map(col => row[col]);
            return (
              // @ts-ignore
              <Option key={`${value}`} value={value}>
                {labelFormatter(value, datatype)}
              </Option>
            );
          })}
          {currentSuggestionSearch &&
            !ensureIsArray(filterState.value).some(
              suggestion => suggestion === currentSuggestionSearch,
            ) && (
              <Option value={currentSuggestionSearch}>
                {`${t('Create "%s"', currentSuggestionSearch)}`}
              </Option>
            )}
        </StyledSelect>
      </StyledFormItem>
    </Styles>
  );
}
