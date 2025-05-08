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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppSection,
  DataMask,
  ensureIsArray,
  ExtraFormData,
  GenericDataType,
  getColumnLabel,
  JsonObject,
  finestTemporalGrainFormatter,
  t,
  tn,
  styled,
} from '@superset-ui/core';
// eslint-disable-next-line no-restricted-imports
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select'; // TODO: Remove antd
import { debounce, isUndefined } from 'lodash';
import { useImmerReducer } from 'use-immer';
import { Select } from 'src/components';
// eslint-disable-next-line no-restricted-imports
import { Space } from 'antd'; // Import Space directly from antd
import { SLOW_DEBOUNCE } from 'src/constants';
import { hasOption, propertyComparator } from 'src/components/Select/utils';
import { FilterBarOrientation } from 'src/dashboard/types';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';
import { FilterPluginStyle, StatusMessage, StyledFormItem } from '../common';
import { PluginFilterSelectProps, SelectValue } from './types';

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      extraFormData: ExtraFormData;
      filterState: {
        value: SelectValue;
        label?: string;
        excludeFilterValues?: boolean;
      };
    };

function reducer(draft: DataMask, action: DataMaskAction) {
  switch (action.type) {
    case 'ownState':
      draft.ownState = {
        ...draft.ownState,
        ...action.ownState,
      };
      return draft;
    case 'filterState':
      if (
        JSON.stringify(draft.extraFormData) !==
        JSON.stringify(action.extraFormData)
      ) {
        draft.extraFormData = action.extraFormData;
      }
      if (
        JSON.stringify(draft.filterState) !== JSON.stringify(action.filterState)
      ) {
        draft.filterState = { ...draft.filterState, ...action.filterState };
      }

      return draft;
    default:
      return draft;
  }
}

const StyledSpace = styled(Space)<{
  inverseSelection: boolean;
  appSection: AppSection;
}>`
  display: flex;
  align-items: center;
  width: 100%;

  .exclude-select {
    width: 80px;
    flex-shrink: 0;
  }

  &.ant-space {
    .ant-space-item {
      width: ${({ inverseSelection, appSection }) =>
        !inverseSelection || appSection === AppSection.FilterConfigModal
          ? '100%'
          : 'auto'};
    }
  }
`;

