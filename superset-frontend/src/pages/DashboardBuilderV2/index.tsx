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
import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { EmptyState, Flex } from '@superset-ui/core/components';
import { dashboard, useDashboardRevision } from 'src/core/dashboard';
import { provider } from 'src/core/dashboard/store';
import {
  FALLBACK_COL_SPAN,
  FALLBACK_ROW_SPAN,
  PALETTE_MIME,
  placeBlock,
  placeBlockAt,
} from 'src/core/dashboard/placement';
import {
  cellAtPoint,
  pixelRectForCell,
  resolveCellGeometry,
  resolveGridMetrics,
} from 'src/core/dashboard/layoutStyle';
import { availableDropSpan } from 'src/core/dashboard/gridPacking';
import type { PackedRect } from 'src/core/dashboard/gridPacking';
import BuildingBlockView from 'src/core/dashboard/BuildingBlockView';
import DashboardHeader from './DashboardHeader';
import EditorPanel from './EditorPanel';

const PageContainer = styled(Flex)`
  ${({ theme }) => css`
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    background-color: ${theme.colorBgLayout};
  `}
`;

/**
 * The one scrollable region for the whole editor — deliberately the only
 * `overflow: auto` in this ancestor chain. `RootGrid`'s own surface grows to
 * fit its content instead of scrolling internally (see its `GridSurface`
 * doc comment); two nested scroll containers fighting over the same mouse
 * wheel input reads as broken scrolling, not as "the canvas is tall, scroll
 * it". `overflow-x: hidden` guards the same race `GridSurface` used to guard
 * before the scroll moved here: the live drop preview can briefly push the
 * grid's own content height past the visible viewport, forcing this
 * scrollbar to appear — and this element's own width measurement can lag
 * that by a frame, rendering momentarily wider than the space the new
 * scrollbar just took back. Horizontal scrolling was never a legitimate
 * state for this canvas anyway (columns are fractional and reflow to
 * width), so this just closes off the one axis where that lag could ever
 * become visible.
 */
const Canvas = styled.div`
  ${({ theme }) => css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: ${theme.paddingLG}px;
  `}
`;

const Workspace = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const EmptyCanvasWrapper = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * The dashboard with nothing on it, as something to aim at.
 *
 * No border and no hover fill of its own — the root draws directly onto the
 * grid, same as every block on it (see `BuildingBlockView`) — but it is
 * still the only way to select the root on a blank canvas and the palette's
 * own drop target, so a Tab still lands on it and takes a visible outline,
 * rather than the control being unreachable from the keyboard entirely.
 *
 * A plain `styled.div`, deliberately not `styled(Flex)` (antd's `Flex` isn't
 * wrapped in `forwardRef`, so a `ref` on it silently never attaches to any
 * real DOM node — every width-dependent measurement below would read `0`
 * forever, with nothing to warn about it other than a stray console message
 * easy to miss) — `DropPreview`'s own cursor-following math reads this
 * element's real width every render, and there is no reasonable substitute
 * to measure instead.
 */
const CanvasPlaceholder = styled.div`
  ${({ theme }) => css`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: ${theme.borderRadiusLG}px;
    color: ${theme.colorTextTertiary};
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: 2px;
    }
  `}
`;

/**
 * The same live drop indicator `RootGrid` draws once the root has a grid of
 * its own to draw one onto (see its own `GridSurface` doc comment) — this is
 * that same answer for the one moment there is no grid yet to ask, computed
 * the identical way: `availableDropSpan` resolves a cell under the cursor
 * (via `cellAtPoint`/`resolveCellGeometry`) against an empty `packed` map —
 * the same one `RootGrid` would resolve against once it exists — and this
 * positions/sizes itself from that cell with the same `pixelRectForCell`
 * `RootGrid`'s own ghost uses. A cursor-following, capped-size preview
 * (`FALLBACK_COL_SPAN`/`FALLBACK_ROW_SPAN`, the same cap `availableDropSpan`
 * itself now applies to any open-space drop) rather than a full-placeholder
 * or fixed-centered box: a block dropped near the left edge belongs at the
 * left edge, and one dropped low belongs low, exactly as it would on a grid
 * that already has something on it — a blank canvas earns no exception to
 * that just because there is nothing yet to be beside.
 */
const DropPreview = styled.div`
  ${({ theme }) => css`
    position: absolute;
    pointer-events: none;
    background-color: ${theme.colorPrimaryBg};
    border: 2px dashed ${theme.colorPrimary};
    border-radius: ${theme.borderRadiusLG}px;
  `}
