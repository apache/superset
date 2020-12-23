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
<<<<<<< HEAD
import { Dropdown, Menu as AntdMenu, Input as AntdInput, Skeleton } from 'antd';
=======
import { Menu as AntdMenu, Dropdown, Skeleton } from 'antd';
>>>>>>> 0e64ceb2ad710a2906a65a0e6dfe63fe93b76d57
import { DropDownProps as AntdDropdownProps } from 'antd/lib/dropdown';
/*
  Antd is re-exported from here so we can override components with Emotion as needed.

  For documentation, see https://ant.design/components/overview/
 */
// eslint-disable-next-line no-restricted-imports
export {
  AutoComplete,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Empty,
  InputNumber,
  Modal,
  Typography,
  Tree,
  Popover,
  Radio,
  Row,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Tooltip,
  Input as AntdInput,
} from 'antd';
export { TreeProps } from 'antd/lib/tree';
export { FormInstance } from 'antd/lib/form';

export { default as Collapse } from './Collapse';
export { default as Badge } from './Badge';
export { default as Progress } from './ProgressBar';

export const MenuItem = styled(AntdMenu.Item)`
  > a {
    text-decoration: none;
  }

  &.ant-menu-item {
    height: ${({ theme }) => theme.gridUnit * 7}px;
    line-height: ${({ theme }) => theme.gridUnit * 7}px;
  }

  &.ant-menu-item,
  &.ant-dropdown-menu-item {
    span[role='button'] {
      display: inline-block;
      width: 100%;
    }
    transition-duration: 0s;
  }
`;

export const Menu = Object.assign(AntdMenu, {
  Item: MenuItem,
});

<<<<<<< HEAD
export const Input = styled(AntdInput)`
  &[type='text'],
  &[type='textarea'] {
    border: 1px solid ${({ theme }) => theme.colors.secondary.light3};
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }
`;

=======
>>>>>>> 0e64ceb2ad710a2906a65a0e6dfe63fe93b76d57
export const NoAnimationDropdown = (props: AntdDropdownProps) => (
  <Dropdown
    overlayStyle={{ zIndex: 4000, animationDuration: '0s' }}
    {...props}
  />
);

export const ThinSkeleton = styled(Skeleton)`
  h3 {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }

  ul {
    margin-bottom: 0;
  }
`;

export { default as Icon } from '@ant-design/icons';

export type DropdownProps = AntdDropdownProps;
