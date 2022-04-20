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
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { AntdInput } from 'src/components';
import { SELECT_WIDTH } from 'src/components/ListView/utils';
import { FormLabel } from 'src/components/Form';
import { BaseFilter, FilterHandler } from './Base';

interface SearchHeaderProps extends BaseFilter {
  Header: string;
  onSubmit: (val: string) => void;
  name: string;
}

const Container = styled.div`
  width: ${SELECT_WIDTH}px;
`;

const SearchIcon = styled(Icons.Search)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const StyledInput = styled(AntdInput)`
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

function SearchFilter(
  { Header, name, initialValue, onSubmit }: SearchHeaderProps,
  ref: React.RefObject<FilterHandler>,
) {
  const [value, setValue] = useState(initialValue || '');
  const handleSubmit = () => {
    if (value) {
      onSubmit(value.trim());
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <Container>
      <FormLabel>{Header}</FormLabel>
      <StyledInput
        allowClear
        data-test="filters-search"
        placeholder={t('Type a value')}
        name={name}
        value={value}
        onChange={handleChange}
        onPressEnter={handleSubmit}
        onBlur={handleSubmit}
        prefix={<SearchIcon iconSize="l" />}
      />
    </Container>
  );
}

export default forwardRef(SearchFilter);
