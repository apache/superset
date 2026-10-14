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
import { cloneDeep, omit } from 'lodash-es';
import { DataRecord } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  anchorOutline,
  hiddenIndexes,
  Outline,
  outlineDepth,
  OutlineGroup,
  outlineMargin,
  OUTLINE_LEVEL_SIZE,
  SavedOutline,
} from './outline';
import {
  CellData,
  CellValue,
  MergeRange,
  SheetData,
  WorkbookData,
} from '../runtimeTypes';

/** Query result as a grid: the header rows followed by the data rows. */
export type Grid = (CellValue | null)[][];

/** How the query result is laid out in the grid. */
export interface GridLayout {
  /** header rows on top: 1, or one per pivot level */
  headerRows: number;
  /** columns frozen on the left: the pivot's row fields */
  frozenCols: number;
  /** merged header cells */
  merges: MergeRange[];
  /** total rows added by groupRows, shown in bold */
  subtotalRows?: number[];
}

export const DEFAULT_LAYOUT: GridLayout = {
  headerRows: 1,
  frozenCols: 0,
  merges: [],
};

/** What the chart stores in `form_data.univer_workbook` (as a JSON string). */
export interface UniverSavedState {
  version: 1;
  /** Size of the query result area (header row included) when it was saved. */
  dataRows: number;
  dataCols: number;
  /** true when query values were left out of `workbook` to save space */
  stripped: boolean;
  /**
   * The query's column labels when it was saved. A header cell in a stripped
   * workbook that still has a value is one the user renamed, it is kept while
   * the query's label for that column stays the same.
   */
  headers?: (CellValue | null)[];
  /** like `headers`, for every header row */
  headerGrid?: (CellValue | null)[][];
  /** layout of the query result when it was saved */
  layout?: GridLayout;
  /** collapsible row and column groups */
  outline?: SavedOutline;
  workbook: WorkbookData;
}

export const HEADER_STYLE_ID = 'superset_header';
/** style of grouped rows' totals and merged values, see groupRows */
export const SUBTOTAL_STYLE_ID = 'superset_subtotal';
const SUBTOTAL_STYLE = { bl: 1, vt: 1 };
// label of a pivot's Total row, see PIVOT_TOTAL in plugin/buildQuery.ts
const PIVOT_TOTAL_LABEL = 'Total';
const WORKBOOK_ID = 'superset-univer';
const SHEET_ID = 'data';
// cell fields that hold the value, everything else (like style) is kept
const DATA_KEYS = ['v', 't', 'f', 'si', 'p'];

// pixel widths used to fit columns to their content in a fresh workbook
export const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 320;
const CHAR_WIDTH = 8;
const COL_PADDING = 16;
const WIDTH_SAMPLE_ROWS = 100;
// Univer's defaults for the width of the 1, 2, 3… row header and of a column
const ROW_HEADER_WIDTH = 46;
const DEFAULT_COL_WIDTH = 88;
// room for Univer's vertical scrollbar, which is drawn over the cells
const SCROLLBAR_WIDTH = 12;

export function parseSavedState(raw?: string | null): UniverSavedState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (state?.version === 1 && state.workbook?.sheetOrder?.length) {
      return state;
    }
  } catch {
    // fall through: a broken value is treated as "nothing saved"
  }
  return null;
}

function formatTemporal(value: number | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const iso = date.toISOString();
  // drop the time part for whole days, Superset sends timestamps in UTC
  return iso.endsWith('T00:00:00.000Z')
    ? iso.slice(0, 10)
    : iso.slice(0, 19).replace('T', ' ');
}

export function toCellValue(
  value: unknown,
  coltype?: GenericDataType,
): CellValue | null {
  if (value === null || value === undefined) return null;
  if (
    coltype === GenericDataType.Temporal &&
    (typeof value === 'number' || typeof value === 'string')
  ) {
    return formatTemporal(value);
  }
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    !Number.isInteger(value)
  ) {
    // drop floating point noise such as 524.999999999985, which the
    // spreadsheet would otherwise show with all its digits
    return Number(value.toPrecision(12));
  }
  if (
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return JSON.stringify(value);
}

