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
import { NavItem, NavDropdown, MenuItem } from 'react-bootstrap';

interface MenuObjectChildProps {
  label: string;
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
}

export default function MenuObject({
  label,
  icon,
  childs,
  url,
  index,
}: MenuObjectProps) {
  if (url) {
    return (
      <NavItem eventKey={index} href={url}>
        <i className={`fa ${icon}`} /> &nbsp; {label}
      </NavItem>
    );
  }

  const navTitle = (
    <>
      <i className={`fa ${icon}`} />
      &nbsp; {label}
    </>
  );
  return (
    <NavDropdown
      id={`menu-dropdown-${label}`}
      eventKey={index}
      title={navTitle}
    >
      {childs?.map((child: MenuObjectChildProps | string, index1: number) => {
        if (typeof child === 'string' && child === '-') {
          return <MenuItem key={`$${index1}`} divider />;
        } else if (typeof child !== 'string') {
          return (
            <MenuItem
              key={`${child.label}`}
              href={child.url}
              eventKey={parseFloat(`${index}.${index1}`)}
            >
              <i className={`fa ${child.icon}`} />
              &nbsp; {child.label}
            </MenuItem>
          );
        }
        return null;
      })}
    </NavDropdown>
  );
}
