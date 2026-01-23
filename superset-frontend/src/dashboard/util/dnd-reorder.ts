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

import { LayoutItemMeta, ComponentType } from '../types';
import { TABS_TYPE } from './componentTypes';
import { DROP_LEFT, DROP_RIGHT, DropPosition } from './getDropPosition';

type LayoutItemLike = {
  id: string;
  children: string[];
  // Accept loose type strings to match test fixtures and runtime
  type?: string;
  meta?: Partial<LayoutItemMeta>;
};

type EntitiesMap = Record<string, LayoutItemLike>;

export interface DropResult {
  source: {
    id: string;
    index?: number;
  };
  destination?: {
    id: string;
    index?: number;
  };
  dragging: {
    id?: string;
    type?: ComponentType;
  };
}

type DragLocation = {
  id: string;
  index: number;
  type?: ComponentType;
};

export function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

interface ReorderItemArgs {
  entitiesMap: EntitiesMap;
  source: DragLocation;
  destination: DragLocation;
  position?: DropPosition | null;
}

export default function reorderItem({
  entitiesMap,
  source,
  destination,
  position,
}: ReorderItemArgs): EntitiesMap {
  const sourceEntity = entitiesMap[source.id];
  const destinationEntity = entitiesMap[destination.id];

  const current = [...sourceEntity.children];
  const next = [...destinationEntity.children];
  const target = current[source.index];

  const isSameSource = source.id === destination.id;
  const isTabsType = source.type && destination.type === TABS_TYPE;

  let dropIndex = destination.index;

  if (isSameSource) {
    if (isTabsType) {
      if (position === DROP_LEFT) {
        dropIndex = Math.max(dropIndex, 0);
      } else if (position === DROP_RIGHT) {
        dropIndex += 1;
      }

      const isRightPosition =
        position === DROP_RIGHT && source.index === destination.index + 1;
      const isLeftPosition =
        position === DROP_LEFT && source.index === destination.index - 1;

      const sameTabSourceIndex = isRightPosition || isLeftPosition;

      if (sameTabSourceIndex) {
        return entitiesMap;
      }

      if (dropIndex > source.index) {
        dropIndex -= 1;
      }
    }
    const reordered = reorder(current, source.index, dropIndex);

    const result: EntitiesMap = {
      ...entitiesMap,
      [source.id]: {
        ...sourceEntity,
        children: reordered,
      },
    };

    return result;
  }

  if (isTabsType) {
    if (position === DROP_LEFT) {
      dropIndex = Math.max(dropIndex, 0);
    } else if (position === DROP_RIGHT) {
      dropIndex = Math.min(dropIndex + 1, current.length - 1);
    }
  }

  current.splice(source.index, 1);
  next.splice(dropIndex, 0, target);

  const result: EntitiesMap = {
    ...entitiesMap,
    [source.id]: {
      ...sourceEntity,
      children: current,
    },
    [destination.id]: {
      ...destinationEntity,
      children: next,
    },
  };

  return result;
}
