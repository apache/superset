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
import React from 'react';
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

interface UIFiltersProps {
  filters: Filters;
  internalFilters: InternalFilter[];
  updateFilterValue: (id: number, value: FilterValue['value']) => void;
}

function UIFilters({
  filters,
  internalFilters = [],
  updateFilterValue,
}: UIFiltersProps) {
  return (
    <>
      {filters.map(
        ({ Header, fetchSelects, id, input, paginate, selects }, index) => {
          const initialValue =
            internalFilters[index] && internalFilters[index].value;
          if (input === 'select') {
            return (
              <SelectFilter
                Header={Header}
                fetchSelects={fetchSelects}
                initialValue={initialValue}
                key={id}
                name={id}
                onSelect={(option: SelectOption | undefined) =>
                  updateFilterValue(index, option)
                }
                paginate={paginate}
                selects={selects}
              />
            );
          }
          if (input === 'search' && typeof Header === 'string') {
            return (
              <SearchFilter
                Header={Header}
                initialValue={initialValue}
                key={id}
                name={id}
                onSubmit={(value: string) => updateFilterValue(index, value)}
              />
            );
          }
          if (input === 'datetime_range') {
            return (
              <DateRangeFilter
                Header={Header}
                initialValue={initialValue}
                key={id}
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

export default withTheme(UIFilters);
