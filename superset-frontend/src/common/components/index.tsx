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
// eslint-disable-next-line no-restricted-imports
import { Skeleton, Menu as AntdMenu } from 'antd';

/*
  Antd is re-exported from here so we can override components with Emotion as needed.

  For documentation, see https://ant.design/components/overview/
 */
// eslint-disable-next-line no-restricted-imports
export {
  Avatar,
  Card,
  Collapse,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Modal,
  Popover,
  Select,
  Skeleton,
  Tabs,
  Tooltip,
} from 'antd';

export const MenuItem = styled(AntdMenu.Item)`
  > a {
    text-decoration: none;
  }

  &.ant-menu-item {
    height: ${({ theme }) => theme.gridUnit * 7}px;
    line-height: ${({ theme }) => theme.gridUnit * 7}px;
  }
`;

export const Menu = Object.assign(AntdMenu, {
  Item: MenuItem,
});

export const ThinSkeleton = styled(Skeleton)`
  h3 {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }

  ul {
    margin-bottom: 0;
  }
`;

export { default as Icon } from '@ant-design/icons';
