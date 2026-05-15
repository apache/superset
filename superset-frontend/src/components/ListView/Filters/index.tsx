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
import {
  createRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  RefObject,
} from 'react';

import { withTheme } from '@apache-superset/core/theme';

import type {
  ListViewFilterValue as FilterValue,
  ListViewFilters as Filters,
  InternalFilter,
  SelectOption,
} from '../types';
import type { FilterHandler } from './types';
import SearchFilter from './Search';
import DateRangeFilter from './DateRange';
import NumericalRangeFilter from './NumericalRange';
import CompactFilterTrigger from './CompactFilterTrigger';
import CompactSelectPanel from './CompactSelectPanel';

interface UIFiltersProps {
  filters: Filters;
  internalFilters: InternalFilter[];
  updateFilterValue: (id: number, value: FilterValue['value']) => void;
}

function UIFilters(
  { filters, internalFilters = [], updateFilterValue }: UIFiltersProps,
  ref: RefObject<{ clearFilters: () => void }>,
) {
  const filterRefs = useMemo(
    () =>
      Array.from({ length: filters.length }, () => createRef<FilterHandler>()),
    [filters.length],
  );

  useImperativeHandle(ref, () => ({
    clearFilters: () => {
      filterRefs.forEach((filter: any) => {
        filter.current?.clearFilter?.();
      });
    },
    clearFilterById: (id: string) => {
      const index = filters.findIndex(f => f.id === id);
      if (index >= 0) {
        filterRefs[index]?.current?.clearFilter?.();
      }
    },
  }));

  return (
    <>
      {filters.map(
        (
          {
            Header,
            fetchSelects,
            key,
            id,
            input,
            optionFilterProps,
            paginate,
            selects,
            toolTipDescription,
            onFilterUpdate,
            loading,
            dateFilterValueType,
            min,
            max,
            popupStyle,
            autoComplete,
            inputName,
          },
          index,
        ) => {
          const initialValue = internalFilters?.[index]?.value;
          const filterValue = internalFilters?.[index]?.value;
          if (input === 'select') {
            const selectValue = filterValue as SelectOption | undefined;
            const tooltipTitle = selectValue
              ? typeof selectValue.label === 'string'
                ? selectValue.label
                : String(selectValue.value ?? '')
              : undefined;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={!!selectValue}
                tooltipTitle={tooltipTitle}
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                  updateFilterValue(index, undefined);
                }}
              >
                <CompactSelectPanel
                  ref={filterRefs[index]}
                  selects={selects}
                  fetchSelects={fetchSelects}
                  value={initialValue as SelectOption | undefined}
                  onSelect={(
                    option: SelectOption | undefined,
                    isClear?: boolean,
                  ) => {
                    if (onFilterUpdate && !isClear) {
                      onFilterUpdate(option);
                    }
                    updateFilterValue(index, option);
                  }}
                  onClose={() => {}}
                />
              </CompactFilterTrigger>
            );
          }
          if (input === 'search' && typeof Header === 'string') {
            return (
              <SearchFilter
                ref={filterRefs[index]}
                Header={Header}
                initialValue={initialValue}
                key={key}
                name={inputName ?? id}
                toolTipDescription={toolTipDescription}
                onSubmit={(value: string) => {
                  if (onFilterUpdate) {
                    onFilterUpdate(value);
                  }

                  updateFilterValue(index, value);
                }}
                autoComplete={autoComplete}
              />
            );
          }
          if (input === 'datetime_range') {
            const hasDateValue =
              Array.isArray(filterValue) && filterValue.some(Boolean);
            const dateTooltip = hasDateValue
              ? (filterValue as (string | number)[]).filter(Boolean).join(' – ')
              : undefined;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={hasDateValue}
                tooltipTitle={dateTooltip}
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                  updateFilterValue(index, undefined);
                }}
              >
                <DateRangeFilter
                  ref={filterRefs[index]}
                  Header={Header}
                  initialValue={initialValue}
                  name={id}
                  onSubmit={value => updateFilterValue(index, value)}
                  dateFilterValueType={dateFilterValueType || 'unix'}
                />
              </CompactFilterTrigger>
            );
          }
          if (input === 'numerical_range') {
            const hasRangeValue =
              Array.isArray(filterValue) &&
              filterValue.some(v => v !== null && v !== undefined);
            const rangeTooltip = hasRangeValue
              ? (filterValue as (number | null | undefined)[])
                  .filter(v => v !== null && v !== undefined)
                  .join(' – ')
              : undefined;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={hasRangeValue}
                tooltipTitle={rangeTooltip}
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                  updateFilterValue(index, undefined);
                }}
              >
                <NumericalRangeFilter
                  ref={filterRefs[index]}
                  Header={Header}
                  initialValue={initialValue}
                  min={min}
                  max={max}
                  name={id}
                  onSubmit={value => updateFilterValue(index, value)}
                />
              </CompactFilterTrigger>
            );
          }
          return null;
        },
      )}
    </>
  );
}

export default withTheme(forwardRef(UIFilters));
