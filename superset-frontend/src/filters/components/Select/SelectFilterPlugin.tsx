// DODO was here
/* eslint-disable no-param-reassign */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@superset-ui/core';
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import { debounce } from 'lodash';
import { useImmerReducer } from 'use-immer';
import { Select } from 'src/components';
import { FilterPlugins, SLOW_DEBOUNCE } from 'src/constants';
import { hasOption, propertyComparator } from 'src/components/Select/utils';
import { FilterBarOrientation } from 'src/dashboard/types';
import { PluginFilterSelectProps, SelectValue } from './types';
import { FilterPluginStyle, StatusMessage, StyledFormItem } from '../common';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      extraFormData: ExtraFormData;
      filterState: { value: SelectValue; label?: string };
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
    multiSelect,
    showSearch,
    inverseSelection,
    defaultToFirstItem,
    searchAllOptions,
  } = formData;
  const groupby = useMemo(
    // () => ensureIsArray(formData.groupby).map(getColumnLabel),
    // DODO changed 44211759
    () => ensureIsArray(formData.groupby?.[0]).map(getColumnLabel),
    [formData.groupby],
  );

  // DODO added 44211759
  const groupbyid = useMemo(
    () => ensureIsArray(formData.groupby?.[1]).map(getColumnLabel),
    [formData.groupby],
  );

  const isSelectById = formData.vizType === FilterPlugins.SelectById; // DODO added 44211759
  const [col] = groupby;
  const [colid] = groupbyid; // DODO added 44211759
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

  // DODO added 44211759
  const OptionsKeyByValue = useMemo(() => {
    const map = new Map();

    // make list of value for one label in case same label with different id column
    if (isSelectById) {
      data.forEach(row => {
        const value = row[colid];
        const label = row[col];

        if (!map.has(label)) {
          map.set(label, []);
        }

        map.get(label).push(value);
      });
    }

    return map;
  }, [data, isSelectById, col, colid]);

  const updateDataMask = useCallback(
    (values: SelectValue) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !values?.length;

      const suffix = inverseSelection && values?.length ? t(' (excluded)') : '';

      // DODO added start 44211759
      let valuesToFilter:
        | null
        | undefined
        | (string | number | boolean | null)[] = [];
      if (isSelectById && values && values?.length > 0) {
        values.forEach(value => {
          if (OptionsKeyByValue.has(value)) {
            valuesToFilter?.push(...OptionsKeyByValue.get(value));
          }
        });
      } else {
        valuesToFilter = values;
      }
      // DODO added stop 44211759

      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          // col,
          colid ?? col, // DODO changed 44211759
          // values,
          valuesToFilter, // DODO changed 44211759
          emptyFilter,
          inverseSelection,
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

  useEffect(() => {
    if (defaultToFirstItem && filterState.value === undefined) {
      // initialize to first value if set to default to first item
      const firstItem: SelectValue = data[0]
        ? (groupby.map(col => data[0][col]) as string[])
        : null;
      // firstItem[0] !== undefined for a case when groupby changed but new data still not fetched
      // TODO: still need repopulate default value in config modal when column changed
      if (firstItem?.[0] !== undefined) {
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
    JSON.stringify(filterState.value),
  ]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        extra={formItemExtra}
      >
        <Select
          allowClear
          allowNewOptions={!searchAllOptions}
          allowSelectAll={!searchAllOptions}
          // @ts-ignore
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
          invertSelection={inverseSelection}
          options={options}
          sortComparator={sortComparator}
          onDropdownVisibleChange={setFilterActive}
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
