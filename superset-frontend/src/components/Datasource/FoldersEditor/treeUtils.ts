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
 * Tree manipulation utilities for dnd-kit drag and drop operations.
 * Handles flattening, building, and projecting tree structures.
 */

import type { UniqueIdentifier } from '@dnd-kit/core';
import {
  DatasourceFolder,
  DatasourceFolderItem,
} from 'src/explore/components/DatasourcePanel/types';
import { FoldersEditorItemType } from '../types';
import {
  TreeItem,
  FlattenedTreeItem,
  DRAG_INDENTATION_WIDTH,
  MAX_DEPTH,
} from './constants';

function getDragDepth(
  offset: number,
  indentationWidth: number = DRAG_INDENTATION_WIDTH,
): number {
  return Math.round(offset / indentationWidth);
}

function getMaxDepth(previousItem: FlattenedTreeItem | undefined): number {
  if (previousItem) {
    if (previousItem.type === FoldersEditorItemType.Folder) {
      return Math.min(previousItem.depth + 1, MAX_DEPTH);
    }
    return previousItem.depth;
  }
  return 0;
}

function getMinDepth(
  nextItem: FlattenedTreeItem | undefined,
  activeItem: FlattenedTreeItem,
): number {
  // Items must always be inside a folder
  if (activeItem.type !== FoldersEditorItemType.Folder) {
    return 1;
  }
  if (nextItem) {
    return nextItem.depth;
  }
  return 0;
}

/**
 * Project the target depth and parent based on drag position.
 * Calculates adjacent items directly without creating intermediate arrays.
 */
export function getProjection(
  items: FlattenedTreeItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number = DRAG_INDENTATION_WIDTH,
  // Optional pre-built index map for repeated calls with same items array
  indexMap?: Map<string, number>,
) {
  // Use provided map or fall back to findIndex
  const overItemIndex = indexMap
    ? (indexMap.get(overId as string) ?? -1)
    : items.findIndex(({ uuid }) => uuid === overId);
  const activeItemIndex = indexMap
    ? (indexMap.get(activeId as string) ?? -1)
    : items.findIndex(({ uuid }) => uuid === activeId);
  const activeItem = items[activeItemIndex];

  if (!activeItem || overItemIndex === -1) {
    return null;
  }

  let previousItem: FlattenedTreeItem | undefined;
  let nextItem: FlattenedTreeItem | undefined;
  let previousItemIndex: number;
  let nextItemIndex: number;

  if (activeItemIndex < overItemIndex) {
    previousItemIndex = overItemIndex;
    nextItemIndex = overItemIndex + 1;
  } else if (activeItemIndex > overItemIndex) {
    previousItemIndex = overItemIndex - 1;
    nextItemIndex = overItemIndex;
  } else {
    previousItemIndex = overItemIndex - 1;
    nextItemIndex = overItemIndex + 1;
  }

  previousItem = items[previousItemIndex];
  nextItem = items[nextItemIndex];

  // Skip over the active item if it's adjacent
  if (previousItem?.uuid === activeId) {
    previousItemIndex -= 1;
    previousItem = items[previousItemIndex];
  }
  if (nextItem?.uuid === activeId) {
    nextItemIndex += 1;
    nextItem = items[nextItemIndex];
  }

  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem, activeItem);

  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  let parentId: string | null = null;
  if (depth > 0 && previousItem) {
    if (depth === previousItem.depth) {
      ({ parentId } = previousItem);
    } else if (depth > previousItem.depth) {
      parentId = previousItem.uuid;
    } else {
      const searchEnd =
        activeItemIndex < overItemIndex ? overItemIndex : overItemIndex - 1;
      for (let i = searchEnd; i >= 0; i -= 1) {
        if (items[i].uuid !== activeId && items[i].depth === depth) {
          ({ parentId } = items[i]);
          break;
        }
      }
    }
  }

  return {
    depth,
    maxDepth,
    minDepth,
    parentId,
  };
}

function flatten(
  items: TreeItem[],
  parentId: string | null = null,
  depth: number = 0,
  result: FlattenedTreeItem[] = [],
): FlattenedTreeItem[] {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const flatItem: FlattenedTreeItem = {
      uuid: item.uuid,
      type: item.type,
      name: item.name,
      description: 'description' in item ? item.description : undefined,
      children: 'children' in item ? item.children : undefined,
      parentId,
      depth,
      index,
      collapsed: 'children' in item && (item as any).collapsed,
    };

    result.push(flatItem);

    if (
      item.type === FoldersEditorItemType.Folder &&
      'children' in item &&
      item.children
    ) {
      flatten(item.children, item.uuid, depth + 1, result);
    }
  }

  return result;
}

export function flattenTree(items: TreeItem[]): FlattenedTreeItem[] {
  return flatten(items);
}

