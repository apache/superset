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
// eslint-disable-next-line no-restricted-imports
import { Collapse as AntdCollapse } from 'antd';
import { CollapseProps as AntdCollapseProps } from 'antd/lib/collapse';

interface CollapseProps extends AntdCollapseProps {
  light?: boolean;
  bigger?: boolean;
  bold?: boolean;
}

const Collapse = Object.assign(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  styled(({ light, bigger, bold, ...props }: CollapseProps) => (
    <AntdCollapse {...props} />
  ))`
    height: 100%;
    .ant-collapse-item {
      border: 0;
      height: 100%;
      &:last-of-type.ant-collapse-item-active {
        padding-bottom: ${({ theme }) => theme.gridUnit * 3}px;
      }
      .ant-collapse-header {
        font-weight: ${({ bold, theme }) =>
          bold
            ? theme.typography.weights.bold
            : theme.typography.weights.normal};
        font-size: ${({ bigger, theme }) =>
          bigger ? `${theme.gridUnit * 4}px` : 'inherit'};

        ${({ light, theme }) =>
          light &&
          `
            color: ${theme.colors.grayscale.light4};
            .ant-collapse-arrow svg {
              color: ${theme.colors.grayscale.light4};
            }
          `}
      }
      .ant-collapse-content {
        height: 100%;
        .ant-collapse-content-box {
          height: 100%;
          .loading.inline {
            margin: ${({ theme }) => theme.gridUnit * 12}px auto;
            display: block;
          }
        }
      }
    }
  `,
  {
    Panel: AntdCollapse.Panel,
  },
);

export default Collapse;
