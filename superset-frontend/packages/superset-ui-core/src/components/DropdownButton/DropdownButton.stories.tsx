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
import { Menu } from '@superset-ui/core/components/Menu';
import { DropdownButton } from '.';
import type { DropdownButtonProps } from './types';

export default {
  title: 'Components/DropdownButton',
};

const menu = (
  <Menu
    items={[
      { label: '1st menu item', key: '1' },
      { label: '2nd menu item', key: '2' },
      { label: '3rd menu item', key: '3' },
    ]}
  />
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
    control: { type: 'select' },
    options: PLACEMENTS,
  },
  overlay: {
    defaultValue: menu,
    table: {
      disable: true,
    },
  },
};
