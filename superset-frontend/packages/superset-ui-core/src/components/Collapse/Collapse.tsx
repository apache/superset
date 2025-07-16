/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file * to you under the Apache License, Version 2.0 (the
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
import { Collapse as AntdCollapse } from 'antd';
import type { CollapseProps } from './types';

const StyledCollapse = styled((props: CollapseProps) => (
  <AntdCollapse {...props} />
))`
  ${({ modalMode }) =>
    modalMode &&
    `
      border-radius: 0;
      border-left: 0;
      border-right: 0;
    `}
  .ant-collapse-item {
    .ant-collapse-header {
      .ant-collapse-arrow svg {
        transition: ${({ animateArrows }) =>
          animateArrows ? 'transform 0.24s' : 'none'};
      }

      ${({ expandIconPosition }) =>
        expandIconPosition &&
        expandIconPosition === 'end' &&
        `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(90deg) !important;
            }
          `}
    }

    ${({ ghost, bordered, theme }) =>
      ghost &&
      bordered &&
      `
        border-bottom: 1px solid ${theme.colorBorderSecondary};
      `}
    .ant-collapse-content {
      color: ${({ theme }) => theme.colorText};

      .ant-collapse-content-box {
        .loading.inline {
          margin: ${({ theme }) => theme.sizeUnit * 12}px auto;
          display: block;
        }
      }
    }
  }

  .hidden-collapse-header .ant-collapse-header {
    display: none;
  }

  .ant-collapse-item-active {
    .ant-collapse-header {
      ${({ expandIconPosition }) =>
        expandIconPosition &&
        expandIconPosition === 'end' &&
        `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(-90deg) !important;
            }
          `}
    }
  }
`;

// Type-safe extension to preserve Collapse.Panel
type CollapseWithPanel = typeof StyledCollapse & {
  Panel: typeof AntdCollapse.Panel;
};

export const Collapse = StyledCollapse as CollapseWithPanel;
Collapse.Panel = AntdCollapse.Panel;

export type { CollapseProps };
