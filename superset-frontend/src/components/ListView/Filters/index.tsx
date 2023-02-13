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
import React, {
  createRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
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
  ref: React.RefObject<{ clearFilters: () => void }>,
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
            onFilterUpdate,
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
