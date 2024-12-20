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
import { Collapse as AntdCollapse } from 'antd';
import { CollapseProps as AntdCollapseProps } from 'antd/lib/collapse';

export interface CollapseProps extends AntdCollapseProps {
  light?: boolean;
  bigger?: boolean;
  bold?: boolean;
  animateArrows?: boolean;
}

const Collapse = Object.assign(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  styled(({ light, bigger, bold, animateArrows, ...props }: CollapseProps) => (
    <AntdCollapse {...props} />
  ))`
    .ant-collapse-item {
      .ant-collapse-header {
        font-weight: ${({ bold, theme }) =>
          bold ? theme.fontWeightStrong : theme.fontWeightNormal};
        font-size: ${({ bigger, theme }) =>
          bigger ? `${theme.sizeUnit * 4}px` : 'inherit'};

        .ant-collapse-arrow svg {
          transition: ${({ animateArrows }) =>
            animateArrows ? 'transform 0.24s' : 'none'};
        }

        ${({ expandIconPosition }) =>
          expandIconPosition &&
          expandIconPosition === 'right' &&
          `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(90deg) !important;
            }
          `}

        ${({ light, theme }) =>
          light &&
          `
            color: ${theme.colorTextSecondary};
            .ant-collapse-arrow svg {
              color: ${theme.colorTextSecondary};
            }
          `}

        ${({ ghost, bordered, theme }) =>
          ghost &&
          bordered &&
          `
            border-bottom: 1px solid ${theme.colorBorderSecondary};
          `}
      }
      .ant-collapse-content {
        //background-color: ${({ theme }) => theme.colorBgLayout};
        .ant-collapse-content-box {
          .loading.inline {
            margin: ${({ theme }) => theme.sizeUnit * 12}px auto;
            display: block;
          }
        }
      }
    }
    .ant-collapse-item-active {
      .ant-collapse-header {
        ${({ expandIconPosition }) =>
          expandIconPosition &&
          expandIconPosition === 'right' &&
          `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(-90deg) !important;
            }
          `}
      }
    }
  `,
  {
    Panel: AntdCollapse.Panel,
  },
);

export default Collapse;