// Keep track of orientation changes outside component with filter ID
const orientationMap = new Map<string, FilterBarOrientation>();

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
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    appSection,
    showOverflow,
    parentRef,
    inputRef,
    filterBarOrientation,
  } = props;
  const {
    enableEmptyFilter,
    creatable,
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
  const [col] = groupby;
  const [initialColtypeMap] = useState(coltypeMap);
  const [search, setSearch] = useState('');
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const datatype: GenericDataType = coltypeMap[col];
  const labelFormatter = useMemo(
    () =>
      getDataRecordFormatter({
        timeFormatter: finestTemporalGrainFormatter(data.map(el => el[col])),
      }),
    [data, col],
  );
  const [excludeFilterValues, setExcludeFilterValues] = useState(
    isUndefined(filterState?.excludeFilterValues)
      ? true
      : filterState?.excludeFilterValues,
  );

  const prevExcludeFilterValues = useRef(excludeFilterValues);

  const hasOnlyOrientationChanged = useRef(false);

  useEffect(() => {
    // Get previous orientation for this specific filter
    const previousOrientation = orientationMap.get(formData.nativeFilterId);

    // Check if only orientation changed for this filter
    if (
      previousOrientation !== undefined &&
      previousOrientation !== filterBarOrientation
    ) {
      hasOnlyOrientationChanged.current = true;
    } else {
      hasOnlyOrientationChanged.current = false;
    }

    // Update orientation for this filter
    if (filterBarOrientation) {
      orientationMap.set(formData.nativeFilterId, filterBarOrientation);
    }
  }, [filterBarOrientation]);

  const updateDataMask = useCallback(
    (values: SelectValue) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !values?.length;

      const suffix = inverseSelection && values?.length ? t(' (excluded)') : '';
      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          values,
          emptyFilter,
          excludeFilterValues && inverseSelection,
        ),
        filterState: {
          ...filterState,
          label: values?.length
            ? `${(values || [])
                .map(value => labelFormatter(value, datatype))
                .join(', ')}${suffix}`
            : undefined,
          value:
            appSection === AppSection.FilterConfigModal && defaultToFirstItem
              ? undefined
              : values,
          excludeFilterValues,
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
      excludeFilterValues,
      JSON.stringify(filterState),
      labelFormatter,
    ],
  );

  const isDisabled =
    appSection === AppSection.FilterConfigModal && defaultToFirstItem;

  const onSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSearch(search);
        if (searchAllOptions) {
          dispatchDataMask({
            type: 'ownState',
            ownState: {
              coltypeMap: initialColtypeMap,
              search,
            },
          });
        }
      }, SLOW_DEBOUNCE),
    [dispatchDataMask, initialColtypeMap, searchAllOptions],
  );

  const handleBlur = useCallback(() => {
    unsetFocusedFilter();
    onSearch('');
  }, [onSearch, unsetFocusedFilter]);

  const handleChange = useCallback(
    (value?: SelectValue | number | string) => {
      const values = value === null ? [null] : ensureIsArray(value);

      if (values.length === 0) {
        updateDataMask(null);
      } else {
        updateDataMask(values);
      }
    },
    [updateDataMask],
  );

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

  const uniqueOptions = useMemo(() => {
    const allOptions = new Set([...data.map(el => el[col])]);
    return [...allOptions].map((value: string) => ({
      label: labelFormatter(value, datatype),
      value,
      isNewOption: false,
    }));
  }, [data, datatype, col, labelFormatter]);

  const options = useMemo(() => {
    if (search && !multiSelect && !hasOption(search, uniqueOptions, true)) {
      uniqueOptions.unshift({
        label: search,
        value: search,
        isNewOption: true,
      });
    }
    return uniqueOptions;
  }, [multiSelect, search, uniqueOptions]);

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

  // Use effect for initialisation for filter plugin
  // this should run only once when filter is configured & saved
  // & shouldnt run when the component is remounted on change of
  // orientation of filter bar
  useEffect(() => {
    // Skip if only orientation changed
    if (hasOnlyOrientationChanged.current) {
      return;
    }

    // Case 1: Handle disabled state first
    if (isDisabled) {
      updateDataMask(null);
      return;
    }

    // Case 2: Handle the default to first Value case
    if (defaultToFirstItem) {
      // Set to first item if defaultToFirstItem is true
      const firstItem: SelectValue = data[0]
        ? (groupby.map(col => data[0][col]) as string[])
        : null;
      if (firstItem?.[0] !== undefined) {
        updateDataMask(firstItem);
      }
    } else if (formData?.defaultValue) {
      // Case 3 : Handle defalut value case
      updateDataMask(formData.defaultValue);
    }
  }, [
    isDisabled,
    enableEmptyFilter,
    defaultToFirstItem,
    formData?.defaultValue,
    data,
    groupby,
    col,
    inverseSelection,
  ]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  useEffect(() => {
    if (prevExcludeFilterValues.current !== excludeFilterValues) {
      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          filterState.value,
          !filterState.value?.length,
          excludeFilterValues && inverseSelection,
        ),
        filterState: {
          ...(filterState as {
            value: SelectValue;
            label?: string;
            excludeFilterValues?: boolean;
          }),
          excludeFilterValues,
        },
      });
      prevExcludeFilterValues.current = excludeFilterValues;
    }
  }, [excludeFilterValues]);

  const handleExclusionToggle = (value: string) => {
    setExcludeFilterValues(value === 'true');
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        extra={formItemExtra}
      >
        <StyledSpace
          appSection={appSection}
          inverseSelection={inverseSelection}
        >
          {appSection !== AppSection.FilterConfigModal && inverseSelection && (
            <Select
              className="exclude-select"
              value={`${excludeFilterValues}`}
              options={[
                { value: 'true', label: t('is not') },
                { value: 'false', label: t('is') },
              ]}
              onChange={handleExclusionToggle}
            />
          )}
          <Select
            name={formData.nativeFilterId}
            allowClear
            allowNewOptions={!searchAllOptions && creatable !== false}
            allowSelectAll={!searchAllOptions}
            value={filterState.value || []}
            disabled={isDisabled}
            getPopupContainer={
              showOverflow
                ? () => (parentRef?.current as HTMLElement) || document.body
                : (trigger: HTMLElement) =>
                    (trigger?.parentNode as HTMLElement) || document.body
            }
            showSearch={showSearch}
            mode={multiSelect ? 'multiple' : 'single'}
            placeholder={placeholderText}
            onClear={() => onSearch('')}
            onSearch={onSearch}
            onBlur={handleBlur}
            onFocus={setFocusedFilter}
            onMouseEnter={setHoveredFilter}
            onMouseLeave={unsetHoveredFilter}
            // @ts-ignore
            onChange={handleChange}
            ref={inputRef}
            loading={isRefreshing}
            oneLine={filterBarOrientation === FilterBarOrientation.Horizontal}
            invertSelection={inverseSelection && excludeFilterValues}
            options={options}
            sortComparator={sortComparator}
            onDropdownVisibleChange={setFilterActive}
            className="select-container"
          />
        </StyledSpace>
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
