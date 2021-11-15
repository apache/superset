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
import { Menu } from 'src/common/components';
import { DropdownButton, DropdownButtonProps } from '.';

export default {
  title: 'DropdownButton',
};

const menu = (
  <Menu>
    <Menu.Item>1st menu item</Menu.Item>
    <Menu.Item>2nd menu item</Menu.Item>
    <Menu.Item>3rd menu item</Menu.Item>
  </Menu>
);

const PLACEMENTS = [
  'bottom',
  'bottomLeft',
  'bottomRight',
  'left',
  'leftBottom',
  'leftTop',
  'right',
  'rightBottom',
  'rightTop',
  'top',
  'topLeft',
  'topRight',
];

export const InteractiveDropdownButton = (args: DropdownButtonProps) => (
  <div style={{ margin: '50px 100px' }}>
    <DropdownButton {...args}>Hover</DropdownButton>
  </div>
);

InteractiveDropdownButton.args = {
  tooltip: 'Tooltip',
};

InteractiveDropdownButton.argTypes = {
  placement: {
    defaultValue: 'top',
    control: { type: 'select', options: PLACEMENTS },
  },
  overlay: {
    defaultValue: menu,
    table: {
      disable: true,
    },
  },
};

InteractiveDropdownButton.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
