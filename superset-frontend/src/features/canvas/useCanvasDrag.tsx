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
 * @fileoverview Drag state shared by every grid on a canvas.
 *
 * A canvas is a tree of grids: the root, and one inside each container. Each
 * renders its own children and owns its own gestures, which is enough while a
 * widget stays where it started. Dragging one *out* of its container is a
 * conversation between two of them -- the grid that holds the widget, and the
 * grid under the pointer -- so the little they need to say to each other
 * lives here rather than in either.
 *
 * Grids register themselves so a drag can find which one the pointer is over,
 * and the grid that owns a gesture publishes where the widget would land. The
 * destination reads that to show the drop, and to reflow as though the widget
 * had already arrived.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GridLayout, GridPlacement } from './types';

/** What a grid tells the others about itself. */
export interface RegisteredGrid {
  /** The container whose children this grid lays out; the root grid's id. */
  parentId: string;
  element: HTMLElement;
  columns: number;
  gap: number;
  rowUnit: number;
  /** How deeply nested, for picking the innermost grid under a pointer. */
  depth: number;
  /**
   * This grid's children and their stored layouts, read when a drag needs
   * them. A function rather than the values: they change on every render,
   * and re-registering that often would be noise.
   */
  snapshot: () => { childIds: string[]; layouts: Record<string, GridLayout> };
}

/**
 * A grid found under a point, with the box it was found by.
 *
 * The box comes back with it so a drop is placed against the same geometry it
 * was detected against. Reading the element's own rect instead would mix the
 * two while a drag is pinning positions, and a grid that has shifted would be
 * detected where it was and filled where it now is.
 */
export interface GridHit {
  grid: RegisteredGrid;
  left: number;
  top: number;
  width: number;
}

/** Where a widget being dragged would land, once it is over another grid. */
export interface Landing {
  nodeId: string;
  /** The grid it would land in, which is not the one it started in. */
  parentId: string;
  placement: GridPlacement;
  /** Its position in the destination's reading order. */
  index: number;
}

export interface CanvasDrag {
  /** Registers a grid for as long as it is mounted. */
  register: (grid: RegisteredGrid) => () => void;
  /**
   * Pins where every grid is, for the length of a gesture.
   *
   * A drop target that moves cannot be aimed at. The grid a widget starts in
   * reflows as the drag previews it, and a container in that grid is pushed
   * along with everything else -- out from under the pointer, before the
   * pointer can be found to be over it. The drag then never notices the
   * container, so it keeps previewing the widget beside it, so the container
   * stays out of reach. Pinned at the positions they held when the drag
   * began, the targets stay where the user aimed.
   */
  freeze: () => void;
  /** Lets the grids move again. */
  release: () => void;
  /**
   * Whether a gesture is running anywhere on the canvas, so every widget can
   * show its edges while one is: a drop target you cannot see is one you
   * cannot aim at, and waiting until the pointer is near a widget tells you
   * where it is only once you are already there.
   */
  dragging: boolean;
  /** The innermost grid under a point, if any; pinned positions while frozen. */
  gridAt: (clientX: number, clientY: number) => GridHit | undefined;
  /** Where the live drag would land, when that is another grid. */
  landing?: Landing;
  setLanding: (landing?: Landing) => void;
}

const NOT_DRAGGING: CanvasDrag = {
  register: () => () => {},
  freeze: () => {},
  release: () => {},
  dragging: false,
  gridAt: () => undefined,
  setLanding: () => {},
};

/** A grid's box relative to the root grid's corner, which does not reflow. */
interface PinnedBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const CanvasDragContext = createContext<CanvasDrag>(NOT_DRAGGING);

/** The shared drag state, or an inert stand-in outside a canvas. */
export const useCanvasDrag = () => useContext(CanvasDragContext);

export function CanvasDragProvider({ children }: { children: ReactNode }) {
  // A ref, not state: registering must not re-render every grid, and the
  // registry is only ever read during a gesture.
  const grids = useRef(new Map<string, RegisteredGrid>());
  const [landing, setLanding] = useState<Landing>();

  const register = useCallback((grid: RegisteredGrid) => {
    grids.current.set(grid.parentId, grid);
    return () => {
      // Only if it is still ours: a remount registers the new one first.
      if (grids.current.get(grid.parentId) === grid) {
        grids.current.delete(grid.parentId);
      }
    };
  }, []);

  // Pinned relative to the root grid rather than to the viewport, so the
  // positions survive the page scrolling under a drag.
  const pinned = useRef<{ base: string; boxes: Map<string, PinnedBox> }>();
  const [dragging, setDragging] = useState(false);

  const rootGrid = useCallback(
    () => [...grids.current.values()].find(grid => grid.depth === 0),
    [],
  );

  const freeze = useCallback(() => {
    const base = rootGrid();
    if (!base) return;
    const origin = base.element.getBoundingClientRect();
    const boxes = new Map<string, PinnedBox>();
    grids.current.forEach(grid => {
      const box = grid.element.getBoundingClientRect();
      boxes.set(grid.parentId, {
        left: box.left - origin.left,
        top: box.top - origin.top,
        right: box.right - origin.left,
        bottom: box.bottom - origin.top,
      });
    });
    pinned.current = { base: base.parentId, boxes };
    setDragging(true);
  }, [rootGrid]);

  const release = useCallback(() => {
    pinned.current = undefined;
    setDragging(false);
  }, []);

  const gridAt = useCallback((clientX: number, clientY: number) => {
    const snapshot = pinned.current;
    const base = snapshot && grids.current.get(snapshot.base);
    const origin = base?.element.getBoundingClientRect();
    let found: GridHit | undefined;
    grids.current.forEach(grid => {
      const box =
        snapshot && origin
          ? snapshot.boxes.get(grid.parentId)
          : grid.element.getBoundingClientRect();
      if (!box) return;
      // Pinned boxes are relative to the root grid's corner, so the pointer
      // is measured from there too and a scroll moves neither.
      const x = origin ? clientX - origin.left : clientX;
      const y = origin ? clientY - origin.top : clientY;
      const inside =
        x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      // The innermost wins, as it does for presses: a nested grid is always
      // inside its container's, so both match and the deeper one is meant.
      if (inside && (!found || grid.depth > found.grid.depth)) {
        found = {
          grid,
          // Back into viewport coordinates, which is what a drop is measured
          // in, from whichever box it was actually found by.
          left: (origin?.left ?? 0) + box.left,
          top: (origin?.top ?? 0) + box.top,
          width: box.right - box.left,
        };
      }
    });
    return found;
  }, []);

  const value = useMemo(
    () => ({
      register,
      freeze,
      release,
      dragging,
      gridAt,
      landing,
      setLanding,
    }),
    [register, freeze, release, dragging, gridAt, landing],
  );
  return (
    <CanvasDragContext.Provider value={value}>
      {children}
    </CanvasDragContext.Provider>
  );
}