export function buildTree(flattenedItems: FlattenedTreeItem[]): TreeItem[] {
  const root: TreeItem[] = [];
  const nodes = new Map<string, TreeItem>();

  // First pass: create all nodes
  for (const item of flattenedItems) {
    const { uuid, type, name, description } = item;

    const treeItem: TreeItem =
      type === FoldersEditorItemType.Folder
        ? ({
            uuid,
            type,
            name,
            description,
            children: [],
          } as DatasourceFolder)
        : ({
            uuid,
            type,
            name,
          } as DatasourceFolderItem);

    nodes.set(uuid, treeItem);
  }

  // Second pass: link children to parents (iteration order preserves structure)
  for (const item of flattenedItems) {
    const { uuid, parentId } = item;
    const treeItem = nodes.get(uuid)!;

    if (!parentId) {
      root.push(treeItem);
    } else {
      const parent = nodes.get(parentId);
      if (
        parent &&
        parent.type === FoldersEditorItemType.Folder &&
        'children' in parent
      ) {
        parent.children!.push(treeItem);
      } else if (!parent) {
        root.push(treeItem);
      }
    }
  }

  return root;
}

export function removeChildrenOf(
  items: FlattenedTreeItem[],
  ids: UniqueIdentifier[],
): FlattenedTreeItem[] {
  const excludeParentIds = new Set<UniqueIdentifier>(ids);

  return items.filter(item => {
    if (item.parentId && excludeParentIds.has(item.parentId)) {
      if (item.children?.length) {
        excludeParentIds.add(item.uuid);
      }
      return false;
    }

    return true;
  });
}

/**
 * Serialize tree for API. Empty folders are excluded.
 */
export function serializeForAPI(items: TreeItem[]): DatasourceFolder[] {
  const serializeChildren = (
    children: TreeItem[] | undefined,
  ): Array<
    DatasourceFolder | { uuid: string; type: FoldersEditorItemType }
  > => {
    if (!children || children.length === 0) return [];

    return children
      .map(child => {
        if (
          child.type === FoldersEditorItemType.Folder &&
          'children' in child
        ) {
          const serializedChildren = serializeChildren(child.children);

          if (serializedChildren.length === 0) {
            return null;
          }

          return {
            uuid: child.uuid,
            type: child.type,
            name: child.name,
            description: child.description,
            children: serializedChildren,
          } as DatasourceFolder;
        }
        return {
          uuid: child.uuid,
          type: child.type,
        };
      })
      .filter(
        (
          child,
        ): child is
          | DatasourceFolder
          | { uuid: string; type: FoldersEditorItemType } => child !== null,
      );
  };

  return items
    .filter(item => item.type === FoldersEditorItemType.Folder)
    .map(item => {
      const serializedChildren =
        'children' in item ? serializeChildren(item.children) : [];

      if (serializedChildren.length === 0) {
        return null;
      }

      return {
        uuid: item.uuid,
        type: item.type,
        name: item.name,
        description: 'description' in item ? item.description : undefined,
        children: serializedChildren,
      } as DatasourceFolder;
    })
    .filter((folder): folder is DatasourceFolder => folder !== null);
}

/**
 * Remove leaf items whose UUIDs are not in the valid set.
 * Returns the original reference when nothing was removed.
 */
export function filterFoldersByValidUuids(
  folders: DatasourceFolder[],
  validUuids: Set<string>,
): DatasourceFolder[] {
  const filterChildren = (
    children: (DatasourceFolder | DatasourceFolderItem)[] | undefined,
  ): (DatasourceFolder | DatasourceFolderItem)[] | undefined => {
    if (!children) return children;

    let childChanged = false;
    const result: (DatasourceFolder | DatasourceFolderItem)[] = [];
    for (const child of children) {
      if (child.type === FoldersEditorItemType.Folder && 'children' in child) {
        const filtered = filterChildren((child as DatasourceFolder).children);
        if (filtered !== (child as DatasourceFolder).children) {
          childChanged = true;
          result.push({ ...child, children: filtered } as DatasourceFolder);
        } else {
          result.push(child);
        }
      } else if (validUuids.has(child.uuid)) {
        result.push(child);
      } else {
        childChanged = true;
      }
    }
    return childChanged ? result : children;
  };

  let changed = false;
  const result = folders.map(folder => {
    const filtered = filterChildren(folder.children);
    if (filtered !== folder.children) {
      changed = true;
      return { ...folder, children: filtered };
    }
    return folder;
  });

  return changed ? result : folders;
}

/**
 * Recursively counts all folders in a DatasourceFolder array,
 * including nested sub-folders within children.
 */
export function countAllFolders(folders: DatasourceFolder[]): number {
  let count = 0;
  for (const folder of folders) {
    count += 1;
    if (folder.children) {
      for (const child of folder.children) {
        if ('children' in child) {
          count += countAllFolders([child as DatasourceFolder]);
        }
      }
    }
  }
  return count;
}
