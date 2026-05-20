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

import {
  PointerSensorOptions,
  MeasuringConfiguration,
  MeasuringStrategy,
  rectIntersection,
  pointerWithin,
  closestCenter,
  CollisionDetection,
  UniqueIdentifier,
} from '@dnd-kit/core';

/**
 * Collision detection that deprioritizes the active (dragged) item.
 *
 * rectIntersection can match the DragPlaceholder at the original position,
 * preventing repositioning. Falls back through pointerWithin (actual pointer
 * position) then closestCenter (gaps between droppable rects).
 */
export function getCollisionDetection(
  activeId: UniqueIdentifier | null,
): CollisionDetection {
  if (!activeId) return rectIntersection;

  return args => {
    const collisions = rectIntersection(args);

    // Best match isn't the active item — use as-is
    if (collisions.length === 0 || collisions[0]?.id !== activeId) {
      return collisions;
    }

    // rectIntersection picked the active item — try pointer position instead
    const pointerCollisions = pointerWithin(args);
    const nonActivePointer = pointerCollisions.find(c => c.id !== activeId);
    if (nonActivePointer) {
      return [nonActivePointer, ...collisions];
    }

    // Pointer is over the DragPlaceholder — keep it for horizontal depth changes
    if (pointerCollisions.length > 0) {
      return collisions;
    }

    // Gap between droppable rects — fall back to closestCenter
    const centerCollisions = closestCenter(args);
    const nonActiveCenter = centerCollisions.find(c => c.id !== activeId);
    if (nonActiveCenter) {
      return [nonActiveCenter, ...collisions];
    }

    return collisions;
  };
}

export const pointerSensorOptions: PointerSensorOptions = {
  activationConstraint: {
    distance: 8,
  },
};

// Measure once at drag start — MeasuringStrategy.Always breaks with virtualization
// because react-window unmounts items during scroll.
export const measuringConfig: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
};

// Disabled — auto-scroll + react-window unmounting causes dnd-kit to lose the drag.
export const autoScrollConfig = {
  enabled: false,
};