export function buildGrid(
  data: DataRecord[],
  colnames: string[],
  coltypes: GenericDataType[],
  labels: Record<string, string> = {},
): Grid {
  return [
    colnames.map(col => labels[col] ?? col),
    ...data.map(row =>
      colnames.map((col, i) => toCellValue(row[col], coltypes[i])),
    ),
  ];
}

function gridSize(grid: Grid) {
  return { rows: grid.length, cols: grid[0]?.length ?? 0 };
}

// splits a column name of a flattened pivot ("SUM(sales), Action") into its
// levels; commas inside a level are escaped as "\,"
function splitFlatName(name: string): string[] {
  return name.split(/(?<!\\), /).map(part => part.replace(/\\,/g, ','));
}

/**
 * Lays out a pivoted query result: the first `rowFields` columns are the
 * pivot's row fields, the other columns are named "metric, value, …" by
 * Superset's `flatten`. Each level gets a header row, with equal neighbouring
 * headers merged. The row fields' names go in the top header row, merged
 * down over the others. Row fields and metrics are shown with their `labels`
 * (verbose names).
 */
export function buildPivotGrid(
  data: DataRecord[],
  colnames: string[],
  coltypes: GenericDataType[],
  labels: Record<string, string>,
  rowFields: number,
): { grid: Grid; layout: GridLayout } {
  const levels = colnames.slice(rowFields).map(name => splitFlatName(name));
  const headerRows = Math.max(1, ...levels.map(parts => parts.length));
  const header: Grid = Array.from({ length: headerRows }, (_, r) =>
    colnames.map((col, c) => {
      if (c < rowFields) {
        return r === 0 ? (labels[col] ?? col) : null;
      }
      const value = levels[c - rowFields][r];
      if (value === undefined || value === '') return null;
      // the top level is the metric
      return r === 0 ? (labels[value] ?? value) : value;
    }),
  );

  const merges: MergeRange[] = [];
  if (headerRows > 1) {
    for (let c = 0; c < rowFields; c += 1) {
      merges.push({
        startRow: 0,
        endRow: headerRows - 1,
        startColumn: c,
        endColumn: c,
      });
    }
  }
  // a header spans the columns below it that share all levels above
  for (let r = 0; r < headerRows - 1; r += 1) {
    let start = rowFields;
    for (let c = rowFields + 1; c <= colnames.length; c += 1) {
      const same =
        c < colnames.length &&
        levels[c - rowFields].slice(0, r + 1).join('\u0000') ===
          levels[start - rowFields].slice(0, r + 1).join('\u0000');
      if (!same) {
        if (c - 1 > start && header[r][start] !== null) {
          merges.push({
            startRow: r,
            endRow: r,
            startColumn: start,
            endColumn: c - 1,
          });
        }
        start = c;
      }
    }
  }

  return {
    grid: [
      ...header,
      ...data.map(row =>
        colnames.map((col, i) => toCellValue(row[col], coltypes[i])),
      ),
    ],
    layout: { headerRows, frozenCols: rowFields, merges },
  };
}

function firstSheet(workbook: WorkbookData): SheetData | undefined {
  const sheetId = workbook.sheetOrder?.[0];
  return sheetId ? workbook.sheets?.[sheetId] : undefined;
}

function sameRange(a: MergeRange, b: MergeRange) {
  return (
    a.startRow === b.startRow &&
    a.endRow === b.endRow &&
    a.startColumn === b.startColumn &&
    a.endColumn === b.endColumn
  );
}

function layoutFreeze(layout: GridLayout): SheetData['freeze'] {
  return {
    xSplit: layout.frozenCols,
    ySplit: layout.headerRows,
    startRow: layout.headerRows,
    startColumn: layout.frozenCols,
  };
}

/**
 * Replaces the header merges and frozen panes of the previous layout with
 * those of the new one. Merges and freezing the user changed are kept.
 * Modifies `workbook`.
 */
