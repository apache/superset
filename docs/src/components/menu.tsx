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
import { useMenus, Link } from 'docz';
import { Menu } from 'antd';
import { getActiveMenuItem } from '../utils';

const { SubMenu } = Menu;

export default () => {
  const menus = useMenus();
  const { openKey, selectedKey } = getActiveMenuItem(menus);
  return (
    <Menu
      mode="inline"
      defaultOpenKeys={[openKey]}
      defaultSelectedKeys={[selectedKey]}
    >
      {menus.map((menuItem) => {
        if (menuItem.menu?.length > 0) {
          return (
            <SubMenu key={menuItem.id} title={menuItem.name}>
              {menuItem.menu
                .sort((a, b) => a.index - b.index)
                .map((submenuItem) => (
                  <Menu.Item key={submenuItem.id}>
                    <Link to={submenuItem.route}>{submenuItem.name}</Link>
                  </Menu.Item>
                ))}
            </SubMenu>
          );
        }
        return (
          <Menu.Item key={menuItem.id}>
            <Link to={menuItem.route}>{menuItem.name}</Link>
          </Menu.Item>
        );
      })}
    </Menu>
  );
};
