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

/**
 * @fileoverview Standalone menus registry implementation.
 *
 * Stores menu item registrations as module-level state.
 * Extensions register menu items as side effects at import time.
 */

import type { menus as menusApi } from '@apache-superset/core';
import { Disposable } from '../models';

type MenuItem = menusApi.MenuItem;
type Menu = menusApi.Menu;

type StoredMenuItem = {
  item: MenuItem;
  location: string;
  group: 'primary' | 'secondary' | 'context';
};

const menuItems: StoredMenuItem[] = [];

const registerMenuItem: typeof menusApi.registerMenuItem = (
  item: MenuItem,
  location: string,
  group: 'primary' | 'secondary' | 'context',
): Disposable => {
  const stored: StoredMenuItem = { item, location, group };
  menuItems.push(stored);
  return new Disposable(() => {
    const index = menuItems.indexOf(stored);
    if (index >= 0) {
      menuItems.splice(index, 1);
    }
  });
};

const getMenu: typeof menusApi.getMenu = (
  location: string,
): Menu | undefined => {
  const items = menuItems.filter(entry => entry.location === location);
  if (items.length === 0) return undefined;

  const result: Menu = {};

  for (const { item, group } of items) {
    if (group === 'primary') {
      result.primary = result.primary ?? [];
      result.primary.push(item);
    } else if (group === 'secondary') {
      result.secondary = result.secondary ?? [];
      result.secondary.push(item);
    } else if (group === 'context') {
      result.context = result.context ?? [];
      result.context.push(item);
    }
  }

  return result;
};

export const menus: typeof menusApi = {
  registerMenuItem,
  getMenu,
};