function applyLayout(
  workbook: WorkbookData,
  previous: GridLayout,
  layout: GridLayout,
) {
  const sheet = firstSheet(workbook);
  if (!sheet) return;
  const crosses = (a: MergeRange, b: MergeRange) =>
    a.startRow <= b.endRow &&
    b.startRow <= a.endRow &&
    a.startColumn <= b.endColumn &&
    b.startColumn <= a.endColumn;
  sheet.mergeData = [
    // merged cells overlapping the new layout's would hide its data
    ...(sheet.mergeData ?? []).filter(
      range =>
        !previous.merges.some(old => sameRange(old, range)) &&
        !layout.merges.some(merge => crosses(merge, range)),
    ),
    ...layout.merges,
  ];
  const { freeze } = sheet;
  if (
    !freeze ||
    (freeze.ySplit === previous.headerRows &&
      freeze.xSplit === previous.frozenCols)
  ) {
    sheet.freeze = layoutFreeze(layout);
  }
}

/**
 * Writes the query result into the top-left corner of the first sheet.
 * Styles of existing cells are kept, so formatting survives a data refresh.
 * Cells that belonged to the previous (bigger) result are cleared.
 * Returns a new object, the input is not modified.
 */
export function applyGrid(
  workbook: WorkbookData,
  grid: Grid,
  previous: { rows: number; cols: number } | null,
  headerRows = 1,
): WorkbookData {
  const result = cloneDeep(workbook);
  const sheetId = result.sheetOrder?.[0];
  const sheet = sheetId ? result.sheets?.[sheetId] : undefined;
  if (!sheet) return result;

  const { rows, cols } = gridSize(grid);
  const cellData = (sheet.cellData ??= {});
  const maxRows = Math.max(rows, previous?.rows ?? 0);
  const maxCols = Math.max(cols, previous?.cols ?? 0);
  const hasHeaderStyle = !!result.styles?.[HEADER_STYLE_ID];

  for (let r = 0; r < maxRows; r += 1) {
    const row = (cellData[r] ??= {});
    for (let c = 0; c < maxCols; c += 1) {
      // a data cell can't keep a formula or rich text from an older version
      const cell: CellData = omit(row[c] ?? {}, DATA_KEYS);
      const value = r < rows && c < cols ? grid[r][c] : null;
      if (value !== null) cell.v = value;
      if (r < headerRows && value !== null && !cell.s && hasHeaderStyle) {
        cell.s = HEADER_STYLE_ID;
      }
      if (Object.keys(cell).length) row[c] = cell;
      else delete row[c];
    }
    if (!Object.keys(row).length) delete cellData[r];
  }

  return result;
}

/**
 * Sizes the first sheet to its content (query result, formulas, styled
 * cells) instead of an empty grid around it. Users add rows and columns
 * themselves, empty ones they added are dropped the next time the chart loads.
 */
export function fitSheetSize(workbook: WorkbookData, grid: Grid): WorkbookData {
  const sheetId = workbook.sheetOrder?.[0];
  const sheet = sheetId ? workbook.sheets?.[sheetId] : undefined;
  if (!sheetId || !sheet) return workbook;

  let { rows, cols } = gridSize(grid);
  Object.entries(sheet.cellData ?? {}).forEach(([r, row]) => {
    Object.entries(row).forEach(([c, cell]) => {
      if (!cell || !Object.keys(cell).length) return;
      rows = Math.max(rows, Number(r) + 1);
      cols = Math.max(cols, Number(c) + 1);
    });
  });
  return {
    ...workbook,
    sheets: {
      ...workbook.sheets,
      [sheetId]: {
        ...sheet,
        rowCount: Math.max(rows, 1),
        columnCount: Math.max(cols, 1),
      },
    },
  };
}

/** Width of a column on the first sheet, when it has one set. */
export function columnWidth(
  workbook: WorkbookData,
  column: number,
): number | undefined {
  const sheetId = workbook.sheetOrder?.[0];
  return sheetId
    ? workbook.sheets?.[sheetId]?.columnData?.[column]?.w
    : undefined;
}

/**
 * Width the columns of the first sheet have to take up together to fill a
 * chart `width` pixels wide.
 */
