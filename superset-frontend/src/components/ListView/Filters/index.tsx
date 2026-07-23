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
  useState,
  RefObject,
} from 'react';

import { withTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';

import type {
  ListViewFilterValue as FilterValue,
  ListViewFilters as Filters,
  InternalFilter,
  SelectOption,
} from '../types';
import type { FilterHandler } from './types';
import { NO_TIME_RANGE } from '@superset-ui/core';
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

  // Build datetime_range tooltips from the resolved [start, end] array value.
  // Handles both ISO strings and unix-ms numbers.
  useEffect(() => {
    filters.forEach((filter, index) => {
      if (filter.input !== 'datetime_range') return;
      const val = internalFilters?.[index]?.value;
      if (Array.isArray(val) && val.length === 2) {
        const fmt = (v: unknown) => {
          const d = new Date(v as string | number);
          return isNaN(d.getTime())
            ? String(v)
            : d.toISOString().replace('T', ' ').slice(0, 19);
        };
        const tooltip = `${fmt(val[0])} – ${fmt(val[1])}`;
        setTimeRangeTooltips(prev =>
          prev[index] === tooltip ? prev : { ...prev, [index]: tooltip },
        );
      } else {
        setTimeRangeTooltips(prev => {
          if (!(index in prev)) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
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

  // Search always leads the filter bar regardless of declaration order.
  // Only the first search filter renders; subsequent ones are skipped (see note below).
  // NOTE: This means secondary search fields (e.g. Email/Username on Users,
  // Group Key on RLS) are not currently accessible via the filter bar. Those
  // pages previously relied on multiple inline inputs. This is a known UX
  // trade-off — revisit if admin workflows require additional search fields.
  let searchFilterRendered = false;

  // Render in two passes: search first, then all other filter types.
  const renderFilter = (_: (typeof filters)[number], index: number) => {
    const {
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
      dateFilterValueType,
    } = filters[index];
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
          (typeof staticFallback === 'string' ? staticFallback : undefined)
        : t('Choose...');
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
      // dateFilterValueType absent or 'unix': column stores unix ms (e.g. Query History start_time).
      // 'iso': column stores ISO date strings (e.g. UsersList created_on, ActionLog dttm).
      const isUnixType = !dateFilterValueType || dateFilterValueType === 'unix';

      // initialValue may be [ms, ms] (unix), ["iso","iso"] (iso), or legacy string.
      // Always reconstruct panelValue as "ISO : ISO" so the TimeRange panel
      // can parse it as a Custom date range regardless of storage type.
      let resolvedIsoRange: [string, string] | null = null;
      if (Array.isArray(initialValue) && initialValue.length === 2) {
        if (typeof initialValue[0] === 'number') {
          resolvedIsoRange = [
            new Date(initialValue[0]).toISOString(),
            new Date(initialValue[1] as number).toISOString(),
          ];
        } else if (typeof initialValue[0] === 'string') {
          resolvedIsoRange = initialValue as [string, string];
        }
      }
      const legacyStringVal =
        !resolvedIsoRange &&
        typeof initialValue === 'string' &&
        initialValue !== NO_TIME_RANGE
          ? initialValue
          : null;
      const hasTimeValue = !!(resolvedIsoRange || legacyStringVal);
      const panelValue =
        resolvedIsoRange?.join(' : ') ?? legacyStringVal ?? undefined;
      return (
        <CompactFilterTrigger
          key={key}
          label={Header}
          hasValue={hasTimeValue}
          tooltipTitle={
            hasTimeValue ? (timeRangeTooltips[index] ?? panelValue) : undefined
          }
          popupType="dialog"
          onClear={() => {
            updateFilterValue(index, undefined);
          }}
        >
          {({ onClose }) => (
            <TimeRangeFilter
              ref={filterRefs[index]}
              value={panelValue}
              onClose={onClose}
              onSubmit={value => {
                if (!value) {
                  updateFilterValue(index, undefined);
                } else if (isUnixType) {
                  // Convert ISO strings to unix ms for numeric columns
                  updateFilterValue(index, [
                    new Date(value[0]).getTime(),
                    new Date(value[1]).getTime(),
                  ]);
                } else {
                  updateFilterValue(index, value);
                }
              }}
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
            updateFilterValue(index, undefined);
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
  };

  return (
    <>
      {/* Search first */}
      {filters.map((_, index) =>
        filters[index].input === 'search'
          ? renderFilter(filters[index], index)
          : null,
      )}
      {/* Then all other filter types */}
      {filters.map((_, index) =>
        filters[index].input !== 'search'
          ? renderFilter(filters[index], index)
          : null,
      )}
    </>
  );
}

export default withTheme(forwardRef(UIFilters));
