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
 * Collapsible row and column groups in the sheet (see src/utils/outline.ts
 * for the groups themselves). The row and column headers get a margin for
 * the groups, where a bracket marks each group and a +/- button collapses or
 * expands it. The buttons are HTML on top of Univer's canvas, placed from the
 * sheet's layout and scroll position.
 */
import {
  CommandType,
  createUniver,
  ICommandInfo,
  ICommandService,
  IRange,
  Univer,
} from '@univerjs/presets';
import {
  ContextMenuGroup,
  ContextMenuPosition,
  FWorkbook,
  FWorksheet,
  IMenuManagerService,
  IRenderManagerService,
  MenuItemType,
} from '@univerjs/preset-sheets-core';
import {
  addGroup,
  collapseToLevel,
  groupLevels,
  hiddenIndexes,
  insertIndexes,
  MANUAL_GROUPS,
  Outline,
  OutlineDimension,
  outlineDepth,
  outlineMargin,
  OUTLINE_LEVEL_SIZE,
  removeGroups,
  removeIndexes,
} from '../utils/outline';

// Univer draws the sheet in its own light colors whatever Superset's theme,
// so the buttons drawn on top of it match the sheet rather than the theme
const BUTTON_COLORS = {
  // eslint-disable-next-line theme-colors/no-literal-colors
  line: '#666',
  // eslint-disable-next-line theme-colors/no-literal-colors
  background: '#fff',
};

// size of a +/- button
const BUTTON_SIZE = 11;
const LEVEL_SIZE = OUTLINE_LEVEL_SIZE;
// Univer's defaults for the size of the 1, 2, 3… and A, B, C… headers
const ROW_HEADER_WIDTH = 46;
const COLUMN_HEADER_HEIGHT = 20;

type FUniver = ReturnType<typeof createUniver>['univerAPI'];

export interface OutlineOptions {
  univer: Univer;
  univerAPI: FUniver;
  workbook: FWorkbook;
  container: HTMLElement;
  outline: Outline;
  editable: boolean;
  /** false when the sheet's 1, 2, 3… and A, B, C… headers are hidden */
  headerLabels: boolean;
  /** the total rows of row groups are above them, see groupRows */
  summaryAbove?: boolean;
  onChange?: (outline: Outline) => void;
}

interface Layout {
  start: (i: number) => number;
  size: (i: number) => number;
  frozen: number;
  scrollStart: number;
  header: number;
}