export function fillWidth(workbook: WorkbookData, width: number): number {
  const sheet = workbook.sheets?.[workbook.sheetOrder?.[0] ?? ''];
  const headerWidth = sheet?.rowHeader?.hidden
    ? 0
    : (sheet?.rowHeader?.width ?? ROW_HEADER_WIDTH);
  return width - headerWidth - SCROLLBAR_WIDTH;
}

/** Column index to the width it had before stretching and the width given. */
export type StretchedColumns = Record<number, { base: number; w: number }>;

/**
 * Widens the columns of the first sheet so together they fill `width`
 * pixels, keeping their proportions. Columns that already overflow are left
 * as they are, the sheet scrolls then.
 */
export function stretchColumns(
  workbook: WorkbookData,
  width: number,
): { workbook: WorkbookData; stretched: StretchedColumns } {
  const sheetId = workbook.sheetOrder?.[0];
  const sheet = sheetId ? workbook.sheets?.[sheetId] : undefined;
  const stretched: StretchedColumns = {};
  if (!sheetId || !sheet) return { workbook, stretched };

  const defaultWidth = sheet.defaultColumnWidth ?? DEFAULT_COL_WIDTH;
  const columnData = { ...sheet.columnData };
  const visible: number[] = [];
  let total = 0;
  for (let c = 0; c < (sheet.columnCount ?? 0); c += 1) {
    if (!columnData[c]?.hd) {
      visible.push(c);
      total += columnData[c]?.w ?? defaultWidth;
    }
  }
  const available = Math.floor(fillWidth(workbook, width));
  const scale = available / total;
  if (!visible.length || !(scale > 1)) return { workbook, stretched };

  let left = available;
  visible.forEach((c, i) => {
    const base = columnData[c]?.w ?? defaultWidth;
    // whole pixels, the last column takes what rounding left over so the
    // columns add up to exactly the view
    const w = i === visible.length - 1 ? left : Math.floor(base * scale);
    left -= w;
    stretched[c] = { base, w };
    columnData[c] = { ...columnData[c], w };
  });
  return {
    workbook: {
      ...workbook,
      sheets: { ...workbook.sheets, [sheetId]: { ...sheet, columnData } },
    },
    stretched,
  };
}

/**
 * Undoes `stretchColumns` before saving, so the saved widths don't depend on
 * the size of the view. A column resized by the user keeps its new width.
 */
export function unstretchColumns(
  workbook: WorkbookData,
  stretched: StretchedColumns,
): WorkbookData {
  const sheetId = workbook.sheetOrder?.[0];
  const sheet = sheetId ? workbook.sheets?.[sheetId] : undefined;
  if (!sheetId || !sheet?.columnData) return workbook;

  const columnData = { ...sheet.columnData };
  Object.entries(stretched).forEach(([c, { base, w }]) => {
    const column = columnData[Number(c)];
    if (column?.w === w) columnData[Number(c)] = { ...column, w: base };
  });
  return {
    ...workbook,
    sheets: { ...workbook.sheets, [sheetId]: { ...sheet, columnData } },
  };
}

function fitColumnWidths(grid: Grid): Record<number, { w: number }> {
  const widths: Record<number, { w: number }> = {};
  const sample = grid.slice(0, WIDTH_SAMPLE_ROWS);
  for (let c = 0; c < gridSize(grid).cols; c += 1) {
    const chars = Math.max(...sample.map(row => String(row[c] ?? '').length));
    widths[c] = {
      w: Math.min(
        MAX_COL_WIDTH,
        Math.max(MIN_COL_WIDTH, chars * CHAR_WIDTH + COL_PADDING),
      ),
    };
  }
  return widths;
}

/**
 * Shows the totals and merged values of grouped rows in bold, with merged
 * values at the top of their cell. Cells styled by the user keep their
 * style; cells that were totals before a refresh lose the bold. Modifies
 * the cells of `workbook`, returns it with the style added.
 */
