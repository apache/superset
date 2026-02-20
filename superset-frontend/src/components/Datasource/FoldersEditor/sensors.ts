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
 * Custom collision detection that deprioritizes the active (dragged) item.
 *
 * When dragging a folder block, the DragPlaceholder at the original position
 * registers as a droppable. rectIntersection uses a translated RECT (not just
 * the pointer) for collision checks, so its result can overlap with both the
 * DragPlaceholder and a neighbouring item. When the DragPlaceholder wins by
 * area, overId stays as the active item and the "same position" early-return
 * in handleDragEnd prevents the reposition.
 *
 * This strategy falls back to pointerWithin when rectIntersection picks the
 * active item, which uses the actual pointer position and reliably detects the
 * item the user is hovering over. When the pointer lands in tiny gaps between
 * droppable rects (inner element refs are slightly smaller than react-window
 * slots), closestCenter is used as a final fallback to find the nearest item.
 */
export function createCollisionDetection(
  activeId: UniqueIdentifier | null,
): CollisionDetection {
  if (!activeId) return rectIntersection;

  return args => {
    const collisions = rectIntersection(args);

    // If the best match is NOT the active item, keep rectIntersection result
    if (collisions.length === 0 || collisions[0]?.id !== activeId) {
      return collisions;
    }

    // rectIntersection picked the active item — try pointerWithin for a
    // more accurate result based on the actual pointer position
    const pointerCollisions = pointerWithin(args);
    const nonActivePointer = pointerCollisions.find(c => c.id !== activeId);
    if (nonActivePointer) {
      return [nonActivePointer, ...collisions];
    }

    // If pointerWithin found the active item (pointer IS over the
    // DragPlaceholder), keep it — this allows horizontal drag for depth
    // changes to work correctly.
    if (pointerCollisions.length > 0) {
      return collisions;
    }

    // Pointer is in a tiny gap between droppable rects — use closestCenter
    // to find the nearest item instead of snapping back to original position
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

// Use BeforeDragging strategy to measure items once at drag start rather than continuously.
// This is critical for virtualized lists where items get unmounted during scroll.
// MeasuringStrategy.Always causes issues because dnd-kit loses track of items
// that are unmounted by react-window during auto-scroll.
export const measuringConfig: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
};

// Disable auto-scroll because it conflicts with virtualization.
// When auto-scroll moves the viewport, react-window unmounts items that scroll out of view,
// which causes dnd-kit to lose track of the dragged item and reset the drag operation.
export const autoScrollConfig = {
  enabled: false,
};
