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
  forwardRef,
  useImperativeHandle,
  useState,
  RefObject,
  ChangeEvent,
} from 'react';

import { t, useTheme } from '@superset-ui/core';
import {
  Input,
  InfoTooltip,
  FormLabel,
  Icons,
  Flex,
} from '@superset-ui/core/components';
import type { BaseFilter, FilterHandler } from './types';
import { FilterContainer } from './Base';
import { SELECT_WIDTH } from '../utils';

interface SearchHeaderProps extends BaseFilter {
  Header: string;
  onSubmit: (val: string) => void;
  name: string;
  toolTipDescription: string | undefined;
}

function SearchFilter(
  {
    Header,
    name,
    initialValue,
    toolTipDescription,
    onSubmit,
  }: SearchHeaderProps,
  ref: RefObject<FilterHandler>,
) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue || '');
  const handleSubmit = () => {
    if (value) {
      onSubmit(value.trim());
    }
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.currentTarget.value);
    if (e.currentTarget.value === '') {
      onSubmit('');
    }
  };

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setValue('');
      onSubmit('');
    },
  }));

  return (
    <FilterContainer
      data-test="search-filter-container"
      width={SELECT_WIDTH}
      vertical
      justify="center"
      align="start"
    >
      <Flex>
        <FormLabel>{Header}</FormLabel>
        {toolTipDescription && <InfoTooltip tooltip={toolTipDescription} />}
      </Flex>
      <Input
        allowClear
        data-test="filters-search"
        placeholder={t('Type a value')}
        name={name}
        value={value}
        onChange={handleChange}
        onPressEnter={handleSubmit}
        onBlur={handleSubmit}
        prefix={
          <Icons.SearchOutlined iconColor={theme.colorIcon} iconSize="l" />
        }
      />
    </FilterContainer>
  );
}

export default forwardRef(SearchFilter);
