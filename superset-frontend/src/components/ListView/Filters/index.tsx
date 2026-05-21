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
  useState,
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
import FilterPopoverContent from './FilterPopoverContent';

interface UIFiltersProps {
  filters: Filters;
  internalFilters: InternalFilter[];
  updateFilterValue: (id: number, value: FilterValue['value']) => void;
}

function UIFilters(
  { filters, internalFilters = [], updateFilterValue }: UIFiltersProps,
  ref: RefObject<{
    clearFilters: () => void;
    clearFilterById: (id: string) => void;
  }>,
) {
  const filterRefs = useMemo(
    () =>
      Array.from({ length: filters.length }, () => createRef<FilterHandler>()),
    [filters.length],
  );

  // Cache display labels for select filters so tooltip works after URL round-trip
  // (URL serialization strips the label, leaving only the value).
  const [tooltipLabels, setTooltipLabels] = useState<Record<number, string>>(
    {},
  );

  useImperativeHandle(ref, () => ({
    clearFilters: () => {
      filterRefs.forEach((filter, index) => {
        filter.current?.clearFilter?.();
        // Direct reset as safety net — ensures URL updates even if the ref
        // is stale (e.g. filter value was hydrated from URL after page refresh).
        updateFilterValue(index, undefined);
      });
      setTooltipLabels({});
    },
    clearFilterById: (id: string) => {
      const index = filters.findIndex(f => f.id === id);
      if (index >= 0) {
        filterRefs[index]?.current?.clearFilter?.();
        updateFilterValue(index, undefined);
        setTooltipLabels(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    },
  }));

  // Only the first search filter renders inline; subsequent ones are skipped
  // to keep one search box per page (multi-field search pages like Users would
  // otherwise show several input boxes in the header).
  let searchFilterRendered = false;

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
            selects,
            toolTipDescription,
            onFilterUpdate,
            loading,
            dateFilterValueType,
            min,
            max,
            autoComplete,
            inputName,
          },
          index,
        ) => {
          const initialValue = internalFilters?.[index]?.value;
          if (input === 'select') {
            const selectValue = initialValue as SelectOption | undefined;
            // Use cached label — URL round-trip strips the label from internalFilters,
            // leaving only the value (e.g. {value: 1} with no label field).
            const tooltipTitle = !!selectValue
              ? tooltipLabels[index]
              : undefined;
            return (
              <span key={key} data-test="select-filter-container">
                <CompactFilterTrigger
                  label={Header}
                  hasValue={!!selectValue}
                  tooltipTitle={tooltipTitle}
                  onClear={() => {
                    filterRefs[index]?.current?.clearFilter?.();
                    updateFilterValue(index, undefined);
                    setTooltipLabels(prev => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    });
                  }}
                >
                  <CompactSelectPanel
                    ref={filterRefs[index]}
                    selects={selects}
                    fetchSelects={fetchSelects}
                    value={initialValue as SelectOption | undefined}
                    loading={loading ?? false}
                    onSelect={(
                      option: SelectOption | undefined,
                      isClear?: boolean,
                    ) => {
                      if (option && !isClear) {
                        setTooltipLabels(prev => ({
                          ...prev,
                          [index]:
                            typeof option.label === 'string'
                              ? option.label
                              : String(option.value ?? ''),
                        }));
                      }
                      if (onFilterUpdate && !isClear) {
                        onFilterUpdate(option);
                      }
                      updateFilterValue(index, option);
                    }}
                  />
                </CompactFilterTrigger>
              </span>
            );
          }
          if (input === 'search' && typeof Header === 'string') {
            if (searchFilterRendered) return null;
            searchFilterRendered = true;
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
              Array.isArray(initialValue) && initialValue.some(Boolean);
            const dateTooltip = hasDateValue
              ? (initialValue as (string | number)[])
                  .filter(Boolean)
                  .join(' – ')
              : undefined;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={hasDateValue}
                tooltipTitle={dateTooltip}
                popupType="dialog"
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                  updateFilterValue(index, undefined);
                }}
              >
                <FilterPopoverContent>
                  <DateRangeFilter
                    ref={filterRefs[index]}
                    Header={Header}
                    initialValue={initialValue}
                    name={id}
                    onSubmit={value => updateFilterValue(index, value)}
                    dateFilterValueType={dateFilterValueType || 'unix'}
                  />
                </FilterPopoverContent>
              </CompactFilterTrigger>
            );
          }
          if (input === 'numerical_range') {
            const hasRangeValue =
              Array.isArray(initialValue) &&
              initialValue.some(v => v !== null && v !== undefined);
            const rangeTooltip = hasRangeValue
              ? (initialValue as (number | null | undefined)[])
                  .filter(v => v !== null && v !== undefined)
                  .join(' – ')
              : undefined;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={hasRangeValue}
                tooltipTitle={rangeTooltip}
                popupType="dialog"
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                  updateFilterValue(index, undefined);
                }}
              >
                <FilterPopoverContent>
                  <NumericalRangeFilter
                    ref={filterRefs[index]}
                    Header={Header}
                    initialValue={initialValue}
                    min={min}
                    max={max}
                    name={id}
                    onSubmit={value => updateFilterValue(index, value)}
                  />
                </FilterPopoverContent>
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
