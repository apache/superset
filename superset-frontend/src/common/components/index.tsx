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
import { Dropdown, Menu as AntdMenu, Input as AntdInput, Skeleton } from 'antd';
import { DropDownProps } from 'antd/lib/dropdown';
/*
  Antd is re-exported from here so we can override components with Emotion as needed.

  For documentation, see https://ant.design/components/overview/
 */
export {
  AutoComplete,
  Avatar,
  Button,
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
  Slider,
  Row,
  Space,
  Skeleton,
  Switch,
  Tag,
  Tabs,
  Tooltip,
  Input as AntdInput,
} from 'antd';
export { Card as AntdCard } from 'antd';
export { FormInstance } from 'antd/lib/form';
export { RadioChangeEvent } from 'antd/lib/radio';
export { TreeProps } from 'antd/lib/tree';
export { default as Alert, AlertProps } from 'antd/lib/alert';
export { default as Select, SelectProps } from 'antd/lib/select';
export { default as List, ListItemProps } from 'antd/lib/list';

export { default as Collapse } from './Collapse';
export { default as Badge } from 'src/components/Badge';
export { default as Card } from './Card';
export { default as Progress } from 'src/components/ProgressBar';

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

export const Input = styled(AntdInput)`
  &[type='text'],
  &[type='textarea'] {
    border: 1px solid ${({ theme }) => theme.colors.secondary.light3};
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }
`;

export const NoAnimationDropdown = (props: DropDownProps) => (
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
