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
import { Menu } from 'src/components/Menu';
import { MenuDotsDropdown, MenuDotsDropdownProps } from '.';

export default {
  title: 'Dropdown',
};

const menu = (
  <Menu>
    <Menu.Item>1st menu item</Menu.Item>
    <Menu.Item>2nd menu item</Menu.Item>
    <Menu.Item>3rd menu item</Menu.Item>
  </Menu>
);

const customOverlay = (
  <div
    style={{
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'yellow',
      width: 100,
      height: 100,
    }}
  >
    Custom overlay
  </div>
);

export const InteractiveDropdown = ({
  overlayType,
  ...rest
}: MenuDotsDropdownProps & { overlayType: string }) => (
  <MenuDotsDropdown
    {...rest}
    overlay={overlayType === 'custom' ? customOverlay : menu}
  />
);

InteractiveDropdown.argTypes = {
  overlayType: {
    defaultValue: 'menu',
    control: { type: 'radio' },
    options: ['menu', 'custom'],
  },
};
