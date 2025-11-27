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

import type { UniqueIdentifier } from '@dnd-kit/core';
import {
  DatasourceFolder,
  DatasourceFolderItem,
} from 'src/explore/components/DatasourcePanel/types';
import { FoldersEditorItemType } from '../types';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from './folderUtils';

// Type for a tree item (folder or metric/column item)
export type TreeItem = DatasourceFolder | DatasourceFolderItem;

// Type for flattened tree item with metadata for drag-and-drop
export interface FlattenedTreeItem {
  uuid: string;
  type: FoldersEditorItemType;
  name: string;
  description?: string;
  children?: TreeItem[];
  parentId: string | null;
  depth: number;
  index: number;
  collapsed?: boolean;
}

const MAX_DEPTH = 3;

// Horizontal distance (in pixels) required to change nesting level during drag
// Higher value = less sensitive to accidental horizontal movement
export const DRAG_INDENTATION_WIDTH = 64;

/**
 * Calculate depth based on horizontal drag offset
 */
function getDragDepth(
  offset: number,
  indentationWidth: number = DRAG_INDENTATION_WIDTH,
): number {
  return Math.round(offset / indentationWidth);
}

/**
 * Get maximum allowed depth for an item
 */
function getMaxDepth(previousItem: FlattenedTreeItem | undefined): number {
  if (previousItem) {
    // Only allow nesting under folders, not under metrics/columns
    if (previousItem.type === FoldersEditorItemType.Folder) {
      return Math.min(previousItem.depth + 1, MAX_DEPTH);
    }
    // If previous item is not a folder, can only be at same depth
    return previousItem.depth;
  }
  return 0;
}

/**
 * Get minimum allowed depth for an item
 * For items (metrics/columns), minimum depth is 1 since they must be inside a folder
 * For folders, minimum depth can be 0 (root level)
 */
function getMinDepth(
  nextItem: FlattenedTreeItem | undefined,
  activeItem: FlattenedTreeItem,
): number {
  // Items (metrics/columns) must always be inside a folder (min depth 1)
  if (activeItem.type !== FoldersEditorItemType.Folder) {
    return 1;
  }
  // Folders can be at root level
  if (nextItem) {
    return nextItem.depth;
  }
  return 0;
}

/**
 * Project the target depth and parent based on drag position
 * This is the core algorithm that determines where an item will be dropped
 *
 * Optimized to avoid arrayMove - instead calculates adjacent items directly
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

  // Calculate what would be adjacent after the move WITHOUT creating a new array
  // If active moves to over's position:
  // - Items between active and over shift by 1
  // - We need to know what's at overIndex-1 and overIndex+1 after the shift
  let previousItem: FlattenedTreeItem | undefined;
  let nextItem: FlattenedTreeItem | undefined;

  if (activeItemIndex < overItemIndex) {
    // Dragging down: items between active+1 and over shift up by 1
    // After move: previousItem = items[overIndex], nextItem = items[overIndex + 1]
    previousItem = items[overItemIndex];
    nextItem = items[overItemIndex + 1];
  } else if (activeItemIndex > overItemIndex) {
    // Dragging up: items between over and active-1 shift down by 1
    // After move: previousItem = items[overIndex - 1], nextItem = items[overIndex]
    previousItem = items[overItemIndex - 1];
    nextItem = items[overItemIndex];
  } else {
    // Same position - just horizontal movement
    previousItem = items[overItemIndex - 1];
    nextItem = items[overItemIndex + 1];
  }

  // Skip the active item if it would be adjacent (it's being moved)
  if (previousItem?.uuid === activeId) {
    previousItem = items[items.indexOf(previousItem) - 1];
  }
  if (nextItem?.uuid === activeId) {
    nextItem = items[items.indexOf(nextItem) + 1];
  }

  // Calculate projected depth based on horizontal drag offset
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = getMaxDepth(previousItem);
  const minDepth = getMinDepth(nextItem, activeItem);

  // Constrain depth to min/max bounds
  let depth = projectedDepth;
  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  // Calculate parent ID inline to avoid closure overhead
  let parentId: string | null = null;
  if (depth > 0 && previousItem) {
    if (depth === previousItem.depth) {
      // Same level as previous item - share the same parent
      parentId = previousItem.parentId;
    } else if (depth > previousItem.depth) {
      // Deeper than previous item - previous item becomes parent
      parentId = previousItem.uuid;
    } else {
      // Shallower than previous item - find ancestor at same depth
      // Search backwards from overIndex for an item at the target depth
      const searchEnd =
        activeItemIndex < overItemIndex ? overItemIndex : overItemIndex - 1;
      for (let i = searchEnd; i >= 0; i -= 1) {
        if (items[i].uuid !== activeId && items[i].depth === depth) {
          parentId = items[i].parentId;
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

/**
 * Flatten a tree structure into an array with depth metadata
 * Optimized to use push instead of spread to avoid creating intermediate arrays
 */
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

    // Recursively flatten children if this is a folder
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

