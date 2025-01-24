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
import { useTheme } from '@superset-ui/core';
import { RefObject, useMemo, ReactNode, useState } from 'react';
import Icons from 'src/components/Icons';
import { Menu, MenuProps } from 'src/components/Menu';
import { Dropdown } from '../Dropdown';

const { SubMenu } = Menu;

type SubMenuItemProps = { key: string; label: string | ReactNode };

export interface DropDownSelectableProps extends Pick<MenuProps, 'onSelect'> {
  ref?: RefObject<HTMLDivElement>;
  icon: ReactNode;
  info?: string;
  menuItems: {
    key: string;
    label: string | ReactNode;
    children?: SubMenuItemProps[];
    divider?: boolean;
  }[];
  selectedKeys?: string[];
}

const DropdownSelectableIcon = (props: DropDownSelectableProps) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const { icon, info, menuItems, selectedKeys, onSelect } = props;

  const handleVisibleChange = setVisible;

  const handleMenuSelect: MenuProps['onSelect'] = info => {
    if (onSelect) {
      onSelect(info);
    }
    setVisible(false);
  };
  const menuItem = useMemo(
    () => (label: string | ReactNode, key: string, divider?: boolean) => (
      <>
        <Menu.Item key={key}>
          {label}
          {selectedKeys?.includes(key) && (
            <Icons.Check
              iconColor={theme.colors.primary.base}
              className="tick-menu-item"
              iconSize="xl"
            />
          )}
        </Menu.Item>
        {divider && <Menu.Divider />}
      </>
    ),
    [selectedKeys, theme.colors.primary.base],
  );

  const overlayMenu = useMemo(
    () => (
      <>
        {info && (
          <div className="info" data-test="dropdown-selectable-info">
            {info}
          </div>
        )}
        <Menu
          selectedKeys={selectedKeys}
          onSelect={handleMenuSelect}
          selectable
        >
          {menuItems.map(m =>
            m.children?.length ? (
              <SubMenu
                title={m.label}
                key={m.key}
                data-test="dropdown-selectable-icon-submenu"
              >
                {m.children.map(s => menuItem(s.label, s.key))}
              </SubMenu>
            ) : (
              menuItem(m.label, m.key, m.divider)
            ),
          )}
        </Menu>
      </>
    ),
    [selectedKeys, onSelect, info, menuItems, menuItem, handleMenuSelect],
  );

  return (
    <Dropdown
      dropdownRender={() => overlayMenu}
      trigger={['click']}
      open={visible}
      onOpenChange={handleVisibleChange}
    >
      {icon}
    </Dropdown>
  );
};

export default DropdownSelectableIcon;
