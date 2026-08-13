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
 * @fileoverview A container's "flow" — one child under the next, each
 * resizable and the whole thing a drop target — shared by every built-in
 * container that is not the root's own grid (`tabs`, `collapsible`,
 * `carousel`). Each of those still decides for itself how many flow areas
 * it has and which one is currently showing (a single one for
 * `collapsible`, one of several panes for `tabs`/`carousel`) — that part is
 * genuinely each container's own business (composition/layout design doc).
 * What they do not each reimplement is what a *single* flow area is once
 * you have picked one: a resizable stack of blocks, droppable from the
 * palette, exactly like `RootGrid`'s own drop target for the reason given
 * on `FlowContent` below.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { EmptyState } from '@superset-ui/core/components';
import { provider } from '../store';
import { PALETTE_MIME, placeBlock } from '../placement';
import BuildingBlockView from '../BuildingBlockView';

/**
 * The height `FlowItem` falls back to only when it has to measure *something*
 * and nothing has rendered yet to measure (see `currentHeight` there) — not
 * a block's actual starting height any more. A block with no `layout.rowSpan`
 * of its own (nothing has resized it yet) flexes to fill whatever room the
 * flow area actually has instead, which is a real available-height number,
 * not a guess at one.
 */
export const DEFAULT_FLOW_ITEM_HEIGHT = 360;

/** How short a resize may make a flowed block — short of this and there is nothing left to grab the handle off of. */
export const MIN_FLOW_ITEM_HEIGHT = 120;

/** How far one arrow press resizes a block. */
const RESIZE_STEP = 16;

/**
 * A flowed block's own resize handle.
 *
 * `BuildingBlockView` renders whatever it is given as `children` last, after
 * its own header and content — this needs to sit inside the block's own box,
 * on top of it, without becoming part of what the block itself renders, and
 * that slot is the one place that's true for any block, built-in or
 * extension-contributed.
 *
 * A strip along the whole bottom edge rather than a corner square: this
 * resizes one axis, not two (a flow's blocks are already full width, so
 * there is no second dimension to change), and a full-width strip is a
 * wider target than a handful of pixels in a corner would be.
 */
const ResizeGrip = styled.div`
  ${({ theme }) => css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: ${theme.sizeUnit * 2}px;
    cursor: row-resize;
    touch-action: none;
    z-index: 1;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background-color: transparent;
      transition: background-color ${theme.motionDurationMid};
    }

    &:hover::after,
    &:focus-visible::after,
    &:active::after {
      background-color: ${theme.colorPrimary};
    }

    &:focus-visible {
      outline: none;
    }
  `}