/**
 * Convert nested tree to flat array
 */
export function flattenTree(items: TreeItem[]): FlattenedTreeItem[] {
  return flatten(items);
}

/**
 * Rebuild tree structure from flattened array
 * Handles items in any order by sorting by depth first
 */
export function buildTree(flattenedItems: FlattenedTreeItem[]): TreeItem[] {
  const root: TreeItem[] = [];
  const nodes: Record<string, TreeItem> = {};

  // Sort by depth to ensure parents are processed before children
  const sortedItems = [...flattenedItems].sort((a, b) => a.depth - b.depth);

  // First pass: create all items
  for (const item of sortedItems) {
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

    nodes[uuid] = treeItem;
  }

  // Second pass: build parent-child relationships
  for (const item of sortedItems) {
    const { uuid, parentId } = item;
    const treeItem = nodes[uuid];

    if (!parentId) {
      // Root level item
      root.push(treeItem);
    } else {
      // Child item - add to parent's children
      const parent = nodes[parentId];
      if (
        parent &&
        parent.type === FoldersEditorItemType.Folder &&
        'children' in parent
      ) {
        parent.children!.push(treeItem);
      } else if (!parent) {
        // Parent doesn't exist - this is an orphan, add to root
        root.push(treeItem);
      }
    }
  }

  return root;
}

/**
 * Find an item deep in the tree structure
 */
