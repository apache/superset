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
import { styled } from '@superset-ui/core';
import React from 'react';
import Icon from 'src/components/Icon';

interface SearchInputProps {
  onSubmit: () => void;
  onClear: () => void;
  value: string;
  onChange: React.EventHandler<React.ChangeEvent<HTMLInputElement>>;
  placeholder?: string;
  name?: string;
}

const SearchInputWrapper = styled.div`
  position: relative;
`;

const StyledInput = styled.input`
  width: 200px;
  background-image: none;
  border: 1px solid ${({ theme }) => theme.colors.secondary.light2};
  border-radius: 4px;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
  padding: 4px 28px;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  &:focus {
    outline: none;
  }
`;

const commonStyles = `
  position: absolute;
  z-index: 2;
  display: block;
  cursor: pointer;
`;
const SearchIcon = styled(Icon)`
  ${commonStyles}
  top: 1px;
  left: 2px;
`;

const ClearIcon = styled(Icon)`
  ${commonStyles}
  right: 0px;
  top: 1px;
`;

export default function SearchInput({
  onChange,
  onClear,
  onSubmit,
  placeholder = 'Search',
  name,
  value,
}: SearchInputProps) {
  return (
    <SearchInputWrapper>
      <SearchIcon
        data-test="search-submit"
        role="button"
        name="search"
        onClick={() => onSubmit()}
      />
      <StyledInput
        data-test="search-input"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onSubmit();
          }
        }}
        onBlur={() => onSubmit()}
        placeholder={placeholder}
        onChange={onChange}
        value={value}
        name={name}
      />
      {value && (
        <ClearIcon
          data-test="search-clear"
          role="button"
          name="cancel-x"
          onClick={() => onClear()}
        />
      )}
    </SearchInputWrapper>
  );
}
