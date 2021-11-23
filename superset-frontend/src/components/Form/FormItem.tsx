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
import Form from 'antd/lib/form';
import { styled } from '@superset-ui/core';

const StyledItem = styled(Form.Item)`
  ${({ theme }) => `
    .ant-form-item-label {
      padding-bottom: ${theme.gridUnit}px;
      & > label {
        text-transform: uppercase;
        font-size: ${theme.typography.sizes.s}px;
        color: ${theme.colors.grayscale.base};

        &.ant-form-item-required:not(.ant-form-item-required-mark-optional) {
          &::before {
            display: none;
          }
          &::after {
            display: inline-block;
            color: ${theme.colors.error.base};
            font-size: ${theme.typography.sizes.s}px;
            content: '*';
          }
        }
      }
    }
  `}
`;

export default StyledItem;