function applyGroupStyles(
  workbook: WorkbookData,
  layout: GridLayout,
): WorkbookData {
  const sheet = firstSheet(workbook);
  if (!sheet) return workbook;
  const cellData = (sheet.cellData ??= {});
  const styled = new Set<string>();
  (layout.subtotalRows ?? []).forEach(r => {
    Object.keys(cellData[r] ?? {}).forEach(c => styled.add(`${r}:${c}`));
  });
  layout.merges
    .filter(merge => merge.startRow >= layout.headerRows)
    .forEach(merge => styled.add(`${merge.startRow}:${merge.startColumn}`));

  Object.keys(cellData).forEach(r => {
    const row = cellData[Number(r)];
    Object.keys(row).forEach(c => {
      if (row[Number(c)].s === SUBTOTAL_STYLE_ID && !styled.has(`${r}:${c}`)) {
        row[Number(c)] = omit(row[Number(c)], 's');
      }
    });
  });
  styled.forEach(key => {
    const [r, c] = key.split(':').map(Number);
    const row = (cellData[r] ??= {});
    if (!row[c]?.s) row[c] = { ...row[c], s: SUBTOTAL_STYLE_ID };
  });
  return styled.size
    ? {
        ...workbook,
        styles: { ...workbook.styles, [SUBTOTAL_STYLE_ID]: SUBTOTAL_STYLE },
      }
    : workbook;
}

export function createWorkbookData(
  grid: Grid,
  layout: GridLayout = DEFAULT_LAYOUT,
): WorkbookData {
  const { rows, cols } = gridSize(grid);
  const workbook = applyGrid(
    {
      id: WORKBOOK_ID,
      name: 'Superset',
      sheetOrder: [SHEET_ID],
      styles: {
        [HEADER_STYLE_ID]: {
          bl: 1,
          bg: {
            // spreadsheet content, not app UI, so it doesn't follow the theme
            // eslint-disable-next-line theme-colors/no-literal-colors
            rgb: '#F2F2F2',
          },
        },
      },
      sheets: {
        [SHEET_ID]: {
          id: SHEET_ID,
          name: 'Data',
          rowCount: rows,
          columnCount: cols,
          defaultColumnWidth: MIN_COL_WIDTH,
          // keep the headers (and pivot row fields) visible while scrolling
          freeze: layoutFreeze(layout),
          columnData: fitColumnWidths(grid),
          mergeData: layout.merges,
          cellData: {},
        },
      },
    },
    grid,
    null,
    layout.headerRows,
  );
  return applyGroupStyles(workbook, layout);
}

/**
 * Removes query values from the data area before saving. They are filled in
 * again from fresh query results when the chart loads, which keeps the saved
 * chart small. Formatting of those cells is kept, and so are headers the user
 * renamed.
 */
export function stripGrid(
  workbook: WorkbookData,
  grid: Grid,
  headerRows = 1,
): WorkbookData {
  const { rows, cols } = gridSize(grid);
  const result = applyGrid(workbook, [], { rows, cols });
  const cells = firstSheet(workbook)?.cellData;
  const cellData = firstSheet(result)?.cellData;
  if (!cells || !cellData) return result;

  for (let r = 0; r < Math.min(headerRows, rows); r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const value = cells[r]?.[c]?.v;
      if (value !== undefined && value !== null && value !== grid[r][c]) {
        cellData[r] = {
          ...cellData[r],
          [c]: { ...cellData[r]?.[c], v: value },
        };
      }
    }
  }
  return result;
}

/** Hides the A, B, C… and 1, 2, 3… headers on every sheet. */
export function hideHeaders(workbook: WorkbookData): WorkbookData {
  const sheets = Object.fromEntries(
    Object.entries(workbook.sheets ?? {}).map(([id, sheet]) => [
      id,
      {
        ...sheet,
        rowHeader: { width: 0, hidden: 1 },
        columnHeader: { height: 0, hidden: 1 },
      },
    ]),
  );
  return { ...workbook, sheets };
}

