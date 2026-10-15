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
 * @fileoverview One grid of a canvas, with drag and resize built in.
 *
 * There is no edit mode: a user who may edit gets a drag grip and a resize
 * corner on each widget, on the canvas as they view it. A user who may not
 * gets the same grid with no handles. Dragging never covers the widget's own
 * surface, so a filter or chart underneath stays clickable.
 *
 * While a gesture is live the widget follows the pointer and a dashed outline
 * marks the cells it would take; releasing persists exactly those cells.
 */

import {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components';
import {
  GridMetrics,
  gridDelta,
  movedPlacement,
  NO_DELTA,
  overlappedSiblings,
  resizedPlacement,
  samePlacement,
} from './gridGeometry';
import type { GridPlacement, SpanConstraints } from './types';

type GestureKind = 'move' | 'resize';

interface Gesture {
  nodeId: string;
  kind: GestureKind;
  pointerId: number;
  startX: number;
  startY: number;
  /**
   * Page scroll when the widget was grabbed. Pointer coordinates are relative
   * to the viewport, so scrolling mid-gesture moves the content under a still
   * pointer; without this the drag would report no movement at all.
   */
  startScrollX: number;
  startScrollY: number;
  dx: number;
  dy: number;
  /**
   * Where the widget sat when it was grabbed. The gesture resolves against
   * this, not against the current placement: a write landing mid-gesture (a
   * sibling's drop pushing this one down, or a draft poll) would otherwise
   * move the ground under the pointer and persist the drop relative to a row
   * the user never aimed at.
   */
  origin: GridPlacement;
}

/** A gesture's movement over the page content, scrolling included. */
const travelled = (gesture: Gesture, clientX: number, clientY: number) => ({
  dx: clientX - gesture.startX + (window.scrollX - gesture.startScrollX),
  dy: clientY - gesture.startY + (window.scrollY - gesture.startScrollY),
});

const Grid = styled.div<GridMetrics>`
  display: grid;
  grid-template-columns: repeat(${({ columns }) => columns}, minmax(0, 1fr));
  grid-auto-rows: ${({ rowUnit }) => rowUnit}px;
  gap: ${({ gap }) => gap}px;
`;

const GridItem = styled.div<{
  placement?: GridPlacement;
  dragging?: boolean;
  offset?: { x: number; y: number };
}>`
  ${({ placement, dragging, offset }) => css`
    min-width: 0;
    min-height: 0;
    position: relative;
    ${
      placement &&
      css`
        grid-column: ${placement.col} / span ${placement.colSpan};
        grid-row: ${placement.row} / span ${placement.rowSpan};
      `
    }
    ${
      dragging &&
      offset &&
      css`
        /* Follow the pointer without reflowing the grid under it. */
        transform: translate(${offset.x}px, ${offset.y}px);
        z-index: 2;
        opacity: 0.85;
      `
    }
  `}
`;

/**
 * Where the widget being dragged would land. Turns red once it covers a
 * sibling, so the user sees an overlap before releasing rather than being
 * surprised when the server pushes a widget down to resolve it.
 */
const DropPreview = styled.div<{
  placement: GridPlacement;
  colliding?: boolean;
}>`
  ${({ theme, placement, colliding }) => css`
    grid-column: ${placement.col} / span ${placement.colSpan};
    grid-row: ${placement.row} / span ${placement.rowSpan};
    border: 2px dashed ${colliding ? theme.colorError : theme.colorPrimary};
    border-radius: ${theme.borderRadius}px;
    background: ${colliding ? theme.colorErrorBg : theme.colorPrimaryBg};
    pointer-events: none;
    z-index: 1;
  `}
`;

/**
 * Wraps a widget so its handles can sit on top of it. The handles stay hidden
 * until the pointer is over the widget or a handle has focus, so a canvas at
 * rest looks the same whether or not the user may edit it.
 */
const Interactive = styled.div`
  ${({ theme }) => css`
    height: 100%;
    position: relative;

    /* Direct children only: hovering a container must not reveal the
       handles of every widget nested inside it. */
    & > .canvas-handle {
      opacity: 0;
      /*
       * Transparent is not absent: without this a hidden handle still wins
       * the hit test over whatever it happens to sit above.
       */
      pointer-events: none;
      transition: opacity ${theme.motionDurationMid};
    }

    &:hover > .canvas-handle,
    & > .canvas-handle:focus-visible {
      opacity: 1;
      pointer-events: auto;
    }
  `}
`;

/** Step between a container's handles and its children's, in size units. */
const HANDLE_STEP = 8;
/** Size units a handle itself needs, so an offset can leave room for it. */
const HANDLE_BOX = 7;

/**
 * How far a nested grid's handles sit from the widget's edge.
 *
 * Nesting steps the offset so a container's handle never lands exactly on its
 * child's, but it is clamped to the widget's own rendered box: pushing past
 * that would put the handle over the *next* widget, where it would take
 * presses meant for that one.
 */
const handleOffset = (
  sizeUnit: number,
  depth: number,
  extent: number,
): number => {
  const room = Math.max(sizeUnit, extent - sizeUnit * HANDLE_BOX);
  return Math.min(sizeUnit * (1 + depth * HANDLE_STEP), room);
};

const Grip = styled.button<{ depth: number; extent: number }>`
  ${({ theme, depth, extent }) => css`
    position: absolute;
    top: ${handleOffset(theme.sizeUnit, depth, extent)}px;
    /* Deeper handles above shallower ones: the innermost wins a shared spot. */
    z-index: ${3 + depth};
    /*
     * Clear of a widget's own controls, which sit at the top right corner and
     * are 8 units wide (see WithQuery's .canvas-widget-controls): the grip is
     * above them in the stack, so overlapping would swallow clicks meant for
     * the menu.
     */
    right: ${theme.sizeUnit * 9}px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${theme.sizeUnit / 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadiusSM}px;
    background: ${theme.colorBgElevated};
    color: ${theme.colorTextSecondary};
    cursor: grab;
    touch-action: none;

    &:active {
      cursor: grabbing;
    }
  `}
`;

const ResizeCorner = styled.button<{ depth: number; extent: number }>`
  ${({ theme, depth, extent }) => css`
    position: absolute;
    right: 0;
    /*
     * Stepped like the grip: a container's box ends where its last child's
     * does, and the container's corner paints later, so sharing the pixel
     * would make the child's corner unreachable.
     */
    bottom: ${
      depth === 0 ? 0 : handleOffset(theme.sizeUnit, depth - 1, extent)
    }px;
    z-index: ${3 + depth};
    width: ${theme.sizeUnit * 4}px;
    height: ${theme.sizeUnit * 4}px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: nwse-resize;
    touch-action: none;

    /* A two-line corner, the conventional resize affordance. */
    &::after {
      content: '';
      position: absolute;
      right: ${theme.sizeUnit / 2}px;
      bottom: ${theme.sizeUnit / 2}px;
      width: ${theme.sizeUnit * 2}px;
      height: ${theme.sizeUnit * 2}px;
      border-right: 2px solid ${theme.colorTextTertiary};
      border-bottom: 2px solid ${theme.colorTextTertiary};
    }
  `}
`;

/** The grid's content width, kept current as the viewport changes. */
function useElementWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width];
}

