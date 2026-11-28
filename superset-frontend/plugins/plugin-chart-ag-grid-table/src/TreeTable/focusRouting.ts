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
  createContext,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { GridApi } from 'ag-grid-community';

/** An open full-width area, registered by its renderer. */
export interface RoutedArea {
  /** The renderer's root element, inside AG Grid's full-width row. */
  root: HTMLElement;
  /** The grid that holds the full-width row. */
  api: GridApi;
  /** The full-width row's index in that grid. */
  rowIndex: () => number | null;
  /** Mount the area's contents when they are absent; true if they were. */
  materialize?: () => boolean;
  /** Whether the area's contents have keyboard stops (a child grid or Retry). */
  expectsStops?: () => boolean;
}

export interface FocusRouter {
  register: (area: RoutedArea) => () => void;
}

export const FocusRouterContext = createContext<FocusRouter | null>(null);

export const FULL_WIDTH_ROW = '.ag-full-width-row';
/** How long Tab waits for an area that mounts on entry to draw its stops. */
const MOUNT_FRAMES = 60;
const GRID = '.ag-root-wrapper';
const HEADER_ROW = '.ag-header-row';
const BODY_ROW = '.ag-row';
const TABBABLE = 'button, input, select, textarea, a[href], [tabindex]';

function isShown(element: HTMLElement) {
  return !element.closest('[hidden],[aria-hidden="true"]');
}

export interface AreaStops {
  /** The child grid's first header cell. */
  header?: HTMLElement;
  /** The child grid's last cell, or its last full-width row. */
  lastCell?: HTMLElement;
  /** Retry, Load more and other buttons outside the child grid. */
  buttons: HTMLElement[];
}

/** The keyboard stops of an area in reading order. */
export function areaStops(root: HTMLElement): AreaStops {
  const grid = root.querySelector<HTMLElement>(GRID);
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>('button'),
  ].filter(
    button =>
      !button.disabled &&
      button.tabIndex >= 0 &&
      isShown(button) &&
      !(grid && grid.contains(button)),
  );
  if (!grid) return { buttons };
  const header =
    grid.querySelector<HTMLElement>('.ag-header-cell') ?? undefined;
  const rows = [
    ...grid.querySelectorAll<HTMLElement>(
      '.ag-grid-scrolling-container > [row-index]',
    ),
  ]
    .filter(row => row.closest(GRID) === grid)
    .sort(
      (a, b) =>
        Number(a.getAttribute('row-index')) -
        Number(b.getAttribute('row-index')),
    );
  const last = rows[rows.length - 1];
  const cells = last?.querySelectorAll<HTMLElement>('[role="gridcell"]');
  const lastCell =
    last && (last.matches(FULL_WIDTH_ROW) || !cells?.length)
      ? last
      : cells?.[cells.length - 1];
  return { header, lastCell, buttons };
}

function apiOf(element: HTMLElement) {
  return element.closest<HTMLElement & { _agGridApi?: GridApi }>(
    '[data-themed-ag-grid]',
  )?._agGridApi;
}

/** Focus an area stop and synchronize AG Grid's keyboard state. */
export function focusStop(
  stop: HTMLElement,
  { preventScroll }: FocusOptions = {},
) {
  // The grid API focuses the cell without options. Focus it first so the
  // API's repeat focus on the same element leaves scrolling alone.
  if (preventScroll) stop.focus({ preventScroll });
  const api = apiOf(stop);
  const colId =
    stop.getAttribute('col-id') ??
    stop.querySelector('[col-id]')?.getAttribute('col-id');
  const row = stop.closest('[row-index]');
  if (api && stop.matches('.ag-header-cell') && colId) {
    api.setFocusedHeader(colId);
  } else if (api && row && !stop.matches('button')) {
    const columns = api.getAllDisplayedColumns();
    api.setFocusedCell(
      Number(row.getAttribute('row-index')),
      colId ?? columns[columns.length - 1],
    );
  }
  if (document.activeElement !== stop) stop.focus({ preventScroll });
}