export function buildWorkbook(
  grid: Grid,
  saved: UniverSavedState | null,
  liveData: boolean,
  layout: GridLayout = DEFAULT_LAYOUT,
): WorkbookData {
  if (!saved) return createWorkbookData(grid, layout);
  // a stripped sheet has no values in the data area, they must come from the query
  if (!liveData && !saved.stripped) {
    return fitSheetSize(cloneDeep(saved.workbook), []);
  }
  // the query's labels go in as is, except where the user renamed a header
  const renamed = firstSheet(saved.workbook)?.cellData;
  const savedHeaders = saved.headerGrid ?? [saved.headers ?? []];
  const headers = grid.slice(0, layout.headerRows).map((row, r) =>
    row.map((label, c) => {
      const value = renamed?.[r]?.[c]?.v;
      return value !== undefined &&
        value !== null &&
        savedHeaders[r]?.[c] === label
        ? value
        : label;
    }),
  );
  const workbook = applyGrid(
    saved.workbook,
    [...headers, ...grid.slice(layout.headerRows)],
    { rows: saved.dataRows, cols: saved.dataCols },
    layout.headerRows,
  );
  applyLayout(workbook, saved.layout ?? DEFAULT_LAYOUT, layout);
  return fitSheetSize(applyGroupStyles(workbook, layout), grid);
}

export function serializeState(
  workbook: WorkbookData,
  grid: Grid,
  liveData: boolean,
  layout: GridLayout = DEFAULT_LAYOUT,
  outline?: { groups: Outline; keyColumns?: number },
): string {
  const { rows, cols } = gridSize(grid);
  const state: UniverSavedState = {
    version: 1,
    dataRows: rows,
    dataCols: cols,
    stripped: liveData,
    headers: grid[0] ?? [],
    headerGrid: grid.slice(0, layout.headerRows),
    layout,
    ...(outline && (outline.groups.rows.length || outline.groups.columns.length)
      ? {
          // without live data the sheet keeps its rows, groups keep theirs
          outline: anchorOutline(
            outline.groups,
            liveData ? grid : [],
            layout.headerRows,
            outline.keyColumns,
          ),
        }
      : {}),
    workbook: liveData
      ? stripGrid(workbook, grid, layout.headerRows)
      : workbook,
  };
  return JSON.stringify(state);
}

/**
 * Hides the rows and columns of collapsed groups. Rows and columns of the
 * query result are shown otherwise: what was hidden there when the chart was
 * saved may be other data after a refresh. Returns a new workbook.
 */
export function applyOutline(
  workbook: WorkbookData,
  outline: Outline,
  grid: Grid,
): WorkbookData {
  const sheetId = workbook.sheetOrder?.[0];
  const sheet = sheetId ? workbook.sheets?.[sheetId] : undefined;
  if (!sheetId || !sheet) return workbook;
  if (!outline.rows.length && !outline.columns.length) return workbook;
  const { rows, cols } = gridSize(grid);

  const hide = <T extends { hd?: number }>(
    data: Record<number, T> | undefined,
    count: number,
    hidden: Set<number>,
  ): Record<number, T> => {
    const result: Record<number, T> = { ...data };
    for (let i = 0; i < count; i += 1) {
      if (result[i]?.hd) result[i] = { ...result[i], hd: 0 };
    }
    hidden.forEach(i => {
      result[i] = { ...result[i], hd: 1 };
    });
    return result;
  };
  return {
    ...workbook,
    sheets: {
      ...workbook.sheets,
      [sheetId]: {
        ...sheet,
        rowData: hide(sheet.rowData, rows, hiddenIndexes(outline.rows)),
        columnData: hide(
          sheet.columnData,
          cols,
          hiddenIndexes(outline.columns),
        ),
      },
    },
  };
}

// Univer's default height of the A, B, C… header
const COLUMN_HEADER_HEIGHT = 20;

/**
 * Sizes the 1, 2, 3… and A, B, C… headers of every sheet: hidden when
 * `labels` is false, plus the margin for the first sheet's groups.
 */
