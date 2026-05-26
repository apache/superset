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
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
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
import { NO_TIME_RANGE, fetchTimeRange } from '@superset-ui/core';
import SearchFilter from './Search';
import NumericalRangeFilter from './NumericalRange';
import TimeRangeFilter from './TimeRange';
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

  // Evaluated human-readable labels for datetime_range pills (e.g. "2024-05-01 : 2024-05-31").
  const [timeRangeTooltips, setTimeRangeTooltips] = useState<
    Record<number, string>
  >({});

  // Tracks which datetime_range values have already been fetched so we don't
  // re-fire fetchTimeRange on every keystroke in an unrelated filter.
  const fetchedTimeValRef = useRef<Record<number, string>>({});

  // On cold load, URL params restore values but not labels for fetchSelects filters.
  // Fetch the first page of options and cache the matching label so the tooltip works.
  useEffect(() => {
    filters.forEach((filter, index) => {
      if (filter.input !== 'select' || !filter.fetchSelects) return;
      if (tooltipLabels[index]) return;
      const val = internalFilters?.[index]?.value as SelectOption | undefined;
      if (!val?.value) return;
      filter.fetchSelects('', 0, 500).then(result => {
        const match = result?.data?.find(
          (s: SelectOption) => s.value === val.value,
        );
        if (match) {
          const lbl =
            typeof match.label === 'string'
              ? match.label
              : String(match.value ?? '');
          setTooltipLabels(prev => ({ ...prev, [index]: lbl }));
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalFilters]);

  // Re-evaluate whenever active datetime_range values change.
  useEffect(() => {
    filters.forEach((filter, index) => {
      if (filter.input !== 'datetime_range') return;
      const val = internalFilters?.[index]?.value;
      const timeVal =
        typeof val === 'string' && val !== NO_TIME_RANGE ? val : undefined;
      if (!timeVal) {
        delete fetchedTimeValRef.current[index];
        setTimeRangeTooltips(prev => {
          if (!(index in prev)) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
        return;
      }
      if (fetchedTimeValRef.current[index] === timeVal) return;
      fetchedTimeValRef.current[index] = timeVal;
      fetchTimeRange(timeVal).then(({ value: actual, error }) => {
        if (!error && actual) {
          setTimeRangeTooltips(prev => ({ ...prev, [index]: actual }));
        }
      });
    });
  }, [filters, internalFilters]);

  const clearFilterAtIndex = useCallback(
    (index: number) => {
      filterRefs[index]?.current?.clearFilter?.();
      updateFilterValue(index, undefined);
      setTooltipLabels(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateFilterValue],
  );

  useImperativeHandle(ref, () => ({
    clearFilters: () => {
      filterRefs.forEach((_, index) => {
        filterRefs[index]?.current?.clearFilter?.();
        updateFilterValue(index, undefined);
      });
      setTooltipLabels({});
      setTimeRangeTooltips({});
    },
    clearFilterById: (id: string) => {
      const index = filters.findIndex(f => f.id === id);
      if (index >= 0) {
        clearFilterAtIndex(index);
      }
    },
  }));

  // Only the first search filter renders inline; subsequent ones are skipped
  // to keep one search box per page (multi-field search pages like Users would
  // otherwise show several input boxes in the header).
  // NOTE: This means secondary search fields (e.g. Email/Username on Users,
  // Group Key on RLS) are not currently accessible via the filter bar. Those
  // pages previously relied on multiple inline inputs. This is a known UX
  // trade-off — revisit if admin workflows require additional search fields.
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
            min,
            max,
            autoComplete,
            inputName,
            popupStyle,
          },
          index,
        ) => {
          const initialValue = internalFilters?.[index]?.value;
          if (input === 'select') {
            const selectValue = initialValue as SelectOption | undefined;
            // Prefer cached label (survives URL round-trips where only the value
            // is preserved). Fall back to the static selects list for cold loads.
            const cachedLabel = tooltipLabels[index];
            const staticFallback = cachedLabel
              ? undefined
              : selects?.find(s => s.value === selectValue?.value)?.label;
            const tooltipTitle = !!selectValue
              ? cachedLabel ||
                (typeof staticFallback === 'string'
                  ? staticFallback
                  : undefined)
              : undefined;
            return (
              <span key={key} data-test="select-filter-container">
                <CompactFilterTrigger
                  label={Header}
                  hasValue={!!selectValue}
                  tooltipTitle={tooltipTitle}
                  onClear={() => clearFilterAtIndex(index)}
                >
                  {({ isOpen, onClose }) => (
                    <CompactSelectPanel
                      ref={filterRefs[index]}
                      selects={selects}
                      fetchSelects={fetchSelects}
                      value={initialValue as SelectOption | undefined}
                      loading={loading ?? false}
                      isOpen={isOpen}
                      onClose={onClose}
                      panelStyle={popupStyle}
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
                  )}
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
            const timeRangeValue =
              typeof initialValue === 'string' ? initialValue : undefined;
            const hasTimeValue =
              !!timeRangeValue && timeRangeValue !== NO_TIME_RANGE;
            return (
              <CompactFilterTrigger
                key={key}
                label={Header}
                hasValue={hasTimeValue}
                tooltipTitle={
                  hasTimeValue
                    ? (timeRangeTooltips[index] ?? timeRangeValue)
                    : undefined
                }
                popupType="dialog"
                onClear={() => {
                  filterRefs[index]?.current?.clearFilter?.();
                }}
              >
                {({ onClose }) => (
                  <TimeRangeFilter
                    ref={filterRefs[index]}
                    value={timeRangeValue}
                    onClose={onClose}
                    onSubmit={value => updateFilterValue(index, value)}
                  />
                )}
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
                }}
              >
                {({ onClose }) => (
                  <FilterPopoverContent onClose={onClose}>
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
                )}
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
