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
import cx from 'classnames';
import { styled, useTheme } from '@superset-ui/core';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';

export interface OptionProps {
  value: string;
  label: string;
  className?: string;
}

export type OnChangeHandler = (key: React.Key) => void;
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
  key: React.Key;
}

const MenuItem = styled(Menu.Item)`
  &.ant-menu-item {
    height: auto;
    line-height: 1.4;

    padding-top: ${({ theme }) => theme.gridUnit}px;
    padding-bottom: ${({ theme }) => theme.gridUnit}px;

    margin-top: 0;
    margin-bottom: 0;

    &:not(:last-child) {
      margin-bottom: 0;
    }

    &:hover {
      background: ${({ theme }) => theme.colors.grayscale.light3};
    }

    &.active {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      background: ${({ theme }) => theme.colors.grayscale.light2};
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
    <AntdDropdown
      trigger={['click']}
      overlayStyle={{ zIndex: theme.zIndex.max }}
      overlay={
        <Menu onClick={({ key }: HandleSelectProps) => onChange(key)}>
          {options.map(option => (
            <MenuItem
              id="menu-item"
              key={option.value}
              className={cx('dropdown-item', {
                active: option.value === value,
              })}
            >
              {renderOption(option)}
            </MenuItem>
          ))}
        </Menu>
      }
    >
      <div role="button" css={{ display: 'flex', alignItems: 'center' }}>
        {selected && renderButton(selected)}
        <Icons.CaretDown
          iconColor={theme.colors.grayscale.base}
          css={{ marginTop: theme.gridUnit * 0.5 }}
        />
      </div>
    </AntdDropdown>
  );
};

export default PopoverDropdown;
