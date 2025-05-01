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
import { type ComponentProps } from 'react';

import { Dropdown } from 'antd-v5';
import { Tooltip, TooltipPlacement } from 'src/components/Tooltip';
import { kebabCase } from 'lodash';
import { css, useTheme } from '@superset-ui/core';

export type DropdownButtonProps = ComponentProps<typeof Dropdown.Button> & {
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
};

export const DropdownButton = ({
  dropdownRender,
  tooltip,
  tooltipPlacement,
  children,
  ...rest
}: DropdownButtonProps) => {
  const theme = useTheme();
  const { type: buttonType } = rest;
  // divider implementation for default (non-primary) buttons
  const defaultBtnCss = css`
    ${(!buttonType || buttonType === 'default') &&
    `.antd5-dropdown-trigger {
      position: relative;
      &:before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 1px;
        height: 100%;
        background-color: ${theme.colors.grayscale.light2};
      }
      .anticon {
        vertical-align: middle;
      }
    }`}
  `;
  const button = (
    <Dropdown.Button
      dropdownRender={dropdownRender}
      {...rest}
      css={[
        defaultBtnCss,
        css`
          .antd5-btn {
            height: 30px;
            box-shadow: none;
            font-size: ${theme.typography.sizes.s}px;
            font-weight: ${theme.typography.weights.bold};
          }
        `,
      ]}
    >
      {children}
    </Dropdown.Button>
  );
  if (tooltip) {
    return (
      <Tooltip
        placement={tooltipPlacement}
        id={`${kebabCase(tooltip)}-tooltip`}
        title={tooltip}
      >
        {button}
      </Tooltip>
    );
  }
  return button;
};
