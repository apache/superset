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
import {
  Collapse as AntdCollapse,
  CollapseProps as AntdCollapseProps,
} from 'antd-v5';

export interface CollapseProps extends AntdCollapseProps {
  animateArrows?: boolean;
}

const Collapse = styled((props: CollapseProps) => <AntdCollapse {...props} />)`
  .antd5-collapse-item {
    .antd5-collapse-header {
      .antd5-collapse-arrow svg {
        transition: ${({ animateArrows }) =>
          animateArrows ? 'transform 0.24s' : 'none'};
      }

      ${({ expandIconPosition }) =>
        expandIconPosition &&
        expandIconPosition === 'right' &&
        `
            .anticon.anticon-right.antd5-collapse-arrow > svg {
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
    .antd5-collapse-content {
      color: ${({ theme }) => theme.colorText};

      .antd5-collapse-content-box {
        .loading.inline {
          margin: ${({ theme }) => theme.sizeUnit * 12}px auto;
          display: block;
        }
      }
    }
  }

  .hidden-collapse-header .antd5-collapse-header {
    display: none;
  }

  .antd5-collapse-item-active {
    .antd5-collapse-header {
      ${({ expandIconPosition }) =>
        expandIconPosition &&
        expandIconPosition === 'right' &&
        `
            .anticon.anticon-right.antd5-collapse-arrow > svg {
              transform: rotate(-90deg) !important;
            }
          `}
    }
  }
`;

export default Collapse;