export function mountOutline({
  univer,
  univerAPI,
  workbook,
  container,
  outline: initialOutline,
  editable,
  headerLabels,
  summaryAbove = false,
  onChange,
}: OutlineOptions): { dispose: () => void } {
  let outline = initialOutline;
  // eslint-disable-next-line no-underscore-dangle
  const injector = univer.__getInjector();
  const sheet = (): FWorksheet => workbook.getSheets()[0];
  const disposers: (() => void)[] = [];

  const layer = document.createElement('div');
  layer.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;';
  container.appendChild(layer);
  disposers.push(() => layer.remove());

  const setHidden = (
    dimension: OutlineDimension,
    start: number,
    end: number,
    hidden: boolean,
  ) => {
    const isRows = dimension === 'rows';
    const ranges: IRange[] = [
      isRows
        ? { startRow: start, endRow: end, startColumn: 0, endColumn: 0 }
        : { startRow: 0, endRow: 0, startColumn: start, endColumn: end },
    ];
    // mutations, so this isn't undone with the user's edits and also works
    // on a read-only sheet
    univerAPI.syncExecuteCommand(
      `sheet.mutation.set-${isRows ? 'row' : 'col'}-${hidden ? 'hidden' : 'visible'}`,
      {
        unitId: workbook.getId(),
        subUnitId: sheet().getSheetId(),
        ranges,
      },
    );
  };

  // shows and hides the rows (or columns) of the groups as they are now
  const applyVisibility = (dimension: OutlineDimension) => {
    const groups = outline[dimension];
    if (!groups.length) return;
    const hidden = hiddenIndexes(groups);
    const first = Math.min(...groups.map(group => group.start));
    const last = Math.max(...groups.map(group => group.end));
    let runStart = first;
    for (let i = first + 1; i <= last + 1; i += 1) {
      if (i > last || hidden.has(i) !== hidden.has(runStart)) {
        setHidden(dimension, runStart, i - 1, hidden.has(runStart));
        runStart = i;
      }
    }
  };

  const update = (next: Outline) => {
    outline = next;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    render();
    onChange?.(outline);
  };

  const toggle = (dimension: OutlineDimension, index: number) => {
    const collapsed = !outline[dimension][index].collapsed;
    const groups = outline[dimension].map((other, i) =>
      i === index ? { ...other, collapsed } : other,
    );
    outline = { ...outline, [dimension]: groups };
    applyVisibility(dimension);
    update(outline);
  };

  const layoutOf = (dimension: OutlineDimension): Layout | null => {
    const skeleton = sheet().getSkeleton();
    if (!skeleton) return null;
    const isRows = dimension === 'rows';
    const accumulation = isRows
      ? skeleton.rowHeightAccumulation
      : skeleton.columnWidthAccumulation;
    const start = (i: number) =>
      i <= 0 ? 0 : (accumulation[Math.min(i, accumulation.length) - 1] ?? 0);
    const freeze = sheet().getFreeze();
    const split = isRows ? freeze.ySplit : freeze.xSplit;
    const frozen =
      split > 0 ? (isRows ? freeze.startRow : freeze.startColumn) : 0;
    // scrolled distance of the main (unfrozen) part of the sheet; the
    // facade's getScrollState isn't usable from this bundle
    const viewport = injector
      .get(IRenderManagerService)
      .getRenderUnitById(workbook.getId())
      ?.scene.getViewport('viewMain');
    const scrolled =
      (isRows ? viewport?.viewportScrollY : viewport?.viewportScrollX) ?? 0;
    return {
      start,
      size: i => start(i + 1) - start(i),
      frozen,
      scrollStart: scrolled,
      header: isRows ? skeleton.columnHeaderHeight : skeleton.rowHeaderWidth,
    };
  };

  // position of row (or column) i on screen, relative to the canvas
  const position = (layout: Layout, i: number) =>
    layout.header +
    layout.start(i) -
    (i < layout.frozen ? 0 : layout.scrollStart);

  const visibleFrom = (layout: Layout, i: number) =>
    i < layout.frozen
      ? layout.header
      : layout.header + layout.start(layout.frozen);

  const canvas = () =>
    [...container.querySelectorAll('canvas')].sort(
      (a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight,
    )[0];

  const renderDimension = (
    dimension: OutlineDimension,
    origin: { x: number; y: number },
    extent: number,
    zoom: number,
    color: string,
  ) => {
    const groups = outline[dimension];
    const layout = layoutOf(dimension);
    if (!layout || !groups.length) return;
    const isRows = dimension === 'rows';
    const levels = groupLevels(groups);
    const count = isRows ? sheet().getMaxRows() : sheet().getMaxColumns();
    groups.forEach((group, index) => {
      // the button goes on the row after the group, like Excel's, or before
      // it when the group ends the sheet
      const above = isRows && summaryAbove;
      const after = group.end + 1 < count ? group.end + 1 : group.start - 1;
      const before = group.start > 0 ? group.start - 1 : group.end + 1;
      const buttonAt = above ? before : after;
      const across =
        levels[index] * LEVEL_SIZE + (LEVEL_SIZE - BUTTON_SIZE) / 2;
      const clip = (from: number, to: number, i: number) => {
        const min = visibleFrom(layout, i);
        return [Math.max(from, min), Math.min(to, extent / zoom)];
      };

      if (!group.collapsed) {
        const [from, to] = clip(
          position(layout, group.start),
          position(layout, group.end) + layout.size(group.end),
          group.start,
        );
        if (to > from) {
          const line = document.createElement('div');
          const along = isRows ? 'top' : 'left';
          const lengthProp = isRows ? 'height' : 'width';
          line.style.cssText = `position:absolute;${along}:${
            (isRows ? origin.y : origin.x) + from * zoom
          }px;${isRows ? 'left' : 'top'}:${
            (isRows ? origin.x : origin.y) + across + BUTTON_SIZE / 2
          }px;${lengthProp}:${(to - from) * zoom}px;${
            isRows ? 'width' : 'height'
          }:4px;border-${isRows ? 'left' : 'top'}:1px solid ${color};border-${
            // the tick points at the button
            isRows ? (above ? 'top' : 'bottom') : 'right'
          }:1px solid ${color};`;
          layer.appendChild(line);
        }
      }

      if (buttonAt < 0) return;
      const center = position(layout, buttonAt) + layout.size(buttonAt) / 2;
      const [from, to] = clip(center, center, buttonAt);
      if (from !== to || to < 0) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = group.collapsed ? '+' : '−';
      button.title = group.collapsed ? 'Expand group' : 'Collapse group';
      button.setAttribute('aria-label', button.title);
      button.style.cssText = `position:absolute;pointer-events:auto;${
        isRows ? 'top' : 'left'
      }:${(isRows ? origin.y : origin.x) + center * zoom - BUTTON_SIZE / 2}px;${
        isRows ? 'left' : 'top'
      }:${
        (isRows ? origin.x : origin.y) + across
      }px;width:${BUTTON_SIZE}px;height:${BUTTON_SIZE}px;padding:0;margin:0;border:1px solid ${color};border-radius:2px;background:${BUTTON_COLORS.background};color:${color};font:10px/9px sans-serif;cursor:pointer;`;
      button.addEventListener('pointerdown', event => event.stopPropagation());
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggle(dimension, index);
      });
      layer.appendChild(button);
    });
  };

  // Excel's outline level buttons: 1 shows only what is outside every row
  // group, the last one shows everything
  const renderLevels = (origin: { x: number; y: number }, color: string) => {
    const depth = outlineDepth(outline.rows);
    for (let level = 1; depth && level <= depth + 1; level += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(level);
      button.title = `Show row group level ${level}`;
      button.setAttribute('aria-label', button.title);
      button.style.cssText = `position:absolute;pointer-events:auto;top:${
        origin.y + 2
      }px;left:${
        origin.x + (level - 1) * LEVEL_SIZE + (LEVEL_SIZE - BUTTON_SIZE) / 2
      }px;width:${BUTTON_SIZE}px;height:${BUTTON_SIZE}px;padding:0;margin:0;border:1px solid ${color};border-radius:2px;background:${BUTTON_COLORS.background};color:${color};font:9px/9px sans-serif;cursor:pointer;`;
      button.addEventListener('pointerdown', event => event.stopPropagation());
      button.addEventListener('click', event => {
        event.stopPropagation();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        showLevel(level);
      });
      layer.appendChild(button);
    }
  };

  const showLevel = (level: number) => {
    outline = { ...outline, rows: collapseToLevel(outline.rows, level) };
    applyVisibility('rows');
    update(outline);
  };

  let headerSizes = { rows: -1, columns: -1 };
  const sizeHeaders = () => {
    const rows = outlineDepth(outline.rows);
    const columns = outlineDepth(outline.columns);
    if (rows === headerSizes.rows && columns === headerSizes.columns) return;
    headerSizes = { rows, columns };
    const margin = outlineMargin;
    // the labels are hidden on dashboards that hide the headers, only the
    // margin for the groups is shown there
    const transparent = 'transparent';
    const style = headerLabels
      ? {}
      : { fontColor: transparent, borderColor: transparent };
    const width = (headerLabels ? ROW_HEADER_WIDTH : 0) + margin(rows);
    const height = Math.max(
      (headerLabels ? COLUMN_HEADER_HEIGHT : 0) + margin(columns),
      // room for the level buttons
      rows ? OUTLINE_LEVEL_SIZE + 2 : 0,
    );
    const target = {
      unitId: workbook.getId(),
      subUnitId: sheet().getSheetId(),
    };
    // the sheet's layout is recalculated from its config, which the commands
    // below don't change
    const config = sheet().getSheet().getConfig();
    config.rowHeader = { ...config.rowHeader, width, hidden: width ? 0 : 1 };
    config.columnHeader = {
      ...config.columnHeader,
      height,
      hidden: height ? 0 : 1,
    };
    // the commands move the sheet's viewports along with the headers
    univerAPI.executeCommand('sheet.command.set-row-header-width', {
      ...target,
      size: width,
    });
    univerAPI.executeCommand('sheet.command.set-col-header-height', {
      ...target,
      size: height,
    });
    sheet().customizeRowHeader({ headerStyle: { ...style, size: width } });
    sheet().customizeColumnHeader({
      headerStyle: {
        ...style,
        size: height,
        ...(headerLabels && columns ? { textBaseline: 'bottom' as const } : {}),
      },
    });
    sheet().refreshCanvas();
  };

  // a timer rather than an animation frame, which doesn't run while the tab is
  // in the background and would leave the buttons out of date
  let frame: ReturnType<typeof setTimeout> | undefined;
  const render = () => {
    clearTimeout(frame);
    frame = setTimeout(() => {
      layer.replaceChildren();
      sizeHeaders();
      const target = canvas();
      if (!target) return;
      const box = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const origin = { x: rect.left - box.left, y: rect.top - box.top };
      const zoom = sheet().getZoom() || 1;
      const color = BUTTON_COLORS.line;
      renderDimension('rows', origin, rect.height, zoom, color);
      renderDimension('columns', origin, rect.width, zoom, color);
      renderLevels(origin, color);
    }, 16);
  };
  disposers.push(() => clearTimeout(frame));

  // keep the groups on the same rows when rows or columns are added or removed
  const commandListener = workbook.onCommandExecuted(
    (command: ICommandInfo) => {
      const params = command.params as { range?: IRange } | undefined;
      const range = params?.range;
      if (command.type !== CommandType.MUTATION) return;
      if (range && command.id === 'sheet.mutation.insert-row') {
        const count = range.endRow - range.startRow + 1;
        update({
          ...outline,
          rows: insertIndexes(outline.rows, range.startRow, count),
        });
      } else if (range && command.id === 'sheet.mutation.remove-rows') {
        update({
          ...outline,
          rows: removeIndexes(outline.rows, range.startRow, range.endRow),
        });
      } else if (range && command.id === 'sheet.mutation.insert-col') {
        const count = range.endColumn - range.startColumn + 1;
        update({
          ...outline,
          columns: insertIndexes(outline.columns, range.startColumn, count),
        });
      } else if (range && command.id === 'sheet.mutation.remove-col') {
        update({
          ...outline,
          columns: removeIndexes(
            outline.columns,
            range.startColumn,
            range.endColumn,
          ),
        });
      } else {
        render();
      }
    },
  );
  disposers.push(() => commandListener.dispose());
  const scrollListener = univerAPI.addEvent(univerAPI.Event.Scroll, render);
  disposers.push(() => scrollListener.dispose());
  const resizeObserver = new ResizeObserver(render);
  resizeObserver.observe(container);
  disposers.push(() => resizeObserver.disconnect());

  if (editable && MANUAL_GROUPS) {
    const commands = injector.get(ICommandService);
    const menus = injector.get(IMenuManagerService);
    const selection = (dimension: OutlineDimension) => {
      const range = workbook.getActiveRange()?.getRange();
      if (!range) return null;
      return dimension === 'rows'
        ? [range.startRow, range.endRow]
        : [range.startColumn, range.endColumn];
    };
    const group = (dimension: OutlineDimension) => {
      const selected = selection(dimension);
      if (!selected) return false;
      const groups = addGroup(outline[dimension], selected[0], selected[1]);
      if (!groups) return false;
      update({ ...outline, [dimension]: groups });
      return true;
    };
    const ungroup = (dimension: OutlineDimension) => {
      const selected = selection(dimension);
      if (!selected) return false;
      const { groups, removed } = removeGroups(
        outline[dimension],
        selected[0],
        selected[1],
      );
      if (!removed.length) return false;
      removed
        .filter(old => old.collapsed)
        .forEach(old => setHidden(dimension, old.start, old.end, false));
      // rows of collapsed groups that remain stay hidden
      hiddenIndexes(groups).forEach(i => setHidden(dimension, i, i, true));
      update({ ...outline, [dimension]: groups });
      return true;
    };

    const items: [OutlineDimension, string, string, () => boolean][] = [
      ['rows', 'group-rows', 'Group rows', () => group('rows')],
      ['rows', 'ungroup-rows', 'Ungroup rows', () => ungroup('rows')],
      ['columns', 'group-columns', 'Group columns', () => group('columns')],
      [
        'columns',
        'ungroup-columns',
        'Ungroup columns',
        () => ungroup('columns'),
      ],
    ];
    items.forEach(([dimension, name, title, handler], i) => {
      const id = `superset.command.outline-${name}`;
      const registration = commands.registerCommand({
        id,
        type: CommandType.COMMAND,
        handler,
      });
      disposers.push(() => registration.dispose());
      const position =
        dimension === 'rows'
          ? ContextMenuPosition.ROW_HEADER
          : ContextMenuPosition.COL_HEADER;
      menus.mergeMenu({
        [position]: {
          [ContextMenuGroup.LAYOUT]: {
            [id]: {
              // after "Fill the window" (4.5) and before "Freeze" (5)
              order: 4.6 + i / 100,
              menuItemFactory: () => ({
                id,
                type: MenuItemType.BUTTON,
                title,
              }),
            },
          },
        },
      });
    });
  }

  render();
  return {
    dispose: () => disposers.reverse().forEach(dispose => dispose()),
  };
}
