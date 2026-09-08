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
import { t, tn } from '@apache-superset/core/translation';
import {
  AppSection,
  DataMask,
  ensureIsArray,
  ExtraFormData,
  getColumnLabel,
  JsonObject,
  finestTemporalGrainFormatter,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { debounce, isUndefined } from 'lodash-es';
import { useImmerReducer } from 'use-immer';
import {
  FormItem,
  LabeledValue,
  Select,
  Space,
  Constants,
  Input,
} from '@superset-ui/core/components';
import {
  hasOption,
  propertyComparator,
  stripSurroundingQuotes,
} from '@superset-ui/core/components/Select/utils';
import { FilterBarOrientation } from 'src/dashboard/types';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';
import { FilterPluginStyle, StatusMessage } from '../common';
import {
  PluginFilterSelectProps,
  SelectFilterOperatorType,
  SelectValue,
} from './types';

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
      width: ${({ inverseSelection }) => (!inverseSelection ? '100%' : 'auto')};
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
    clearAllTrigger,
    onClearAllComplete,
  } = props;
  const {
    enableEmptyFilter,
    creatable,
    multiSelect,
    showSearch,
    inverseSelection,
    defaultToFirstItem,
    searchAllOptions,
    operatorType = SelectFilterOperatorType.Exact,
  } = formData;

  const groupby = useMemo(
    () => ensureIsArray(formData.groupby).map(getColumnLabel),
    [formData.groupby],
  );
  const [col] = groupby;
  const [initialColtypeMap] = useState(coltypeMap);
  const [search, setSearch] = useState('');
  const userClearedRef = useRef(false);
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const datatype: GenericDataType = coltypeMap[col];
  const isLikeOperator =
    operatorType !== SelectFilterOperatorType.Exact &&
    datatype === GenericDataType.String;
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

  const [likeInputValue, setLikeInputValue] = useState<string>(
    filterState.value?.[0] != null ? String(filterState.value[0]) : '',
  );

  useEffect(() => {
    const externalValue =
      filterState.value?.[0] != null ? String(filterState.value[0]) : '';
    setLikeInputValue(externalValue);
  }, [filterState.value]);

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
          operatorType,
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
      operatorType,
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
              // The dropdown offers `stripSurroundingQuotes(search)` as the
              // creatable option, so the server has to be asked for the same
              // string or the two disagree about what was searched for.
              search: stripSurroundingQuotes(search).trim(),
            },
          });
        }
      }, Constants.SLOW_DEBOUNCE),
    [dispatchDataMask, initialColtypeMap, searchAllOptions],
  );

  const handleBlur = useCallback(() => {
    unsetFocusedFilter();
    if (search) {
      onSearch('');
    }
  }, [onSearch, search, unsetFocusedFilter]);

  const handleChange = useCallback(
    (value?: SelectValue | number | string) => {
      const values = value === null ? [null] : ensureIsArray(value);

      if (values.length === 0) {
        userClearedRef.current = true;
        updateDataMask(null);
      } else {
        userClearedRef.current = false;
        updateDataMask(values);
      }
    },
    [updateDataMask, formData.nativeFilterId, clearAllTrigger],
  );

  const placeholderText =
    data.length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);

  // A capped list reads as the whole set, so a value sitting past the row
  // limit looks like a value that does not exist. Each sentence is only added
  // when it is actually true of this filter's configuration.
  const rowLimit = Number(formData.rowLimit) || 0;
  const helperText = useMemo(() => {
    if (!rowLimit || data.length < rowLimit) {
      return undefined;
    }
    return [
      t('Only the first %s values are listed.', data.length),
      searchAllOptions ? t('Type to search all of them.') : undefined,
      creatable !== false
        ? t('You can enter a value that is not listed.')
        : undefined,
    ]
      .filter(Boolean)
      .join(' ');
  }, [creatable, data.length, rowLimit, searchAllOptions]);

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
    const allOptions = new Set(data.map(el => el[col]));
    const baseOptions = [...allOptions].map((value: string) => ({
      label: labelFormatter(value, datatype),
      value,
      isNewOption: false,
    }));
    if (creatable !== false && filterState.value) {
      ensureIsArray(filterState.value)
        .filter(v => v != null && !hasOption(v, baseOptions, true))
        .forEach(v => {
          baseOptions.push({ label: String(v), value: v, isNewOption: true });
        });
    }
    return baseOptions;
  }, [data, datatype, col, labelFormatter, creatable, filterState.value]);

  const options = useMemo(() => {
    const unquotedSearch = stripSurroundingQuotes(search);
    if (
      unquotedSearch &&
      creatable !== false &&
      !hasOption(unquotedSearch, uniqueOptions, true)
    ) {
      return [
        { label: unquotedSearch, value: unquotedSearch, isNewOption: true },
        ...uniqueOptions,
      ];
    }
    return uniqueOptions;
  }, [search, uniqueOptions, creatable]);

  const sortComparator = useCallback(
    (a: LabeledValue, b: LabeledValue) => {
      // When sortMetric is specified, the backend already sorted the data correctly
      // Don't override the backend's metric-based sorting with frontend alphabetical sorting
      if (formData.sortMetric) {
        return 0; // Preserve the original order from the backend
      }

      // Only apply sorting when no sortMetric is specified. `label` is always
      // a formatted string (see getDataRecordFormatter), so comparing by it
      // never reaches propertyComparator's numeric branch; numeric columns
      // sort by the raw `value` instead so "2, 10, 100" doesn't collapse
      // into lexicographic "10, 100, 2".
      const comparator = propertyComparator(
        datatype === GenericDataType.Numeric ? 'value' : 'label',
      );
      if (formData.sortAscending) {
        return comparator(a, b);
      }
      return comparator(b, a);
    },
    [formData.sortAscending, formData.sortMetric, datatype],
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

    // Reset userClearedRef when clearAllTrigger fires so auto-select
    // can re-apply if the filter is re-initialised after a global clear
    if (clearAllTrigger) {
      userClearedRef.current = false;
    }

    if (filterState.value !== undefined) {
      // Set the filter state value if it is defined
      updateDataMask(filterState.value);
      return;
    }

    // Handle the default to first Value case
    // Skip default values when clearAllTrigger is active to prevent
    // defaults from being applied during Clear All operation
    if (!clearAllTrigger) {
      if (defaultToFirstItem && !userClearedRef.current) {
        // Set to first item if defaultToFirstItem is true
        const firstItem: SelectValue = data[0]
          ? (groupby.map(col => data[0][col]) as string[])
          : null;
        if (firstItem?.[0] !== undefined) {
          updateDataMask(firstItem);
        }
      } else if (formData?.defaultValue) {
        // Handle defalut value case
        updateDataMask(formData.defaultValue);
      }
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
    clearAllTrigger,
  ]);

  useEffect(() => {
    if (
      filterState.value?.every((value?: any) =>
        data.some(row => row[col] === value),
      )
    )
      return;

    const firstItem: SelectValue = data[0]
      ? (groupby.map(col => data[0][col]) as string[])
      : null;

    // Skip default value update when clearAllTrigger is active.
    // `null` is a persisted "user cleared this" state, as opposed to
    // `undefined` for "never set", so it must not be re-defaulted either —
    // `userClearedRef` alone would not survive a reload.
    if (
      !clearAllTrigger &&
      defaultToFirstItem &&
      !userClearedRef.current &&
      Object.keys(formData?.extraFormData || {}).length &&
      filterState.value !== undefined &&
      filterState.value !== null &&
      firstItem !== null &&
      filterState.value !== firstItem
    ) {
      if (firstItem?.[0] !== undefined) {
        updateDataMask(firstItem);
      }
    }
  }, [
    defaultToFirstItem,
    updateDataMask,
    formData,
    data,
    JSON.stringify(filterState.value),
    clearAllTrigger,
  ]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  useEffect(() => {
    if (clearAllTrigger) {
      dispatchDataMask({
        type: 'filterState',
        extraFormData: {},
        filterState: {
          value: undefined,
          label: undefined,
        },
      });

      updateDataMask(null);
      setSearch('');
      setLikeInputValue('');
      onClearAllComplete?.(formData.nativeFilterId);
    }
  }, [clearAllTrigger, onClearAllComplete, updateDataMask]);

  useEffect(() => {
    if (prevExcludeFilterValues.current !== excludeFilterValues) {
      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          filterState.value,
          !filterState.value?.length,
          excludeFilterValues && inverseSelection,
          operatorType,
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

  const updateDataMaskRef = useRef(updateDataMask);
  useEffect(() => {
    updateDataMaskRef.current = updateDataMask;
  }, [updateDataMask]);

  const debouncedLikeChange = useMemo(
    () =>
      debounce((text: string) => {
        if (text) {
          updateDataMaskRef.current([text]);
        } else {
          updateDataMaskRef.current(null);
        }
      }, Constants.SLOW_DEBOUNCE),
    [],
  );

  useEffect(() => {
    if (!isLikeOperator || clearAllTrigger) {
      debouncedLikeChange.cancel();
    }
  }, [clearAllTrigger, debouncedLikeChange, isLikeOperator]);

  useEffect(() => () => debouncedLikeChange.cancel(), [debouncedLikeChange]);

  const handleLikeInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLikeInputValue(e.target.value);
      debouncedLikeChange(e.target.value);
    },
    [debouncedLikeChange],
  );

  const getSelectPopupContainer = useCallback(
    (trigger: HTMLElement) => {
      if (showOverflow) {
        return (parentRef?.current as HTMLElement) || document.body;
      }
      if (appSection === AppSection.FilterConfigModal) {
        return (trigger?.parentNode as HTMLElement) || document.body;
      }
      return document.body;
    },
    [appSection, parentRef, showOverflow],
  );

  const likeInputPlaceholder = useMemo(() => {
    switch (operatorType) {
      case SelectFilterOperatorType.Contains:
        return t('Type to search (contains)...');
      case SelectFilterOperatorType.StartsWith:
        return t('Type to search (starts with)...');
      case SelectFilterOperatorType.EndsWith:
        return t('Type to search (ends with)...');
      default:
        return t('Type a value...');
    }
  }, [operatorType]);

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem
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
              getPopupContainer={getSelectPopupContainer}
            />
          )}
          {isLikeOperator ? (
            <Input
              allowClear
              placeholder={likeInputPlaceholder}
              value={likeInputValue}
              onChange={handleLikeInputChange}
              onFocus={setFocusedFilter}
              onBlur={unsetFocusedFilter}
              onMouseEnter={setHoveredFilter}
              onMouseLeave={unsetHoveredFilter}
              disabled={isDisabled}
              ref={inputRef}
            />
          ) : (
            <Select
              name={formData.nativeFilterId}
              allowClear
              autoClearSearchValue
              allowNewOptions={creatable !== false}
              allowNewOptionsOnPaste={multiSelect && searchAllOptions}
              allowSelectAll={!searchAllOptions}
              stableSelectAll={!searchAllOptions}
              value={multiSelect ? filterState.value || [] : filterState.value}
              disabled={isDisabled}
              getPopupContainer={getSelectPopupContainer}
              showSearch={showSearch}
              mode={multiSelect ? 'multiple' : 'single'}
              placeholder={placeholderText}
              helperText={helperText}
              onClear={() => onSearch('')}
              onSearch={onSearch}
              onBlur={handleBlur}
              onFocus={setFocusedFilter}
              onMouseEnter={setHoveredFilter}
              onMouseLeave={unsetHoveredFilter}
              // @ts-expect-error
              onChange={handleChange}
              ref={inputRef}
              loading={isRefreshing}
              oneLine={filterBarOrientation === FilterBarOrientation.Horizontal}
              invertSelection={inverseSelection && excludeFilterValues}
              options={options}
              sortComparator={sortComparator}
              onOpenChange={setFilterActive}
              className="select-container"
            />
          )}
        </StyledSpace>
      </FormItem>
    </FilterPluginStyle>
  );
}
