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
  dx: number;
  dy: number;
}

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
      transition: opacity ${theme.motionDurationMid};
    }

    &:hover > .canvas-handle,
    & > .canvas-handle:focus-visible {
      opacity: 1;
    }
  `}
`;

const Grip = styled.button`
  ${({ theme }) => css`
    position: absolute;
    top: ${theme.sizeUnit}px;
    right: ${theme.sizeUnit}px;
    z-index: 3;
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

const ResizeCorner = styled.button`
  ${({ theme }) => css`
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 3;
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

  /** Where `nodeId` would land given a pointer or keyboard delta. */
  const targetOf = useCallback(
    (nodeId: string, kind: GestureKind, dx: number, dy: number) => {
      const placement = placements[nodeId];
      if (!placement) return undefined;
      const metrics: GridMetrics = { columns, gap, rowUnit };
      const delta = width > 0 ? gridDelta(dx, dy, width, metrics) : NO_DELTA;
      return kind === 'move'
        ? movedPlacement(placement, delta, columns)
        : resizedPlacement(placement, delta, columns, constraints[nodeId]);
    },
    [placements, width, columns, gap, rowUnit, constraints],
  );

  const commit = useCallback(
    (nodeId: string, next: GridPlacement | undefined) => {
      const placement = placements[nodeId];
      if (next && placement && !samePlacement(next, placement)) {
        onPlace(nodeId, next);
      }
    },
    [onPlace, placements],
  );

  const begin =
    (nodeId: string, kind: GestureKind) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      update({
        nodeId,
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dx: 0,
        dy: 0,
      });
    };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update({
      ...current,
      dx: event.clientX - current.startX,
      dy: event.clientY - current.startY,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update(undefined);
    // From the release event's own position: the pointer can travel between
    // the last move event and the release, and the drop belongs where the
    // user let go.
    commit(
      current.nodeId,
      targetOf(
        current.nodeId,
        current.kind,
        event.clientX - current.startX,
        event.clientY - current.startY,
      ),
    );
  };

  // Only the pointer that owns the gesture may cancel it, so a second
  // pointer going away elsewhere doesn't discard this one.
  const onPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const { current } = live;
    if (!current || current.pointerId !== event.pointerId) return;
    update(undefined);
  };

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
      );
    };

  const handlers = {
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };

  const preview = gesture
    ? targetOf(gesture.nodeId, gesture.kind, gesture.dx, gesture.dy)
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
      {preview &&
        gesture &&
        !samePlacement(preview, placements[gesture.nodeId]) && (
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
        return (
          <GridItem
            key={childId}
            placement={placements[childId]}
            dragging={dragging && gesture?.kind === 'move'}
            offset={dragging ? { x: gesture.dx, y: gesture.dy } : undefined}
            data-test="canvas-node"
            data-node-id={childId}
          >
            {editable && placements[childId] ? (
              <Interactive>
                {renderNode(childId)}
                <Grip
                  type="button"
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
                  className="canvas-handle"
                  aria-label={t('Resize widget')}
                  data-test="canvas-resize-handle"
                  onPointerDown={begin(childId, 'resize')}
                  onKeyDown={onKeyDown(childId, 'resize')}
                  {...handlers}
                />
              </Interactive>
            ) : (
              renderNode(childId)
            )}
          </GridItem>
        );
      })}
    </Grid>
  );
}
