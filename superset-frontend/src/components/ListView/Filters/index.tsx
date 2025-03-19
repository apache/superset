// DODO was here
import {
  createRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  RefObject,
} from 'react';

import { withTheme } from '@superset-ui/core';

import {
  FilterValue,
  Filters,
  InternalFilter,
  SelectOption,
} from 'src/components/ListView/types';
import SearchFilter from './Search';
import SelectFilter from './Select';
import DateRangeFilter from './DateRange';
import { FilterHandler } from './Base';

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
            paginate,
            selects,
            toolTipDescription,
            onFilterUpdate,
            width, // DODO added 44211759
          },
          index,
        ) => {
          const initialValue = internalFilters?.[index]?.value;
          if (input === 'select') {
            return (
              <SelectFilter
                ref={filterRefs[index]}
                Header={Header}
                fetchSelects={fetchSelects}
                initialValue={initialValue}
                key={key}
                name={id}
                onSelect={(
                  option: SelectOption | undefined,
                  isClear?: boolean,
                ) => {
                  if (onFilterUpdate) {
                    // Filter change triggers both onChange AND onClear, only want to track onChange
                    if (!isClear) {
                      onFilterUpdate(option);
                    }
                  }

                  updateFilterValue(index, option);
                }}
                paginate={paginate}
                selects={selects}
                width={width} // DODO added 44211759
              />
            );
          }
          if (input === 'search' && typeof Header === 'string') {
            return (
              <SearchFilter
                ref={filterRefs[index]}
                Header={Header}
                initialValue={initialValue}
                key={key}
                name={id}
                toolTipDescription={toolTipDescription}
                onSubmit={(value: string) => {
                  if (onFilterUpdate) {
                    onFilterUpdate(value);
                  }

                  updateFilterValue(index, value);
                }}
              />
            );
          }
          if (input === 'datetime_range') {
            return (
              <DateRangeFilter
                ref={filterRefs[index]}
                Header={Header}
                initialValue={initialValue}
                key={key}
                name={id}
                onSubmit={value => updateFilterValue(index, value)}
              />
            );
          }
          return null;
        },
      )}
    </>
  );
}

export default withTheme(forwardRef(UIFilters));
