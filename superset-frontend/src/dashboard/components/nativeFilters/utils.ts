import { ComponentType, Layout, LayoutItem, TreeItem, Scope } from './types';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from '../../util/componentTypes';

export const isShowTypeInTree = (type: ComponentType) =>
  type === TABS_TYPE ||
  type === TAB_TYPE ||
  type === CHART_TYPE ||
  type === DASHBOARD_ROOT_TYPE;

export const buildTree = (
  node: LayoutItem,
  treeItem: TreeItem,
  layout: Layout,
) => {
  let itemToPass: TreeItem = treeItem;
  if (isShowTypeInTree(node.type) && node.type !== DASHBOARD_ROOT_TYPE) {
    const currentTreeItem = {
      key: node.id,
      title: node.meta.sliceName || node.meta.text || node.id.toString(),
      children: [],
    };
    treeItem.children.push(currentTreeItem);
    itemToPass = currentTreeItem;
  }
  node.children.forEach(child => buildTree(layout[child], itemToPass, layout));
};

export const findRootPath = (checkedItemParents: string[][], it = 0): Scope => {
  if (!checkedItemParents[0]) {
    return {
      rootPath: [],
      excluded: [],
    };
  }
  const hasCommonParent = checkedItemParents.every(
    parents =>
      parents[it] === checkedItemParents[0][it] && parents[it] !== undefined,
  );
  if (hasCommonParent) {
    return findRootPath(checkedItemParents, it + 1);
  }
  let rootPath = checkedItemParents.map(parents => parents[it]);
  if (rootPath === undefined) {
    rootPath = checkedItemParents.map(parents => parents[it - 1]);
  }
  return {
    rootPath: [...new Set(rootPath)],
    excluded: [],
  };
};