export function sizeHeaders(
  workbook: WorkbookData,
  labels: boolean,
  outline: Outline,
): WorkbookData {
  const rowMargin = outlineMargin(outlineDepth(outline.rows));
  const columnMargin = outlineMargin(outlineDepth(outline.columns));
  const first = workbook.sheetOrder?.[0];
  const sheets = Object.fromEntries(
    Object.entries(workbook.sheets ?? {}).map(([id, sheet]) => {
      const width =
        (labels ? ROW_HEADER_WIDTH : 0) + (id === first ? rowMargin : 0);
      const height = Math.max(
        (labels ? COLUMN_HEADER_HEIGHT : 0) + (id === first ? columnMargin : 0),
        // room for the outline level buttons of the row groups
        id === first && rowMargin ? OUTLINE_LEVEL_SIZE + 2 : 0,
      );
      return [
        id,
        {
          ...sheet,
          rowHeader: { width, hidden: width ? 0 : 1 },
          columnHeader: { height, hidden: height ? 0 : 1 },
        },
      ];
    }),
  );
  return { ...workbook, sheets };
}

/** Label of the row adding up the whole result when rows are grouped */
export const GRAND_TOTAL = 'Grand Total';

function subtotal(rows: Grid, column: number): CellValue | null {
  let sum: number | null = null;
  rows.forEach(row => {
    const value = row[column];
    if (typeof value === 'number') sum = (sum ?? 0) + value;
  });
  // drop floating point noise, as toCellValue does
  return sum === null ? null : Number((sum as number).toPrecision(12));
}

/** Label of a group's total row, in the column after the group's value */
export const SUBTOTALS = 'Subtotals';

/**
 * Groups the data rows by their first `dimensions` columns, like Excel's
 * Data > Subtotal with the totals above: rows with the same value in the
 * first column follow each other (in the order the values first appear),
 * a "Subtotals" row on top adds up the other columns, and the value is merged
 * into one cell down the group; the same again inside for the next columns,
 * except the last. Each group's rows can be collapsed to its total row. With
 * `grandTotal`, a last row adds up everything.
 *
 * A pivot's own Total row (see buildQuery) stays last.
 */
export function groupRows(
  grid: Grid,
  layout: GridLayout,
  dimensions: number,
  grandTotal: boolean,
): { grid: Grid; layout: GridLayout; groups: OutlineGroup[] } {
  const { headerRows } = layout;
  const { cols } = gridSize(grid);
  if (dimensions < 2 || dimensions > cols) return { grid, layout, groups: [] };

  let data = grid.slice(headerRows);
  const last = data[data.length - 1];
  const tail =
    last &&
    last[0] === PIVOT_TOTAL_LABEL &&
    last.slice(1, dimensions).every(value => value === null || value === '')
      ? [last]
      : [];
  if (tail.length) data = data.slice(0, -1);

  const out: Grid = [];
  const merges: MergeRange[] = [];
  const groups: OutlineGroup[] = [];
  const subtotalRows: number[] = [];
  const build = (rows: Grid, level: number) => {
    if (level === dimensions - 1) {
      out.push(...rows);
      return;
    }
    const parts = new Map<string, Grid>();
    rows.forEach(row => {
      const key = String(row[level] ?? '');
      parts.set(key, [...(parts.get(key) ?? []), row]);
    });
    parts.forEach(part => {
      const top = headerRows + out.length;
      subtotalRows.push(top);
      out.push(
        Array.from({ length: cols }, (_, c) => {
          if (c === level) return part[0][level];
          if (c === level + 1) return SUBTOTALS;
          return c < dimensions ? null : subtotal(part, c);
        }),
      );
      build(part, level + 1);
      const end = headerRows + out.length - 1;
      merges.push({
        startRow: top,
        endRow: end,
        startColumn: level,
        endColumn: level,
      });
      groups.push({ start: top + 1, end });
    });
  };
  build(data, 0);

  if (grandTotal && !tail.length) {
    subtotalRows.push(headerRows + out.length);
    out.push(
      Array.from({ length: cols }, (_, c) => {
        if (c === 0) return GRAND_TOTAL;
        return c < dimensions ? null : subtotal(data, c);
      }),
    );
  }
  return {
    grid: [...grid.slice(0, headerRows), ...out, ...tail],
    layout: {
      ...layout,
      merges: [...layout.merges, ...merges],
      subtotalRows,
    },
    groups,
  };
}