export function findItemDeep(
  items: TreeItem[],
  itemId: UniqueIdentifier,
): TreeItem | undefined {
  for (const item of items) {
    if (item.uuid === itemId) {
      return item;
    }

    if (
      item.type === FoldersEditorItemType.Folder &&
      'children' in item &&
      item.children?.length
    ) {
      const child = findItemDeep(item.children, itemId);
      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * Remove children of collapsed folders from the flattened list
 */
export function removeChildrenOf(
  items: FlattenedTreeItem[],
  ids: UniqueIdentifier[],
): FlattenedTreeItem[] {
  const excludeParentIds = [...ids];

  return items.filter(item => {
    if (item.parentId && excludeParentIds.includes(item.parentId)) {
      if (item.children?.length) {
        excludeParentIds.push(item.uuid);
      }
      return false;
    }

    return true;
  });
}

/**
 * Count all descendants of an item
 */
function countChildren(items: TreeItem[], count: number = 0): number {
  return items.reduce((acc, item) => {
    if (
      item.type === FoldersEditorItemType.Folder &&
      'children' in item &&
      item.children?.length
    ) {
      return countChildren(item.children, acc + 1);
    }
    return acc + 1;
  }, count);
}

/**
 * Get total count of children for a folder
 */
export function getChildCount(items: TreeItem[], id: UniqueIdentifier): number {
  const item = findItemDeep(items, id);

  if (
    item &&
    item.type === FoldersEditorItemType.Folder &&
    'children' in item &&
    item.children
  ) {
    return countChildren(item.children);
  }

  return 0;
}

/**
 * Serialize tree for API
 * Backend schema validation (superset/datasets/schemas.py FolderSchema):
 * - For metrics/columns (leaf items): { uuid, type } - type is needed for frontend to distinguish metrics from columns
 * - For folders: Must have { uuid, type, name, children } (name requires children)
 * Note: We don't send 'name' for leaf items because validation requires 'children' if 'name' is present
 * IMPORTANT: Only return folders at root, never standalone metrics/columns
 * Empty folders are excluded (this is how folders are deleted - remove all items then exclude from request)
 */
export function serializeForAPI(items: TreeItem[]): DatasourceFolder[] {
  const serializeChildren = (
    children: TreeItem[] | undefined,
  ): Array<
    DatasourceFolder | { uuid: string; type: FoldersEditorItemType }
  > => {
    if (!children || children.length === 0) return [];

    // Filter out empty folders and serialize remaining children
    return children
      .map(child => {
        if (
          child.type === FoldersEditorItemType.Folder &&
          'children' in child
        ) {
          // Recursively serialize folder's children
          const serializedChildren = serializeChildren(child.children);

          // Skip empty folders (no children = folder should be deleted)
          if (serializedChildren.length === 0) {
            return null;
          }

          // Folder with children: keep all fields
          return {
            uuid: child.uuid,
            type: child.type,
            name: child.name,
            description: child.description,
            children: serializedChildren,
          } as DatasourceFolder;
        }
        // Metric/Column: uuid and type (type needed for frontend to distinguish them)
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
    .filter(item => item.type === FoldersEditorItemType.Folder) // Only folders at root
    .map(item => {
      const serializedChildren =
        'children' in item ? serializeChildren(item.children) : [];

      // Skip empty folders at root level
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
 * Get all descendants of a folder (for circular nesting prevention)
 */
export function getDescendantIds(
  items: TreeItem[],
  folderId: string,
): string[] {
  const folder = findItemDeep(items, folderId);

  if (
    !folder ||
    folder.type !== FoldersEditorItemType.Folder ||
    !('children' in folder) ||
    !folder.children
  ) {
    return [];
  }

  const descendants: string[] = [];

  function collectIds(children: TreeItem[]) {
    for (const child of children) {
      descendants.push(child.uuid);
      if (
        child.type === FoldersEditorItemType.Folder &&
        'children' in child &&
        child.children
      ) {
        collectIds(child.children);
      }
    }
  }

  collectIds(folder.children);
  return descendants;
}

/**
 * Check if drop is valid (respects type restrictions for default folders)
 */
export function canAcceptDrop(
  targetFolder: FlattenedTreeItem,
  draggedItems: FlattenedTreeItem[],
): boolean {
  // Default folders have type restrictions
  const isDefaultMetricsFolder =
    targetFolder.uuid === DEFAULT_METRICS_FOLDER_UUID;
  const isDefaultColumnsFolder =
    targetFolder.uuid === DEFAULT_COLUMNS_FOLDER_UUID;

  if (isDefaultMetricsFolder) {
    // Metrics folder only accepts metrics
    return draggedItems.every(
      item => item.type === FoldersEditorItemType.Metric,
    );
  }

  if (isDefaultColumnsFolder) {
    // Columns folder only accepts columns
    return draggedItems.every(
      item => item.type === FoldersEditorItemType.Column,
    );
  }

  // User folders accept anything
  return true;
}

/**
 * Check if a folder can be nested inside another (prevents circular nesting)
 */
export function canNestFolder(
  items: TreeItem[],
  movingFolderId: string,
  targetFolderId: string,
): boolean {
  // Can't nest folder inside itself
  if (movingFolderId === targetFolderId) {
    return false;
  }

  // Can't nest folder inside its own descendants
  const descendants = getDescendantIds(items, movingFolderId);
  return !descendants.includes(targetFolderId);
}
