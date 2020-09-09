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
import React, { useState, ReactNode } from 'react';
import { styled, withTheme, SupersetThemeProps } from '@superset-ui/style';

import {
  Select,
  PaginatedSelect,
  PartialThemeConfig,
} from 'src/components/Select';

import SearchInput from 'src/components/SearchInput';
import {
  Filter,
  FilterValue,
  Filters,
  InternalFilter,
  SelectOption,
} from './types';
import { filterSelectStyles } from './utils';

interface BaseFilter {
  Header: ReactNode;
  initialValue: any;
}
interface SelectFilterProps extends BaseFilter {
  emptyLabel?: string;
  fetchSelects?: Filter['fetchSelects'];
  name?: string;
  onSelect: (selected: any) => any;
  paginate?: boolean;
  selects: Filter['selects'];
  theme: SupersetThemeProps['theme'];
}

const FilterContainer = styled.div`
  display: inline-flex;
  margin-right: 2em;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

const FilterTitle = styled.label`
  font-weight: bold;
  line-height: 27px;
  margin: 0 0.4em 0 0;
`;

const CLEAR_SELECT_FILTER_VALUE = 'CLEAR_SELECT_FILTER_VALUE';

function SelectFilter({
  Header,
  emptyLabel = 'None',
  fetchSelects,
  initialValue,
  onSelect,
  paginate = false,
  selects = [],
  theme,
}: SelectFilterProps) {
  const filterSelectTheme: PartialThemeConfig = {
    spacing: {
      baseUnit: 2,
      fontSize: theme.typography.sizes.s,
      minWidth: '5em',
    },
  };

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
      if (!selectValues.length) {
        hasMore = false;
      }
      result = [...result, ...selectValues];

      const matchingOption = result.find(x => x.value === initialValue);

      if (matchingOption) {
        setSelectedOption(matchingOption);
      }
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
      <FilterTitle>{Header}:</FilterTitle>
      {fetchSelects ? (
        <PaginatedSelect
          data-test="filters-select"
          defaultOptions
          themeConfig={filterSelectTheme}
          stylesConfig={filterSelectStyles}
          // @ts-ignore
          value={selectedOption}
          // @ts-ignore
          onChange={onChange}
          // @ts-ignore
          loadOptions={fetchAndFormatSelects}
          placeholder={emptyLabel}
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
const StyledSelectFilter = withTheme(SelectFilter);

interface SearchHeaderProps extends BaseFilter {
  Header: string;
  onSubmit: (val: string) => void;
  name: string;
}

function SearchFilter({
  Header,
  name,
  initialValue,
  onSubmit,
}: SearchHeaderProps) {
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
        name={name}
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
  display: inline-block;
  padding: ${({ theme }) => theme.gridUnit * 6}px
    ${({ theme }) => theme.gridUnit * 4}px
    ${({ theme }) => theme.gridUnit * 2}px;
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
            fetchSelects,
            id,
            input,
            paginate,
            selects,
            unfilteredLabel,
          },
          index,
        ) => {
          const initialValue =
            internalFilters[index] && internalFilters[index].value;
          if (input === 'select') {
            return (
              <StyledSelectFilter
                Header={Header}
                emptyLabel={unfilteredLabel}
                fetchSelects={fetchSelects}
                initialValue={initialValue}
                key={id}
                name={id}
                onSelect={(value: any) => updateFilterValue(index, value)}
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
          return null;
        },
      )}
    </FilterWrapper>
  );
}

export default withTheme(UIFilters);
