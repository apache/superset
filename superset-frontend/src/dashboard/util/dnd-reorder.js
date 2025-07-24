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

import { TABS_TYPE } from './componentTypes';
import { DROP_LEFT, DROP_RIGHT } from './getDropPosition';

export function reorder(list, startIndex, endIndex) {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

export default function reorderItem({
  entitiesMap,
  source,
  destination,
  position,
}) {
  const current = [...entitiesMap[source.id].children];
  const next = [...entitiesMap[destination.id].children];
  const target = current[source.index];

  const isSameSource = source.id === destination.id;
  const isTabsType = source.type && destination.type === TABS_TYPE;

  // moving to same list
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
        // If the source tab is dropped to be the same index as the source
        // tab, no change is needed in entitiesMap
        return entitiesMap;
      }

      // Adjust dropIndex to account for the source tab being removed
      if (dropIndex > source.index) {
        dropIndex -= 1;
      }
    }
    const reordered = reorder(current, source.index, dropIndex);

    const result = {
      ...entitiesMap,
      [source.id]: {
        ...entitiesMap[source.id],
        children: reordered,
      },
    };

    return result;
  }

  if (isTabsType) {
    // Ensure the dropIndex is within the bounds of the destination children
    if (position === DROP_LEFT) {
      dropIndex = Math.max(dropIndex, 0);
    } else if (position === DROP_RIGHT) {
      dropIndex = Math.min(dropIndex + 1, current.length - 1);
    }
  }

  // moving to different list
  current.splice(source.index, 1); // remove from original
  next.splice(dropIndex, 0, target); // insert into next

  const result = {
    ...entitiesMap,
    [source.id]: {
      ...entitiesMap[source.id],
      children: current,
    },
    [destination.id]: {
      ...entitiesMap[destination.id],
      children: next,
    },
  };

  return result;
}