`;

/**
 * Prototype entry point for SIP item 7.1 (AI-Native Dashboards, section 7.1
 * of the design doc): a canvas paired with the chat panel, so the
 * building-block schema/renderer/platform-API work can be iterated on with a
 * real natural-language chat loop rather than a mock. Does not persist
 * anything yet — layout/style state lives only in memory for this demo.
 *
 * The chat panel itself isn't forced open here — it behaves exactly as it
 * does everywhere else in the app (whatever display mode/open state the
 * user already has), via the same global ChatPanelHost/ChatFloatingHost
 * mounted in App.tsx.
 *
 * Rendering the tree itself is entirely delegated to `BuildingBlockView` —
 * this page owns only its own chrome (the empty state) and knows nothing
 * about node types, built-in or extension-contributed alike. There's no
 * page-level title chrome: a title is just a `markdown` building block like
 * any other, placed at the top of the canvas the same way the rest of the
 * dashboard's content is.
 */
export default function DashboardBuilderV2() {
  // Ticks on every dashboard.* mutation so this tree re-renders to reflect
  // whatever the chat agent (or any other caller of the dashboard API) did.
  useDashboardRevision();
  const theme = useTheme();
  const root = dashboard.getRoot();
  const isEmpty = !root.children || root.children.length === 0;
  // No `layout` to read yet — a blank root has never had one set — so this
  // resolves to the exact same defaults `RootGrid` itself falls back to,
  // which is what makes `DropPreview`'s own size below provably the same
  // size the first real block will open at, not a separately-tuned guess.
  const emptyCanvasMetrics = resolveGridMetrics(undefined, theme);

  // A counter, not a plain boolean: the placeholder isn't a single element,
  // it's the wrapper plus whatever `EmptyState`/`DropPreview` renders inside
  // it, and the pointer crossing from the wrapper onto one of those fires a
  // `leave` on the outer element immediately followed by an `enter` on the
  // inner one — a plain boolean would read that as leaving entirely and
  // flicker the preview off for a frame. Only reaching zero really means
  // "gone" (see `RootGrid`'s own identical `dragOverCountRef`).
  const [, setDragOverCount] = useState(0);
  // Where the preview actually is, not just whether one is showing — the
  // cell `availableDropSpan` resolved under the cursor, in the same 0-based
  // `{x, y, w, h}` convention `RootGrid`'s own `ghostRect` uses. `null`
  // means nothing to draw, exactly like a plain boolean would, but a real
  // value also carries *where*, which a boolean never could.
  const [ghostRect, setGhostRect] = useState<PackedRect | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  // `dragleave`/`drop` alone are not a complete story: releasing the pointer
  // somewhere that never became a drop target at all (past the browser
  // window's own edge, over a panel that isn't one, or cancelling the drag
  // with `Escape`) fires neither one here — the browser fires `dragend` on
  // the *drag source* instead (`Palette.tsx`'s own item), which bubbles to
  // `document` regardless of where the pointer ended up. Without this, the
  // counter above can only ever go up during such a drag and never come
  // back down, leaving `DropPreview` on screen until some unrelated later
  // drag happens to rebalance it back to zero.
  useEffect(() => {
    const handleDragEnd = () => {
      setDragOverCount(0);
      setGhostRect(null);
    };
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  /**
   * Where a palette drag over the empty canvas actually lands — the
   * counterpart to `RootGrid`'s own `availableDropSpan` call, against an
   * empty `packed` map since there is nothing here yet to be beside or
   * bounded by. The live preview (`onDragOver`, below) and the actual drop
   * both call this with the same inputs, so what an author sees while
   * hovering is provably what they get on release, the same guarantee
   * `RootGrid`'s own ghost/drop pair makes.
   */
  const resolveEmptyCanvasDropRect = (
    event: ReactDragEvent<HTMLElement>,
  ): PackedRect => {
    const containerRect = event.currentTarget.getBoundingClientRect();
    const cellGeometry = resolveCellGeometry(
      emptyCanvasMetrics,
      containerRect.width,
    );
    const { col, row } = cellAtPoint(
      event.clientX - containerRect.left,
      event.clientY - containerRect.top,
      cellGeometry,
    );
    const cursorCol = Math.min(
      emptyCanvasMetrics.columns - 1,
      Math.max(0, Math.floor(col)),
    );
    const cursorRow = Math.max(0, Math.floor(row));
    return availableDropSpan(
      {},
      emptyCanvasMetrics.columns,
      cursorCol,
      cursorRow,
      FALLBACK_ROW_SPAN,
      FALLBACK_COL_SPAN,
    );
  };

  /**
   * Places a block from the palette.
   *
   * Into whatever is selected when that can hold children, and into the root
   * otherwise. An author who has just selected a section and reaches for a
   * chart means to put it in that section; one who has selected a chart means
   * to put the next thing beside it, not inside it.
   *
   * A drag from the palette says where for itself — the container it was
   * dropped on takes it — so only the click needs a target chosen for it.
   * Both then go through the same `placeBlock`, because two copies of what a
   * freshly placed block looks like is how the two paths quietly diverge.
   */
  const addBlock = (type: string): void => {
    const selected = provider.getSelection();
    const selectedNode =
      selected === undefined ? undefined : provider.getNode(selected);
    placeBlock(
      selectedNode?.children !== undefined ? selectedNode.id : root.id,
      type,
    );
  };

  return (
    <PageContainer vertical>
      <DashboardHeader />
      <Workspace>
        <EditorPanel onAdd={addBlock} />
        <Canvas
          data-test="canvas"
          onClick={event => {
            // A click that reached the canvas itself passed every block on
            // the way, so it is the one gesture that unambiguously means
            // "nothing". A click on a block stops before here.
            if (event.target === event.currentTarget) {
              provider.setSelection(undefined);
            }
          }}
        >
          {isEmpty ? (
            <EmptyCanvasWrapper>
              {/* The dashboard itself, standing in for a canvas that has
                  nothing on it yet. It selects the root because that is the
                  only thing there is to select here, and because how the
                  canvas is arranged is asked in the root's properties — a
                  blank dashboard is exactly when that is asked, since
                  whatever is placed next lands in the mode already chosen.
                  Without this the mode would be unreachable until something
                  had already been placed and then rearranged. */}
              <CanvasPlaceholder
                ref={placeholderRef}
                // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="button"
                tabIndex={0}
                aria-label={t('Dashboard')}
                data-test="empty-canvas"
                onClick={() => provider.setSelection(root.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    provider.setSelection(root.id);
                  }
                }}
                // The same drop target `RootGrid` offers once the root has
                // at least one child — this stands in for it beforehand,
                // since a dashboard with nothing on it yet is exactly when
                // this placeholder (rather than `RootGrid`) is what's on
                // screen to drop onto. Without this, the empty state's own
                // "Drag a building block from the panel" is an instruction
                // this element cannot actually answer.
                onDragEnter={event => {
                  if (event.dataTransfer.types.includes(PALETTE_MIME)) {
                    setDragOverCount(count => count + 1);
                  }
                }}
                onDragLeave={event => {
                  if (event.dataTransfer.types.includes(PALETTE_MIME)) {
                    setDragOverCount(count => {
                      const next = Math.max(0, count - 1);
                      if (next === 0) setGhostRect(null);
                      return next;
                    });
                  }
                }}
                onDragOver={event => {
                  if (!event.dataTransfer.types.includes(PALETTE_MIME)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                  setGhostRect(resolveEmptyCanvasDropRect(event));
                }}
                onDrop={event => {
                  const type = event.dataTransfer.getData(PALETTE_MIME);
                  setDragOverCount(0);
                  if (type !== '') {
                    event.preventDefault();
                    const rect = resolveEmptyCanvasDropRect(event);
                    placeBlockAt(root.id, type, 0, {
                      col: rect.x + 1,
                      row: rect.y + 1,
                      colSpan: rect.w,
                      rowSpan: rect.h,
                    });
                  }
                  setGhostRect(null);
                }}
              >
                {ghostRect ? (
                  (() => {
                    const containerWidthPx =
                      placeholderRef.current?.getBoundingClientRect().width ??
                      0;
                    const cellGeometry = resolveCellGeometry(
                      emptyCanvasMetrics,
                      containerWidthPx,
                    );
                    const pixelRect = pixelRectForCell(ghostRect, cellGeometry);
                    return (
                      <DropPreview
                        data-test="empty-canvas-drop-preview"
                        style={{
                          left: pixelRect.left,
                          top: pixelRect.top,
                          width: pixelRect.width,
                          height: pixelRect.height,
                        }}
                      />
                    );
                  })()
                ) : (
                  <EmptyState
                    image="empty-dashboard.svg"
                    title={t('Start building')}
                    description={t(
                      'Drag a building block from the panel, or ask the assistant for one.',
                    )}
                  />
                )}
              </CanvasPlaceholder>
            </EmptyCanvasWrapper>
          ) : (
            <BuildingBlockView nodeId={root.id} />
          )}
        </Canvas>
      </Workspace>
    </PageContainer>
  );
}
