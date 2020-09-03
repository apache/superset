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

/* eslint no-undef: "error" */
const getPathName = (path) => path.replace(/[/]+/g, '');

// get active menus
export const getActiveMenuItem = (items) => {
  let selectedKey;
  let openKey;
  const path = getPathName(window.location.pathname);
  items.forEach(({ menu, id: itemId, route: itemRoute }) => {
    if (menu) {
      menu.forEach(({ id: menuId, route }) => {
        if (getPathName(route) === path) {
          selectedKey = menuId;
          openKey = itemId;
        }
      });
    } else if (itemRoute) {
      if (getPathName(itemRoute) === path) {
        selectedKey = itemId;
        openKey = itemId;
      }
    }
  });
  return [openKey, selectedKey];
};

// TODO implement versioned dox?
/* const getVersionedDocs = (v, menus) => {
   //menus.filter(doc =>
  const stack = [...menus];
  while(stack.length > 0) {
    let temp = stack.shift();
    if (Array.isArray(temp.menu)){

    } else newlist.push(temp);
  }
} */

// flattens ordered menu
const listOrderedMenu = (menus) => {
  const newlist = [];
  const stack = [...menus];
  while (stack.length > 0) {
    const temp = stack.shift();
    if (Array.isArray(temp.menu)) {
      const sortedMenu = temp.menu.sort((a, b) => a.index - b.index);
      stack.unshift(...sortedMenu);
    } else newlist.push(temp);
  }
  return newlist;
};

// functionality for prev and next button
export const getPreviousAndNextUrls = (menus) => {
  const items = listOrderedMenu(menus);
  let prevUrl;
  let nextUrl;
  const path = typeof window !== 'undefined' && getPathName(window.location.pathname);

  items.forEach(({ route }, index) => {
    if (getPathName(route) === path) {
      if (items[index - 1]) {
        prevUrl = items[index - 1].route;
      }
      if (items[index + 1]) {
        nextUrl = items[index + 1].route;
      }
    }
  });

  return [prevUrl, nextUrl];
};
