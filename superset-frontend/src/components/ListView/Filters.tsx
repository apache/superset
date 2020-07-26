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
import React, { useState } from 'react';
import { styled, withTheme } from '@superset-ui/style';

import {
  Select,
  PaginatedSelect,
  PartialThemeConfig,
  PartialStylesConfig,
} from 'src/components/Select';

import SearchInput from 'src/components/SearchInput';
import {
  Filter,
  Filters,
  FilterValue,
  InternalFilter,
  SelectOption,
} from './types';

interface BaseFilter {
  Header: string;
  initialValue: any;
}
interface SelectFilterProps extends BaseFilter {
  name?: string;
  onSelect: (selected: any) => any;
  selects: Filter['selects'];
  emptyLabel?: string;
  fetchSelects?: Filter['fetchSelects'];
  paginate?: boolean;
}

const FilterContainer = styled.div`
  display: inline-flex;
  margin-right: 2em;
`;

const FilterTitle = styled.label`
  font-weight: bold;
  line-height: 27px;
  margin: 0 0.4em 0 0;
`;

const filterSelectTheme: PartialThemeConfig = {
  spacing: {
    baseUnit: 2,
    minWidth: '5em',
  },
};

const filterSelectStyles: PartialStylesConfig = {
  container: (provider, { getValue }) => ({
    ...provider,
    // dynamic width based on label string length
    minWidth: `${Math.min(
      12,
      Math.max(5, 3 + getValue()[0].label.length / 2),
    )}em`,
  }),
  control: provider => ({
    ...provider,
    borderWidth: 0,
    boxShadow: 'none',
  }),
};

const CLEAR_SELECT_FILTER_VALUE = 'CLEAR_SELECT_FILTER_VALUE';

function SelectFilter({
  Header,
  selects = [],
  emptyLabel = 'None',
  initialValue,
  onSelect,
  fetchSelects,
  paginate = false,
}: SelectFilterProps) {
  const clearFilterSelect = {
    label: emptyLabel,
    value: CLEAR_SELECT_FILTER_VALUE,
  };

  const options = [clearFilterSelect, ...selects];

  const [selectedOption, setSelectedOption] = useState(clearFilterSelect);
  const onChange = (selected: SelectOption | null) => {
    if (selected === null) return;
    onSelect(
      selected.value === CLEAR_SELECT_FILTER_VALUE ? undefined : selected.value,
    );
    setSelectedOption(selected);
  };
  const fetchAndFormatSelects = async (
    inputValue: string,
    loadedOptions: SelectOption[],
    { page }: { page: number },
  ) => {
    // only include clear filter when filter value does not exist
    let result = inputValue || page > 0 ? [] : [clearFilterSelect];
    let hasMore = paginate;
    if (fetchSelects) {
      const selectValues = await fetchSelects(inputValue, page);
      // update matching option at initial load
      const matchingOption = result.find(x => x.value === initialValue);
      if (matchingOption) {
        setSelectedOption(matchingOption);
      }
      if (!selectValues.length) {
        hasMore = false;
      }
      result = [...result, ...selectValues];
    }
    return {
      options: result,
      hasMore,
      additional: {
        page: page + 1,
      },
    };
  };

  return (
    <FilterContainer>
      <FilterTitle>{Header}</FilterTitle>
      {fetchSelects ? (
        <PaginatedSelect
          data-test="filters-select"
          themeConfig={filterSelectTheme}
          stylesConfig={filterSelectStyles}
          value={selectedOption}
          onChange={onChange}
          loadOptions={fetchAndFormatSelects}
          placeholder={emptyLabel}
          loadingMessage={() => 'Loading...'}
          clearable={false}
          additional={{
            page: 0,
          }}
        />
      ) : (
        <Select
          data-test="filters-select"
          themeConfig={filterSelectTheme}
          stylesConfig={filterSelectStyles}
          value={selectedOption}
          options={options}
          onChange={onChange}
          clearable={false}
        />
      )}
    </FilterContainer>
  );
}

interface SearchHeaderProps extends BaseFilter {
  Header: string;
  onSubmit: (val: string) => void;
}

function SearchFilter({ Header, initialValue, onSubmit }: SearchHeaderProps) {
  const [value, setValue] = useState(initialValue || '');
  const handleSubmit = () => onSubmit(value);
  const onClear = () => {
    setValue('');
    onSubmit('');
  };

  return (
    <FilterContainer>
      <SearchInput
        data-test="filters-search"
        placeholder={Header}
        value={value}
        onChange={e => {
          setValue(e.currentTarget.value);
        }}
        onSubmit={handleSubmit}
        onClear={onClear}
      />
    </FilterContainer>
  );
}

interface UIFiltersProps {
  filters: Filters;
  internalFilters: InternalFilter[];
  updateFilterValue: (id: number, value: FilterValue['value']) => void;
}

const FilterWrapper = styled.div`
  padding: 24px 16px 8px;
`;

function UIFilters({
  filters,
  internalFilters = [],
  updateFilterValue,
}: UIFiltersProps) {
  return (
    <FilterWrapper>
      {filters.map(
        (
          {
            Header,
            id,
            input,
            selects,
            unfilteredLabel,
            fetchSelects,
            paginate,
          },
          index,
        ) => {
          const initialValue =
            internalFilters[index] && internalFilters[index].value;
          if (input === 'select') {
            return (
              <SelectFilter
                key={id}
                name={id}
                Header={Header}
                selects={selects}
                emptyLabel={unfilteredLabel}
                initialValue={initialValue}
                fetchSelects={fetchSelects}
                paginate={paginate}
                onSelect={(value: any) => updateFilterValue(index, value)}
              />
            );
          }
          if (input === 'search') {
            return (
              <SearchFilter
                key={id}
                Header={Header}
                initialValue={initialValue}
                onSubmit={(value: string) => updateFilterValue(index, value)}
              />
            );
          }
          return null;
        },
      )}
    </FilterWrapper>
  );
}

export default withTheme(UIFilters);
