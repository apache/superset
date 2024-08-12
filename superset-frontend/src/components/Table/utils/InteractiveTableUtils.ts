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
import type { ColumnsType } from 'antd/es/table';
import { SUPERSET_TABLE_COLUMN } from 'src/components/Table';
import { withinRange } from './utils';

interface IInteractiveColumn extends HTMLElement {
  mouseDown: boolean;
  oldX: number;
  oldWidth: number;
  draggable: boolean;
}
export default class InteractiveTableUtils {
  tableRef: HTMLTableElement | null;

  columnRef: IInteractiveColumn | null;

  setDerivedColumns: Function;

  isDragging: boolean;

  resizable: boolean;

  reorderable: boolean;

  derivedColumns: ColumnsType<any>;

  RESIZE_INDICATOR_THRESHOLD: number;

  constructor(
    tableRef: HTMLTableElement,
    derivedColumns: ColumnsType<any>,
    setDerivedColumns: Function,
  ) {
    this.setDerivedColumns = setDerivedColumns;
    this.tableRef = tableRef;
    this.isDragging = false;
    this.RESIZE_INDICATOR_THRESHOLD = 8;
    this.resizable = false;
    this.reorderable = false;
    this.derivedColumns = [...derivedColumns];
    document.addEventListener('mouseup', this.handleMouseup);
  }

  clearListeners = () => {
    document.removeEventListener('mouseup', this.handleMouseup);
    this.initializeResizableColumns(false, this.tableRef);
    this.initializeDragDropColumns(false, this.tableRef);
  };

  setTableRef = (table: HTMLTableElement) => {
    this.tableRef = table;
  };

  getColumnIndex = (): number => {
    let index = -1;
    const parent = this.columnRef?.parentNode;
    if (parent) {
      index = Array.prototype.indexOf.call(parent.children, this.columnRef);
    }
    return index;
  };

  handleColumnDragStart = (ev: DragEvent): void => {
    const target = ev?.currentTarget as IInteractiveColumn;
    if (target) {
      this.columnRef = target;
    }
    this.isDragging = true;
    const index = this.getColumnIndex();
    const columnData = this.derivedColumns[index];
    const dragData = { index, columnData };
    ev?.dataTransfer?.setData(SUPERSET_TABLE_COLUMN, JSON.stringify(dragData));
  };

  handleDragDrop = (ev: DragEvent): void => {
    const data = ev.dataTransfer?.getData?.(SUPERSET_TABLE_COLUMN);
    if (data) {
      ev.preventDefault();
      const parent = (ev.currentTarget as HTMLElement)
        ?.parentNode as HTMLElement;
      const dropIndex = Array.prototype.indexOf.call(
        parent.children,
        ev.currentTarget,
      );
      const dragIndex = this.getColumnIndex();
      const columnsCopy = [...this.derivedColumns];
      const removedItem = columnsCopy.slice(dragIndex, dragIndex + 1);
      columnsCopy.splice(dragIndex, 1);
      columnsCopy.splice(dropIndex, 0, removedItem[0]);
      this.derivedColumns = [...columnsCopy];
      this.setDerivedColumns(columnsCopy);
    }
  };

  allowDrop = (ev: DragEvent): void => {
    ev.preventDefault();
  };

  handleMouseDown = (event: MouseEvent) => {
    const target = event?.currentTarget as IInteractiveColumn;
    if (target) {
      this.columnRef = target;
      if (
        event &&
        withinRange(
          event.offsetX,
          target.offsetWidth,
          this.RESIZE_INDICATOR_THRESHOLD,
        )
      ) {
        target.mouseDown = true;
        target.oldX = event.x;
        target.oldWidth = target.offsetWidth;
        target.draggable = false;
      } else if (this.reorderable) {
        target.draggable = true;
      }
    }
  };

  handleMouseMove = (event: MouseEvent) => {
    if (this.resizable === true && !this.isDragging) {
      const target = event.currentTarget as IInteractiveColumn;
      if (
        event &&
        withinRange(
          event.offsetX,
          target.offsetWidth,
          this.RESIZE_INDICATOR_THRESHOLD,
        )
      ) {
        target.style.cursor = 'col-resize';
      } else {
        target.style.cursor = 'default';
      }

      const column = this.columnRef;
      if (column?.mouseDown) {
        let width = column.oldWidth;
        const diff = event.x - column.oldX;
        if (column.oldWidth + (event.x - column.oldX) > 0) {
          width = column.oldWidth + diff;
        }
        const colIndex = this.getColumnIndex();
        if (!Number.isNaN(colIndex)) {
          const columnDef = { ...this.derivedColumns[colIndex] };
          columnDef.width = width;
          this.derivedColumns[colIndex] = columnDef;
          this.setDerivedColumns([...this.derivedColumns]);
        }
      }
    }
  };

  handleMouseup = () => {
    if (this.columnRef) {
      this.columnRef.mouseDown = false;
      this.columnRef.style.cursor = 'default';
      this.columnRef.draggable = false;
    }
    this.isDragging = false;
  };

  initializeResizableColumns = (
    resizable = false,
    table: HTMLTableElement | null,
  ) => {
    this.tableRef = table;
    const header: HTMLTableRowElement | undefined = this.tableRef?.rows?.[0];
    if (header) {
      const { cells } = header;
      const len = cells.length;
      for (let i = 0; i < len; i += 1) {
        const cell = cells[i];
        if (resizable === true) {
          this.resizable = true;
          cell.addEventListener('mousedown', this.handleMouseDown);
          cell.addEventListener('mousemove', this.handleMouseMove, true);
        } else {
          this.resizable = false;
          cell.removeEventListener('mousedown', this.handleMouseDown);
          cell.removeEventListener('mousemove', this.handleMouseMove, true);
        }
      }
    }
  };

  initializeDragDropColumns = (
    reorderable = false,
    table: HTMLTableElement | null,
  ) => {
    this.tableRef = table;
    const header: HTMLTableRowElement | undefined = this.tableRef?.rows?.[0];
    if (header) {
      const { cells } = header;
      const len = cells.length;
      for (let i = 0; i < len; i += 1) {
        const cell = cells[i];
        if (reorderable === true) {
          this.reorderable = true;
          cell.addEventListener('mousedown', this.handleMouseDown);
          cell.addEventListener('dragover', this.allowDrop);
          cell.addEventListener('dragstart', this.handleColumnDragStart);
          cell.addEventListener('drop', this.handleDragDrop);
        } else {
          this.reorderable = false;
          cell.draggable = false;
          cell.removeEventListener('mousedown', this.handleMouseDown);
          cell.removeEventListener('dragover', this.allowDrop);
          cell.removeEventListener('dragstart', this.handleColumnDragStart);
          cell.removeEventListener('drop', this.handleDragDrop);
        }
      }
    }
  };
}
