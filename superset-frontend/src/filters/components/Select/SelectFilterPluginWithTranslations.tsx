// DODO was here
// DODO created 44211759
/* eslint-disable no-param-reassign */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppSection,
  DataMask,
  ensureIsArray,
  ExtraFormData,
  finestTemporalGrainFormatter,
  GenericDataType,
  getColumnLabel,
  JsonObject,
  PlainObject,
  t,
  tn,
} from '@superset-ui/core';
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import { debounce } from 'lodash';
import { useImmerReducer } from 'use-immer';
import { bootstrapData } from 'src/preamble'; // DODO added 30434273
import { Select } from 'src/components';
import { SLOW_DEBOUNCE } from 'src/constants';
import { hasOption, propertyComparator } from 'src/components/Select/utils';
import { FilterBarOrientation } from 'src/dashboard/types';
import {
  hasFilterTranslations,
  getDataRecordFormatter,
  getSelectExtraFormData,
} from '../../utils';
import { PluginFilterSelectProps, SelectValue } from './types';
import { FilterPluginStyle, StatusMessage, StyledFormItem } from '../common';

const locale = bootstrapData?.common?.locale || 'en'; // DODO added 30434273

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

const flattenValues = (
  values: PlainObject[] | string[] | number[],
  groupby: string,
): (string | number)[] => {
  if (typeof values[0] === 'object') {
    return (values as PlainObject[])
      .map(value => {
        if (value && typeof value === 'object' && groupby in value) {
          return value[groupby];
        }
        return undefined;
      })
      .filter(value => value !== undefined);
  }
  return values as (string | number)[];
};

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

  // formData.groupby = [groupby, groupbyRu, groupbyid] || [groupby, groupbyRu]
  const groupby = useMemo(
    () => ensureIsArray(formData.groupby?.[0]).map(getColumnLabel),
    [formData.groupby],
  );
  const groupbyRu = useMemo(
    () => ensureIsArray(formData.groupby?.[1]).map(getColumnLabel),
    [formData.groupby],
  );

  const localisedGroupby =
    hasFilterTranslations(formData.vizType) && locale === 'ru'
      ? groupbyRu
      : groupby;

  const [col] = groupby;
  const [localisedCol] = localisedGroupby;
  const [initialColtypeMap] = useState(coltypeMap);
  const [search, setSearch] = useState('');
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const datatype: GenericDataType = coltypeMap[localisedCol];
  const labelFormatter = useMemo(
    () =>
      getDataRecordFormatter({
        timeFormatter: finestTemporalGrainFormatter(data.map(el => el[col])),
      }),
    [data, col],
  );

  const OptionsKeyByValue = useMemo(() => {
    const map = new Map();
    // make list of value for one label in case same label with different id column
    const [labelField] = localisedGroupby;
    data.forEach(row => {
      const value = row;
      const label = row[labelField];

      if (!map.has(label)) {
        map.set(label, []);
      }

      map.get(label).push(value);
    });
    return map;
  }, [data, localisedGroupby]);

  const updateDataMask = useCallback(
    (values: SelectValue) => {
      const emptyFilter =
        enableEmptyFilter && !inverseSelection && !values?.length;

      const suffix = inverseSelection && values?.length ? t(' (excluded)') : '';

      const valuesToFilter:
        | null
        | undefined
        | (string | number | boolean | null)[] = [];

      if (values) {
        values.forEach(value => {
          const valueEn =
            typeof value === 'object' && value !== null
              ? value[groupby[0]]
              : value;
          const valueRu =
            typeof value === 'object' && value !== null
              ? value[groupbyRu[0]]
              : value;
          if (OptionsKeyByValue.has(valueEn)) {
            valuesToFilter?.push(...OptionsKeyByValue.get(valueEn));
          } else if (OptionsKeyByValue.has(valueRu)) {
            valuesToFilter?.push(...OptionsKeyByValue.get(valueRu));
          }
        });
      }

      // debugger;
      dispatchDataMask({
        type: 'filterState',
        extraFormData: getSelectExtraFormData(
          col,
          // values, // DODO commented 29749076
          valuesToFilter, // DODO changed 29749076
          emptyFilter,
          inverseSelection,
        ),
        filterState: {
          ...filterState,
          label: valuesToFilter?.length
            ? `${(valuesToFilter || [])
                .map(value => {
                  if (typeof value === 'object' && value !== null)
                    return labelFormatter(value[col], datatype);
                  return labelFormatter(value, datatype);
                })
                .join(', ')}${suffix}`
            : undefined,
          value:
            appSection === AppSection.FilterConfigModal && defaultToFirstItem
              ? undefined
              : (valuesToFilter as SelectValue),
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
    const allOptions = new Set([...data.map(el => el[localisedCol])]);
    return [...allOptions].map((value: string) => ({
      label: labelFormatter(value, datatype),
      value,
      isNewOption: false,
    }));
  }, [data, datatype, localisedCol, labelFormatter]);

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
        ? (groupby.map(col => data[0][col]) as string[]) // DODO changed 30434273
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
          value={flattenValues(filterState.value || [], localisedCol)}
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
