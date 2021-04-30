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
import { withTheme, SupersetThemeProps } from '@superset-ui/core';
import {
  Select,
  PaginatedSelect,
  PartialThemeConfig,
} from 'src/components/Select';
import { Filter, SelectOption } from 'src/components/ListView/types';
import { filterSelectStyles } from 'src/components/ListView/utils';
import { FilterContainer, BaseFilter, FilterTitle } from './Base';

interface SelectFilterProps extends BaseFilter {
  emptyLabel?: string;
  fetchSelects?: Filter['fetchSelects'];
  name?: string;
  onSelect: (selected: any) => any;
  paginate?: boolean;
  selects: Filter['selects'];
  theme: SupersetThemeProps['theme'];
}

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
  let initialOption = clearFilterSelect;

  // Set initial value if not async
  if (!fetchSelects) {
    const matchingOption = options.find(x => x.value === initialValue);

    if (matchingOption) {
      initialOption = matchingOption;
    }
  }

  const [selectedOption, setSelectedOption] = useState(initialOption);
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
export default withTheme(SelectFilter);
