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
import styled from '@emotion/styled';
import { withTheme } from 'emotion-theming';
// @ts-ignore
import Select from 'react-select';

import { Filter, Filters, FilterValue, InternalFilter } from './types';

interface BaseFilter {
  Header: string;
  initialValue: any;
}
interface SelectFilterProps extends BaseFilter {
  onSelect: (selected: any) => any;
  selects: Filter['selects'];
  emptyLabel?: string;
}

const StyledSelect = styled(Select)`
  display: inline;
  &.is-focused:not(.is-open) > .Select-control {
    border: none;
    box-shadow: none;
  }
  .Select-control {
    display: inline-table;
    border: none;
    width: 100px;
    &:focus,
    &:hover {
      border: none;
      box-shadow: none;
    }

    .Select-arrow-zone {
      padding-left: 10px;
    }
  }
  .Select-menu-outer {
    margin-top: 0;
    border-bottom-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

const FilterContainer = styled.div`
  display: inline;
  margin-right: 8px;
`;

const Title = styled.span`
  font-weight: bold;
`;

const CLEAR_SELECT_FILTER_VALUE = 'CLEAR_SELECT_FILTER_VALUE';

function SelectFilter({
  Header,
  selects = [],
  emptyLabel = 'None',
  initialValue,
  onSelect,
}: SelectFilterProps) {
  const clearFilterSelect = {
    label: emptyLabel,
    value: CLEAR_SELECT_FILTER_VALUE,
  };
  const options = React.useMemo(() => [clearFilterSelect, ...selects], [
    emptyLabel,
    selects,
  ]);

  const [value, setValue] = useState(
    typeof initialValue === 'undefined'
      ? clearFilterSelect.value
      : initialValue,
  );
  const onChange = (selected: { label: string; value: any } | null) => {
    if (selected === null) return;
    setValue(selected.value);
    onSelect(
      selected.value === CLEAR_SELECT_FILTER_VALUE ? undefined : selected.value,
    );
  };

  return (
    <FilterContainer>
      <Title>{Header}:</Title>
      <StyledSelect
        data-test="filters-select"
        value={value}
        options={options}
        onChange={onChange}
        clearable={false}
      />
    </FilterContainer>
  );
}

interface SearchHeaderProps extends BaseFilter {
  Header: string;
  onSubmit: (val: string) => void;
}

const SearchInput = styled.input`
  background-color: #fff;
  background-image: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
  padding: 4px 8px;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
`;

function SearchFilter({ Header, initialValue, onSubmit }: SearchHeaderProps) {
  const [value, setValue] = useState(initialValue || '');
  const handleSubmit = () => onSubmit(value);

  return (
    <FilterContainer>
      <SearchInput
        data-test="filters-search"
        placeholder={Header}
        value={value}
        onChange={e => {
          setValue(e.currentTarget.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSubmit();
          }
        }}
        onBlur={handleSubmit}
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
      {filters.map(({ Header, input, selects, unfilteredLabel }, index) => {
        const initialValue =
          internalFilters[index] && internalFilters[index].value;
        if (input === 'select') {
          return (
            <SelectFilter
              key={Header}
              Header={Header}
              selects={selects}
              emptyLabel={unfilteredLabel}
              initialValue={initialValue}
              onSelect={(value: any) => updateFilterValue(index, value)}
            />
          );
        }
        if (input === 'search') {
          return (
            <SearchFilter
              key={Header}
              Header={Header}
              initialValue={initialValue}
              onSubmit={(value: string) => updateFilterValue(index, value)}
            />
          );
        }
        return null;
      })}
    </FilterWrapper>
  );
}

export default withTheme(UIFilters);
