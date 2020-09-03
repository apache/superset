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
