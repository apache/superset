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
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type RefObject,
} from 'react';

import { t } from '@apache-superset/core/translation';
import { Select, AsyncSelect, FormLabel } from '@superset-ui/core/components';
import { ListViewFilter as Filter, SelectOption } from '../types';
import type { BaseFilter, FilterHandler } from './types';
import { FilterContainer } from './Base';
import { SELECT_WIDTH } from '../utils';

interface SelectFilterProps extends BaseFilter {
  fetchSelects?: Filter['fetchSelects'];
  mode?: 'single' | 'multiple';
  name?: string;
  onSelect: (
    selected: SelectOption | SelectOption[] | undefined,
    isClear?: boolean,
  ) => void;
  optionFilterProps?: string[];
  paginate?: boolean;
  selects: Filter['selects'];
  loading?: boolean;
  dropdownStyle?: React.CSSProperties;
}

function normalizeMultiSelectValue(
  initialValue: unknown,
  selects: SelectOption[],
): SelectOption[] {
  if (!Array.isArray(initialValue)) {
    return [];
  }

  return initialValue
    .filter(value => value !== null && value !== undefined)
    .map(value => {
      if (
        typeof value === 'object' &&
        value !== null &&
        'value' in value &&
        'label' in value
      ) {
        return value as SelectOption;
      }

      const matchedOption = selects.find(option => option.value === value);
      if (matchedOption) {
        return matchedOption;
      }

      return {
        label: String(value),
        value,
      };
    });
}

function SelectFilter(
  {
    Header,
    name,
    fetchSelects,
    initialValue,
    mode = 'single',
    onSelect,
    optionFilterProps,
    selects = [],
    loading = false,
    dropdownStyle,
  }: SelectFilterProps,
  ref: RefObject<FilterHandler>,
) {
  const [selectedOption, setSelectedOption] = useState(
    mode === 'single' ? initialValue : undefined,
  );
  const [selectedOptions, setSelectedOptions] = useState<SelectOption[]>(
    mode === 'multiple' ? normalizeMultiSelectValue(initialValue, selects) : [],
  );

  const onChange = (selected: SelectOption) => {
    onSelect(
      selected
        ? {
            label:
              typeof selected.label === 'string'
                ? selected.label
                : String(selected.value),
            value: selected.value,
          }
        : undefined,
    );
    setSelectedOption(selected);
  };

  const onClear = () => {
    onSelect(undefined, true);
    setSelectedOption(undefined);
  };

  const onMultiChange = (selected: SelectOption[]) => {
    const valid = (selected ?? []).filter(Boolean);
    setSelectedOptions(valid);
    onSelect(valid.length ? valid : undefined, valid.length === 0);
  };

  const onMultiClear = () => {
    setSelectedOptions([]);
    onSelect(undefined, true);
  };

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      if (mode === 'multiple') {
        onMultiClear();
      } else {
        onClear();
      }
    },
  }));

  const fetchAndFormatSelects = useMemo(
    () => async (inputValue: string, page: number, pageSize: number) => {
      if (fetchSelects) {
        const selectValues = await fetchSelects(inputValue, page, pageSize);
        return {
          data: selectValues.data,
          totalCount: selectValues.totalCount,
        };
      }
      return {
        data: [],
        totalCount: 0,
      };
    },
    [fetchSelects],
  );
  const placeholder = t('Choose...');
  return (
    <FilterContainer
      data-test="select-filter-container"
      width={SELECT_WIDTH}
      vertical
      justify="center"
      align="start"
    >
      <FormLabel>{Header}</FormLabel>
      {fetchSelects ? (
        <AsyncSelect
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          onChange={onChange}
          onClear={onClear}
          options={fetchAndFormatSelects}
          optionFilterProps={optionFilterProps}
          placeholder={placeholder}
          dropdownStyle={dropdownStyle}
          showSearch
          value={selectedOption}
        />
      ) : mode === 'multiple' ? (
        <Select
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          labelInValue
          mode="multiple"
          onChange={onMultiChange as any}
          onClear={onMultiClear}
          options={selects}
          placeholder={placeholder}
          dropdownStyle={dropdownStyle}
          showSearch
          value={selectedOptions}
          loading={loading}
        />
      ) : (
        <Select
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          labelInValue
          onChange={onChange}
          onClear={onClear}
          options={selects}
          placeholder={placeholder}
          dropdownStyle={dropdownStyle}
          showSearch
          value={selectedOption}
          loading={loading}
        />
      )}
    </FilterContainer>
  );
}
export default forwardRef(SelectFilter);
