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
import React from 'react';
import { styled } from '@superset-ui/core';
import Select, { SelectProps } from 'antd/lib/select';

export {
  OptionType as NativeSelectOptionType,
  SelectProps as NativeSelectProps,
} from 'antd/lib/select';

const StyledNativeSelect = styled((props: SelectProps<any>) => (
  <Select getPopupContainer={(trigger: any) => trigger.parentNode} {...props} />
))`
  display: block;
`;

const StyledNativeGraySelect = styled(Select)`
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

export const NativeSelect = Object.assign(StyledNativeSelect, {
  Option: Select.Option,
});

export const NativeGraySelect = Object.assign(StyledNativeGraySelect, {
  Option: Select.Option,
});