`;

/**
 * One block, flowed into an area, with its own height and a way to change
 * it.
 *
 * The height rendered is `layout.rowSpan` once an author has set one —
 * reused rather than a field of its own, for the same reason `colSpan` is
 * meaningless outside a grid and nobody invented a second name for "this
 * many columns" to go with it: `rowSpan` already means "how tall," and a
 * flow container is free to read it in its own unit (a pixel, here) the same
 * way a grid container reads it in row tracks (see the composition/layout
 * design doc — a container's own arrangement is its own business).
 *
 * `height` (and `liveHeight`, its local draft) is `undefined` for a block
 * nobody has resized yet — rather than defaulting it to some fixed number,
 * this flexes (`flex: 1 1 auto`) to fill whatever the flow area actually has
 * available, the same way the very first block dropped into an empty area
 * should read as filling it rather than sitting in a corner of it. The
 * moment an author (or the resize handle below) sets an explicit height,
 * that becomes authoritative and this switches to a fixed one instead
 * (`flex: 0 0 auto`) — a size someone chose is never overridden by whatever
 * space happens to be around it.
 *
 * The drag is tracked locally and committed with `provider.updateLayout`
 * only once it ends, the same reason `RootGrid` commits a resize on
 * `onResizeStop` rather than on every intermediate frame: a revision tick —
 * and the re-render of everything subscribed to it — per pixel dragged
 * would make the drag itself the slow part of resizing.
 */
export function FlowItem({
  nodeId,
  height,
}: {
  nodeId: string;
  height: number | undefined;
}): ReactElement {
  const [liveHeight, setLiveHeight] = useState(height);
  // What was accepted replaces the draft, because the draft was a view of
  // it: a resize the assistant makes while this is on screen has to show.
  useEffect(() => setLiveHeight(height), [height]);
  const from = useRef<{ y: number; height: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // A resize gesture always needs a starting height to measure a delta
  // against — for a block that flexed to fill its space rather than being
  // given one, that is only ever knowable by measuring what got rendered,
  // never by reading `liveHeight` (which is `undefined` for exactly this
  // block). `|| DEFAULT_FLOW_ITEM_HEIGHT` rather than `??`: a measured `0`
  // (nothing painted yet to measure, or a collapsed flex box) is exactly as
  // unusable a starting point for a resize as no measurement at all.
  const currentHeight = (): number => {
    if (liveHeight !== undefined) return liveHeight;
    return (
      wrapperRef.current?.getBoundingClientRect().height ||
      DEFAULT_FLOW_ITEM_HEIGHT
    );
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>): void => {
    // This block sits inside the root's own grid (the flow's own container
    // is a grid item like any other), which otherwise reads this same
    // pointer-down as the start of a drag on that item — the whole
    // container moving on the root grid instead of this one block resizing
    // inside it. `data-block-resize` is `RootGrid`'s own drag-cancel
    // selector's half of the same guard (see `BuildingBlockView`'s
    // `data-block-remove`, which exists for the identical reason).
    event.stopPropagation();
    from.current = { y: event.clientY, height: currentHeight() };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLDivElement>): void => {
    if (from.current !== null) {
      setLiveHeight(
        Math.max(
          MIN_FLOW_ITEM_HEIGHT,
          from.current.height + event.clientY - from.current.y,
        ),
      );
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    // `liveHeight` only turns into a real number once `drag` has actually
    // fired at least once — a press and release with no movement in between
    // is not a resize, and must not fix a block that was flexing in place
    // to whatever `currentHeight` happened to measure at that instant.
    if (from.current !== null && liveHeight !== undefined) {
      provider.updateLayout(nodeId, { rowSpan: liveHeight });
    }
    from.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resize = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, (current: number) => number> = {
      ArrowDown: current => current + RESIZE_STEP,
      ArrowUp: current => Math.max(MIN_FLOW_ITEM_HEIGHT, current - RESIZE_STEP),
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      const next = move(currentHeight());
      setLiveHeight(next);
      provider.updateLayout(nodeId, { rowSpan: next });
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={
        liveHeight === undefined
          ? {
              width: '100%',
              flex: '1 1 auto',
              minHeight: MIN_FLOW_ITEM_HEIGHT,
              position: 'relative',
            }
          : {
              width: '100%',
              height: liveHeight,
              flex: '0 0 auto',
              position: 'relative',
            }
      }
    >
      <BuildingBlockView
        nodeId={nodeId}
        style={{ width: '100%', height: '100%' }}
      >
        <ResizeGrip
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('Resize block')}
          aria-valuenow={liveHeight}
          aria-valuemin={MIN_FLOW_ITEM_HEIGHT}
          tabIndex={0}
          data-test={`flow-resize-${nodeId}`}
          data-block-resize
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onKeyDown={resize}
        />
      </BuildingBlockView>
    </div>
  );
}

const FlowArea = styled.div`
  ${({ theme }) => css`
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    /* The area's own inset — the same gutter the root gives its own
       children (see BuildingBlockView), so a block flowed in here reads as
       sitting a comfortable distance inside the container rather than
       pressed against its edges. */
    padding: ${theme.sizeUnit * 4}px;
  `}
`;

/**
 * One flow area's worth of content: a resizable stack of blocks, a drop
 * target for the palette, and an empty state when there is nothing in it
 * yet.
 *
 * `accepts` gates the drop rather than the caller doing it before ever
 * rendering this — `collapsible`'s one area holds a single block, and
 * disabling the drop once that block exists (rather than never offering a
 * drop target at all) is what lets the empty state's own instruction stay
 * honest right up until the moment it stops applying.
 *
 * `data-container-id` is what makes this a valid reparent target for an
 * *existing* block being dragged on the root's own grid, not just new ones
 * from the palette — `RootGrid`'s hit-testing looks for this attribute at
 * any nesting depth (see its own doc comment), and a flow area answers it
 * the same way `RootGrid`'s own grid does. Stopping propagation on drop is
 * what keeps the same event from also reaching `RootGrid`'s handler on its
 * way up the tree — without it, a block dropped here would be placed twice,
 * once in this area and once on the root.
 */
export function FlowContent({
  containerId,
  emptyTitle,
  emptyDescription,
  accepts = true,
  dataTest,
}: {
  containerId: string;
  emptyTitle: string;
  emptyDescription: string;
  accepts?: boolean;
  dataTest?: string;
}): ReactElement {
  const children = provider.getNode(containerId)?.children ?? [];

  return (
    <FlowArea
      data-test={dataTest}
      data-container-id={containerId}
      onDragOver={event => {
        if (accepts && event.dataTransfer.types.includes(PALETTE_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={event => {
        const type = event.dataTransfer.getData(PALETTE_MIME);
        if (accepts && type !== '') {
          event.preventDefault();
          event.stopPropagation();
          placeBlock(containerId, type);
        }
      }}
    >
      {children.length === 0 && (
        <EmptyState
          size="small"
          image="empty.svg"
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
      {children.map(childId => (
        <FlowItem
          key={childId}
          nodeId={childId}
          height={provider.getNode(childId)?.layout?.rowSpan}
        />
      ))}
    </FlowArea>
  );
}
