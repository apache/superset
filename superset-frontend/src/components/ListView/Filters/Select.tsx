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
import React, { useState, useMemo } from 'react';
import { withTheme, SupersetThemeProps } from '@superset-ui/core';
import { Select } from 'src/components';
import { FormLabel } from 'src/components/Form';
import { Filter, SelectOption } from 'src/components/ListView/types';
import { FilterContainer, BaseFilter } from './Base';

interface SelectFilterProps extends BaseFilter {
  emptyLabel?: string;
  fetchSelects?: Filter['fetchSelects'];
  name?: string;
  onSelect: (selected: any) => any;
  paginate?: boolean;
  selects: Filter['selects'];
  theme: SupersetThemeProps['theme'];
}

const CLEAR_SELECT_FILTER_VALUE = -1;

function SelectFilter({
  Header,
  emptyLabel = 'None',
  fetchSelects,
  initialValue,
  onSelect,
  selects = [],
}: SelectFilterProps) {
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
  const onChange = (selected: SelectOption) => {
    onSelect(
      selected.value === CLEAR_SELECT_FILTER_VALUE ? undefined : selected.value,
    );
    setSelectedOption(selected);
  };

  const fetchAndFormatSelects = useMemo(
    () => async (inputValue: string, page: number, pageSize: number) => {
      // only include clear filter when filter value does not exist
      let result = inputValue || page > 0 ? [] : [clearFilterSelect];
      if (fetchSelects) {
        const selectValues = await fetchSelects(inputValue, page, pageSize);
        const totalCount = selectValues.totalCount + result.length;
        result = [...result, ...selectValues.data];

        const matchingOption = result.find(x => x.value === initialValue);
        if (matchingOption) {
          setSelectedOption(matchingOption);
        }

        return {
          data: result,
          totalCount,
        };
      }
      return {
        data: [],
        totalCount: 0,
      };
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <FilterContainer>
      <Select
        ariaLabel={typeof Header === 'string' ? Header : emptyLabel}
        labelInValue
        data-test="filters-select"
        header={<FormLabel>{Header}</FormLabel>}
        onChange={onChange}
        options={fetchSelects ? fetchAndFormatSelects : options}
        placeholder={emptyLabel}
        value={selectedOption}
      />
    </FilterContainer>
  );
}
export default withTheme(SelectFilter);
