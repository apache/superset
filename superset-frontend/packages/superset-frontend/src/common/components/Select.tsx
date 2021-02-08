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
import { Select as BaseSelect } from 'src/common/components';

const StyledSelect = styled(BaseSelect)`
  display: block;
`;

const StyledGraySelect = styled(StyledSelect)`
  &.ant-select-single {
    .ant-select-selector {
      height: 36px;
      padding: 0 11px;
      background-color: ${({ theme }) => theme.colors.grayscale.light3};
      border: none;

      .ant-select-selection-search-input {
        height: 100%;
      }

      .ant-select-selection-item,
      .ant-select-selection-placeholder {
        line-height: 35px;
        color: ${({ theme }) => theme.colors.grayscale.dark1};
      }
    }
  }
`;
const StyledOption = BaseSelect.Option;

export const Select = Object.assign(StyledSelect, {
  Option: StyledOption,
});

export const GraySelect = Object.assign(StyledGraySelect, {
  Option: StyledOption,
});
