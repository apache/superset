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

import StyledSelect, { AsyncStyledSelect } from 'src/components/StyledSelect';
import SearchInput from 'src/components/SearchInput';
import { Filter, Filters, FilterValue, InternalFilter } from './types';

interface BaseFilter {
  Header: string;
  initialValue: any;
}
interface SelectFilterProps extends BaseFilter {
  onSelect: (selected: any) => any;
  selects: Filter['selects'];
  emptyLabel?: string;
  fetchSelects?: Filter['fetchSelects'];
}

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
  fetchSelects,
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
  const fetchAndFormatSelects = async () => {
    if (!fetchSelects) return { options: [clearFilterSelect] };
    const selectValues = await fetchSelects();
    return { options: [clearFilterSelect, ...selectValues] };
  };

  return (
    <FilterContainer>
      <Title>{Header}:</Title>
      {fetchSelects ? (
        <AsyncStyledSelect
          data-test="filters-select"
          value={value}
          onChange={onChange}
          loadOptions={fetchAndFormatSelects}
          placeholder={initialValue || emptyLabel}
          loadingPlaceholder="Loading..."
          clearable={false}
        />
      ) : (
        <StyledSelect
          data-test="filters-select"
          value={value}
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
      {filters.map(
        ({ Header, input, selects, unfilteredLabel, fetchSelects }, index) => {
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
                fetchSelects={fetchSelects}
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
        },
      )}
    </FilterWrapper>
  );
}

export default withTheme(UIFilters);
