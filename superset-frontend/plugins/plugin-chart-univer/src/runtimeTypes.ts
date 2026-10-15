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

import type { Outline } from './utils/outline';

/**
 * Types shared by the chart and the code that drives Univer
 * (univer/mountUniver.ts). They describe the parts of Univer's workbook
 * format that the chart reads and writes, so the chart's pure logic doesn't
 * depend on Univer's own types.
 */

export type CellValue = string | number | boolean;

/** Univer `ICellData` */
export interface CellData {
  /** value */
  v?: CellValue | null;
  /** style id or inline style */
  s?: string | Record<string, unknown> | null;
  /** formula */
  f?: string | null;
  /** shared formula id */
  si?: string | null;
  /** value type */
  t?: number | null;
  /** rich text */
  p?: unknown;
  [key: string]: unknown;
}

/** Univer `IRange`, a block of merged cells */
export interface MergeRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

/** Univer `IWorksheetData` */
export interface SheetData {
  id?: string;
  name?: string;
  rowCount?: number;
  columnCount?: number;
  freeze?: {
    xSplit: number;
    ySplit: number;
    startRow: number;
    startColumn: number;
  };
  cellData?: Record<number, Record<number, CellData>>;
  mergeData?: MergeRange[];
  defaultColumnWidth?: number;
  columnData?: Record<number, { w?: number; hd?: number }>;
  rowData?: Record<number, { h?: number; hd?: number }>;
  rowHeader?: { width: number; hidden?: number };
  columnHeader?: { height: number; hidden?: number };
  [key: string]: unknown;
}

/** Univer `IWorkbookData` */
export interface WorkbookData {
  id?: string;
  name?: string;
  sheetOrder?: string[];
  styles?: Record<string, unknown>;
  sheets?: Record<string, SheetData>;
  [key: string]: unknown;
}

export interface MountUniverOptions {
  container: HTMLElement;
  workbook: WorkbookData;
  /** false hides toolbars, formula bar, sheet tabs and blocks edits */
  editable: boolean;
  /** called after every change to the document (not selection or scroll) */
  onChange?: () => void;
  /**
   * Width in pixels the columns of the sheet should take up together. When
   * set, the column menu gets a "Fill the window" item while they take up less.
   */
  getFillWidth?: () => number;
  /** collapsible row and column groups, see src/utils/outline.ts */
  outline?: Outline;
  /** called when the user groups, ungroups, collapses or expands */
  onOutlineChange?: (outline: Outline) => void;
  /**
   * false when the 1, 2, 3… and A, B, C… headers are hidden; the headers
   * then only show the margin for the groups, if there are any
   */
  headerLabels?: boolean;
  /** the total rows of row groups are above them (automatic grouping) */
  outlineSummaryAbove?: boolean;
}

export interface UniverHandle {
  save: () => WorkbookData;
  /** column index to width in pixels, on the first sheet */
  setColumnWidths: (widths: Record<number, number>) => void;
  dispose: () => void;
}

export type MountUniver = (options: MountUniverOptions) => UniverHandle;