export interface CanvasGridSurfaceProps {
  childIds: string[];
  columns: number;
  gap: number;
  rowUnit: number;
  placements: Record<string, GridPlacement>;
  constraints: Record<string, SpanConstraints>;
  /** Whether the user may drag and resize these widgets. */
  editable: boolean;
  /**
   * How deeply this grid is nested. A container's box begins where its first
   * child's does and its handles paint last, so without an offset per level a
   * container's grip would sit over its child's and swallow the click.
   */
  depth: number;
  onPlace: (nodeId: string, placement: GridPlacement) => void;
  renderNode: (nodeId: string) => ReactNode;
}

export default function CanvasGridSurface({
  childIds,
  columns,
  gap,
  rowUnit,
  placements,
  constraints,
  editable,
  depth,
  onPlace,
  renderNode,
}: CanvasGridSurfaceProps) {
  const [gridRef, width] = useElementWidth();
  const [gesture, setGesture] = useState<Gesture>();
  // The handlers read the gesture directly, so committing never runs as a
  // side effect inside a state updater.
  const live = useRef<Gesture>();

  const update = useCallback((next: Gesture | undefined) => {
    live.current = next;
    setGesture(next);
  }, []);

  /** Where `from` would land given a pointer delta, in whole grid units. */
  const targetOf = useCallback(
    (
      nodeId: string,
      kind: GestureKind,
      from: GridPlacement,
      dx: number,
      dy: number,
    ) => {
      const metrics: GridMetrics = { columns, gap, rowUnit };
      const delta = width > 0 ? gridDelta(dx, dy, width, metrics) : NO_DELTA;
      return kind === 'move'
        ? movedPlacement(from, delta, columns)
        : resizedPlacement(from, delta, columns, constraints[nodeId]);
    },
    [width, columns, gap, rowUnit, constraints],
  );

  /**
   * Persists `next` for `nodeId`, where `from` is the placement the gesture
   * resolved against.
   *
   * Both no-op checks matter. A gesture that moved nothing resolves back to
   * `from`, and sending that would write the geometry the widget had when it
   * was grabbed over anything that landed while the button was held -- a plain
   * click on a handle would revert a draft poll or another editor's resize.
   * Comparing with the current placement then drops a gesture that happens to
   * land exactly where the widget already sits.
   */
  const commit = useCallback(
    (nodeId: string, next: GridPlacement | undefined, from: GridPlacement) => {
      const placement = placements[nodeId];
      if (!next || !placement) return;
      if (samePlacement(next, from) || samePlacement(next, placement)) return;
      onPlace(nodeId, next);
    },
    [onPlace, placements],
  );

  const begin =
    (nodeId: string, kind: GestureKind) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      // One gesture at a time. A second finger on another handle also reports
      // button 0, and letting it replace the live gesture would strand the
      // first pointer: its move and up events fail the pointerId guards, so
      // its drag would be dropped without ever being committed.
      if (live.current) return;
      const origin = placements[nodeId];
      if (!origin) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      update({
        nodeId,
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollX: window.scrollX,
        startScrollY: window.scrollY,
        dx: 0,
        dy: 0,
        origin,
      });
    };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update({ ...current, ...travelled(current, event.clientX, event.clientY) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update(undefined);
    // From the release event's own position: the pointer can travel between
    // the last move event and the release, and the drop belongs where the
    // user let go.
    const { dx, dy } = travelled(current, event.clientX, event.clientY);
    commit(
      current.nodeId,
      targetOf(current.nodeId, current.kind, current.origin, dx, dy),
      current.origin,
    );
  };

  // Only the pointer that owns the gesture may cancel it, so a second
  // pointer going away elsewhere doesn't discard this one.
  const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update(undefined);
  };

  // Losing capture ends the gesture even when no up or cancel event arrives,
  // which is what happens if the handle is unmounted mid-drag.
  const onLostPointerCapture = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update(undefined);
  };

  // A gesture whose node stops being placeable, or that editing has stopped
  // allowing, can never be released by its own handle: that handle is gone,
  // so its up and cancel events never fire. Without this the gesture would
  // persist, leaving the drop preview on screen and -- because only one
  // gesture may be live at a time -- blocking every later drag and resize.
  useEffect(() => {
    const { current } = live;
    if (!current) return;
    // `childIds` as well as `placements`: placements are canvas-wide, so a
    // node moved into another container is still placed, just not here -- and
    // its handle has unmounted, so it can never release the gesture itself.
    if (
      !editable ||
      !placements[current.nodeId] ||
      !childIds.includes(current.nodeId)
    ) {
      update(undefined);
    }
  }, [editable, placements, childIds, update]);

  /**
   * Arrow keys do what dragging that handle does, one cell at a time, so the
   * layout is reachable without a pointer: the grip moves the widget, the
   * resize corner resizes it.
   */
  const onKeyDown =
    (nodeId: string, kind: GestureKind) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const steps: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const step = steps[event.key];
      if (!step) return;
      event.preventDefault();
      const placement = placements[nodeId];
      if (!placement) return;
      const delta = { cols: step[0], rows: step[1] };
      commit(
        nodeId,
        kind === 'move'
          ? movedPlacement(placement, delta, columns)
          : resizedPlacement(placement, delta, columns, constraints[nodeId]),
        placement,
      );
    };

  const handlers = {
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };

  const preview = gesture
    ? targetOf(
        gesture.nodeId,
        gesture.kind,
        gesture.origin,
        gesture.dx,
        gesture.dy,
      )
    : undefined;
  const covered =
    preview && gesture
      ? overlappedSiblings(preview, childIds, placements, gesture.nodeId)
      : [];

  return (
    <Grid
      ref={gridRef}
      columns={columns}
      gap={gap}
      rowUnit={rowUnit}
      data-test="canvas-grid-surface"
    >
      {preview && gesture && !samePlacement(preview, gesture.origin) && (
        <DropPreview
          placement={preview}
          colliding={covered.length > 0}
          data-test="canvas-drop-preview"
          data-colliding={covered.length > 0}
          title={
            covered.length > 0 ? t('This overlaps another widget') : undefined
          }
        />
      )}
      {childIds.map(childId => {
        const dragging = gesture?.nodeId === childId;
        const placed = placements[childId];
        // Rows plus the gaps between them: how tall this widget renders.
        const extent = placed
          ? placed.rowSpan * rowUnit + (placed.rowSpan - 1) * gap
          : 0;
        return (
          <GridItem
            key={childId}
            placement={
              dragging && gesture ? gesture.origin : placements[childId]
            }
            dragging={dragging && gesture?.kind === 'move'}
            offset={dragging ? { x: gesture.dx, y: gesture.dy } : undefined}
            data-test="canvas-node"
            data-node-id={childId}
          >
            <Interactive>
              {renderNode(childId)}
              {editable && placements[childId] && (
                <>
                  <Grip
                    type="button"
                    depth={depth}
                    extent={extent}
                    className="canvas-handle"
                    aria-label={t('Move widget')}
                    data-test="canvas-drag-handle"
                    onPointerDown={begin(childId, 'move')}
                    onKeyDown={onKeyDown(childId, 'move')}
                    {...handlers}
                  >
                    <Icons.HolderOutlined iconSize="s" />
                  </Grip>
                  <ResizeCorner
                    type="button"
                    depth={depth}
                    extent={extent}
                    className="canvas-handle"
                    aria-label={t('Resize widget')}
                    data-test="canvas-resize-handle"
                    onPointerDown={begin(childId, 'resize')}
                    onKeyDown={onKeyDown(childId, 'resize')}
                    {...handlers}
                  />
                </>
              )}
            </Interactive>
          </GridItem>
        );
      })}
    </Grid>
  );
}