function focusRow(api: GridApi, rowIndex: number, last: boolean) {
  const columns = api.getAllDisplayedColumns();
  const column = last ? columns[columns.length - 1] : columns[0];
  if (!column || rowIndex < 0 || rowIndex >= api.getDisplayedRowCount())
    return false;
  api.setFocusedCell(rowIndex, column);
  return true;
}

/**
 * AG Grid 36 makes header rows and body rows tab stops. A Tab onto one goes on
 * to that row's first cell (its last cell with Shift+Tab), as AG Grid 35's Tab
 * landed on a cell.
 */
function enterRow(row: HTMLElement, backwards: boolean) {
  const api = apiOf(row);
  const columns = api?.getAllDisplayedColumns() ?? [];
  const column = backwards ? columns[columns.length - 1] : columns[0];
  if (!api || !column) return;
  if (row.matches(HEADER_ROW)) api.setFocusedHeader(column);
  else api.setFocusedCell(Number(row.getAttribute('row-index')), column);
}

/** Focus the first tab stop after `grid`, outside it. */
function focusAfter(grid: HTMLElement) {
  const next = [...document.querySelectorAll<HTMLElement>(TABBABLE)].find(
    element =>
      element.tabIndex >= 0 &&
      !(element as HTMLButtonElement).disabled &&
      isShown(element) &&
      !grid.contains(element) &&
      Boolean(
        grid.compareDocumentPosition(element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
  );
  next?.focus();
  return Boolean(next);
}

/**
 * Tab routing for full-width areas inside `container`. AG Grid's default Tab
 * stops on a full-width row and skips its content: on Tab or Shift+Tab onto an
 * area this moves focus to the area's first or last stop, and from its first
 * or last stop out to the parent rows. Arrows and the inner grids keep AG
 * Grid's own keys.
 */
export function useFocusRouting(
  container: RefObject<HTMLElement>,
): FocusRouter {
  const areas = useRef(new Set<RoutedArea>());
  const tab = useRef<{ backwards: boolean }>();
  const register = useCallback((area: RoutedArea) => {
    areas.current.add(area);
    return () => {
      areas.current.delete(area);
    };
  }, []);
  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const areaOf = (target: HTMLElement) => {
      const row = target.closest(FULL_WIDTH_ROW);
      return [...areas.current].find(
        area => row && area.root.closest(FULL_WIDTH_ROW) === row,
      );
    };
    const forwardFrom = (area: RoutedArea): boolean => {
      const rowIndex = area.rowIndex();
      if (rowIndex !== null && focusRow(area.api, rowIndex + 1, false))
        return true;
      const row = area.root.closest<HTMLElement>(FULL_WIDTH_ROW);
      const outer = row?.parentElement ? areaOf(row.parentElement) : undefined;
      if (outer) {
        const [button] = areaStops(outer.root).buttons;
        if (button) {
          focusStop(button);
          return true;
        }
        return forwardFrom(outer);
      }
      const grid = row?.closest<HTMLElement>(GRID);
      return Boolean(grid && focusAfter(grid));
    };
    const route = (area: RoutedArea, backwards: boolean) => {
      const { header, lastCell, buttons } = areaStops(area.root);
      const stop = backwards
        ? (buttons[buttons.length - 1] ?? lastCell)
        : (header ?? buttons[0]);
      if (stop) {
        focusStop(stop);
        return;
      }
      const rowIndex = area.rowIndex();
      setTimeout(() => {
        if (!backwards) forwardFrom(area);
        else if (rowIndex !== null) focusRow(area.api, rowIndex - 1, true);
      });
    };
    /** Go into an area from its full-width row, mounting its contents first. */
    const enter = (area: RoutedArea, row: HTMLElement, backwards: boolean) => {
      if (!area.materialize?.() || !area.expectsStops?.()) {
        route(area, backwards);
        return;
      }
      let frames = 0;
      const wait = () => {
        if (document.activeElement !== row) return;
        const { header, buttons } = areaStops(area.root);
        frames += 1;
        if (!header && !buttons.length && frames <= MOUNT_FRAMES) {
          requestAnimationFrame(wait);
          return;
        }
        // A stop that is itself an absent area routes on in the same direction.
        const previous = tab.current;
        tab.current = { backwards };
        try {
          route(area, backwards);
        } finally {
          tab.current = previous;
        }
      };
      requestAnimationFrame(wait);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey) return;
      tab.current = { backwards: event.shiftKey };
      setTimeout(() => {
        tab.current = undefined;
      });
      const target = event.target as HTMLElement;
      const area = areaOf(target);
      if (!area) return;
      const { header, lastCell, buttons } = areaStops(area.root);
      if (target.matches(FULL_WIDTH_ROW)) {
        if (!event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          enter(area, target, false);
          return;
        }
        return;
      }
      const index = buttons.indexOf(target);
      let next: HTMLElement | undefined;
      let out = false;
      if (event.shiftKey) {
        if (target === header) out = true;
        else if (index > 0) next = buttons[index - 1];
        else if (index === 0) next = lastCell ?? header;
        if (index === 0 && !next) out = true;
      } else if (target === lastCell || index >= 0) {
        next = target === lastCell ? buttons[0] : buttons[index + 1];
        out = !next;
      }
      if (!next && !out) return;
      const rowIndex = area.rowIndex();
      let moved = false;
      if (next) {
        focusStop(next);
        moved = true;
      } else if (!event.shiftKey) moved = forwardFrom(area);
      else if (rowIndex !== null)
        moved = focusRow(area.api, rowIndex - 1, true);
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!target.matches(FULL_WIDTH_ROW)) {
        if (tab.current && target.matches(`${HEADER_ROW}, ${BODY_ROW}`))
          enterRow(target, tab.current.backwards);
        return;
      }
      const from = event.relatedTarget as HTMLElement | null;
      if (from && from !== target && target.contains(from)) {
        // The outer grid also handles a key the inner grid already used and
        // focuses the full-width row; keep the inner grid's focus.
        from.focus();
        return;
      }
      if (!tab.current) return;
      const area = areaOf(target);
      if (area) enter(area, target, tab.current.backwards);
    };
    element.addEventListener('keydown', onKeyDown, true);
    element.addEventListener('focusin', onFocusIn);
    return () => {
      element.removeEventListener('keydown', onKeyDown, true);
      element.removeEventListener('focusin', onFocusIn);
    };
  }, [container]);
  return { register };
}

/** Register an area renderer with the chart's router while it is mounted. */
export function useRoutedArea(
  router: FocusRouter | null,
  root: RefObject<HTMLElement>,
  api: GridApi | undefined,
  rowIndex: () => number | null,
  contents: Pick<RoutedArea, 'materialize' | 'expectsStops'> = {},
) {
  const index = useRef(rowIndex);
  index.current = rowIndex;
  const latest = useRef(contents);
  latest.current = contents;
  useEffect(() => {
    if (!router || !root.current || !api) return undefined;
    return router.register({
      root: root.current,
      api,
      rowIndex: () => index.current(),
      materialize: () => latest.current.materialize?.() ?? false,
      expectsStops: () => latest.current.expectsStops?.() ?? false,
    });
  }, [router, root, api]);
}

/** Focus the given row's cell in `column`, once the row is found. */
export function focusCell(
  api: GridApi | undefined,
  find: (data: unknown) => boolean,
  column: string,
) {
  if (!api) return false;
  let rowIndex: number | null = null;
  api.forEachNode(node => {
    if (rowIndex === null && find(node.data)) ({ rowIndex } = node);
  });
  if (rowIndex === null) return false;
  api.setFocusedCell(rowIndex, column);
  return true;
}
