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
import { Key } from 'react';
import cx from 'classnames';
import { css, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Dropdown } from '../Dropdown';

export interface OptionProps {
  value: string;
  label: string;
  className?: string;
}

export type OnChangeHandler = (key: Key) => void;
export type RenderElementHandler = (option: OptionProps) => JSX.Element;

export interface PopoverDropdownProps {
  id: string;
  options: OptionProps[];
  onChange: OnChangeHandler;
  value: string;
  renderButton?: RenderElementHandler;
  renderOption?: RenderElementHandler;
}

interface HandleSelectProps {
  key: Key;
}

const menuItemStyles = (theme: any) => css`
  &.ant-menu-item {
    height: auto;
    line-height: 1.4;

    padding-top: ${theme.sizeUnit}px;
    padding-bottom: ${theme.sizeUnit}px;

    margin-top: 0;
    margin-bottom: 0;

    &:not(:last-child) {
      margin-bottom: 0;
    }

    &:hover {
      background: ${theme.colorFillQuaternary};
    }

    &.active {
      font-weight: ${theme.fontWeightStrong};
      background: ${theme.colorFillTertiary};
    }
  }

  &.ant-menu-item-selected {
    color: unset;
  }
`;

const PopoverDropdown = (props: PopoverDropdownProps) => {
  const {
    value,
    options,
    onChange,
    renderButton = (option: OptionProps) => option.label,
    renderOption = (option: OptionProps) => (
      <div className={option.className}>{option.label}</div>
    ),
  } = props;

  const theme = useTheme();
  const selected = options.find(opt => opt.value === value);
  return (
    <Dropdown
      trigger={['click']}
      overlayStyle={{ zIndex: theme.zIndexBase }}
      menu={{
        onClick: ({ key }: HandleSelectProps) => onChange(key),
        items: options.map(option => ({
          key: option.value,
          label: renderOption(option),
          css: menuItemStyles(theme),
          className: cx('dropdown-item', {
            active: option.value === value,
          }),
        })),
      }}
    >
      <div role="button" css={{ display: 'flex', alignItems: 'center' }}>
        {selected && renderButton(selected)}
        <Icons.DownOutlined
          iconSize="s"
          css={{
            marginTop: theme.sizeUnit * 0.5,
            marginLeft: theme.sizeUnit * 0.5,
          }}
        />
      </div>
    </Dropdown>
  );
};

export default PopoverDropdown;
