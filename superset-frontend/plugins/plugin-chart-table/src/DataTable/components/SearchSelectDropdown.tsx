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
/* eslint-disable import/no-extraneous-dependencies */
import { styled } from '@superset-ui/core';
import { RawAntdSelect } from '@superset-ui/core/components';
import { SearchOption } from '../../types';

const StyledSelect = styled(RawAntdSelect)`
  width: 120px;
  margin-right: 8px;
`;

interface SearchSelectDropdownProps {
  /** The currently selected search column value */
  value?: string;
  /** Function triggered when a new search column is selected */
  onChange: (searchCol: string) => void;
  /** Available search column options to populate the dropdown */
  searchOptions: SearchOption[];
}

function SearchSelectDropdown({
  value,
  onChange,
  searchOptions,
}: SearchSelectDropdownProps) {
  return (
    <StyledSelect
      className="search-select"
      value={value || (searchOptions?.[0]?.value ?? '')}
      options={searchOptions}
      onChange={onChange}
    />
  );
}

export default SearchSelectDropdown;
