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
import { NavItem } from 'react-bootstrap';
import { Menu } from 'src/common/components';
import NavDropdown from '../NavDropdown';

export interface MenuObjectChildProps {
  label: string;
  name?: string;
  icon: string;
  index: number;
  url?: string;
}

export interface MenuObjectProps {
  label?: string;
  icon?: string;
  index: number;
  url?: string;
  childs?: (MenuObjectChildProps | string)[];
  isHeader?: boolean;
}

export default function MenuObject({
  label,
  childs,
  url,
  index,
}: MenuObjectProps) {
  if (url) {
    return (
      <NavItem eventKey={index} href={url}>
        {label}
      </NavItem>
    );
  }

  return (
    <NavDropdown id={`menu-dropdown-${label}`} title={label}>
      <Menu>
        {childs?.map((child: MenuObjectChildProps | string, index1: number) => {
          if (typeof child === 'string' && child === '-') {
            return <Menu.Divider key={`$${index1}`} />;
          }
          if (typeof child !== 'string') {
            return (
              <Menu.Item key={`${child.label}`}>
                <a href={child.url}>&nbsp; {child.label}</a>
              </Menu.Item>
            );
          }
          return null;
        })}
      </Menu>
    </NavDropdown>
  );
}
