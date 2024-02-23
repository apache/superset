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
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { t } from '@superset-ui/core';
import { Select } from 'src/components';
import { Filter, SelectOption } from 'src/components/ListView/types';
import { FormLabel } from 'src/components/Form';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { FilterContainer, BaseFilter, FilterHandler } from './Base';

interface SelectFilterProps extends BaseFilter {
  fetchSelects?: Filter['fetchSelects'];
  name?: string;
  onSelect: (selected: SelectOption | undefined, isClear?: boolean) => void;
  paginate?: boolean;
  selects: Filter['selects'];
}

function SelectFilter(
  {
    Header,
    name,
    fetchSelects,
    initialValue,
    onSelect,
    selects = [],
  }: SelectFilterProps,
  ref: React.RefObject<FilterHandler>,
) {
  const [selectedOption, setSelectedOption] = useState(initialValue);

  const onChange = (selected: SelectOption) => {
    onSelect(
      selected ? { label: selected.label, value: selected.value } : undefined,
    );
    setSelectedOption(selected);
  };

  const onClear = () => {
    onSelect(undefined, true);
    setSelectedOption(undefined);
  };

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      onClear();
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

  return (
    <FilterContainer>
      {fetchSelects ? (
        <AsyncSelect
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          header={<FormLabel>{Header}</FormLabel>}
          onChange={onChange}
          onClear={onClear}
          options={fetchAndFormatSelects}
          placeholder={t('Select or type a value')}
          showSearch
          value={selectedOption}
        />
      ) : (
        <Select
          allowClear
          ariaLabel={typeof Header === 'string' ? Header : name || t('Filter')}
          data-test="filters-select"
          header={<FormLabel>{Header}</FormLabel>}
          labelInValue
          onChange={onChange}
          onClear={onClear}
          options={selects}
          placeholder={t('Select or type a value')}
          showSearch
          value={selectedOption}
        />
      )}
    </FilterContainer>
  );
}
export default forwardRef(SelectFilter);
