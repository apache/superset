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

import { SUPERSET_TABLE_COLUMN } from '..';
import InteractiveTableUtils from './InteractiveTableUtils';

const mockColumns = [
  { key: 'name', dataIndex: 'name', title: 'Name' },
  { key: 'age', dataIndex: 'age', title: 'Age' },
];

const createMockTable = (numCols = 2): HTMLTableElement => {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  for (let i = 0; i < numCols; i += 1) {
    const th = document.createElement('th');
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  table.appendChild(thead);
  document.body.appendChild(table);
  return table;
};

afterEach(() => {
  document.body.innerHTML = '';
});

test('constructor initializes with correct defaults', () => {
  const table = createMockTable();
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );

  expect(utils.tableRef).toBe(table);
  expect(utils.isDragging).toBe(false);
  expect(utils.resizable).toBe(false);
  expect(utils.reorderable).toBe(false);
  expect(utils.derivedColumns).toEqual(mockColumns);
  expect(utils.RESIZE_INDICATOR_THRESHOLD).toBe(8);
});

test('setTableRef updates tableRef', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const newTable = createMockTable();
  utils.setTableRef(newTable);
  expect(utils.tableRef).toBe(newTable);
});

test('getColumnIndex returns -1 when columnRef has no parent', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.columnRef = null;
  expect(utils.getColumnIndex()).toBe(-1);
});

test('getColumnIndex returns correct index when columnRef is in a row', () => {
  const table = createMockTable(3);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const row = table.rows[0];
  utils.columnRef = row.cells[1] as unknown as typeof utils.columnRef;
  expect(utils.getColumnIndex()).toBe(1);
});

test('allowDrop calls preventDefault on the event', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const event = { preventDefault: jest.fn() } as unknown as DragEvent;
  utils.allowDrop(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
});

test('handleMouseup clears mouseDown and resets dragging state', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const th = document.createElement('th') as unknown as typeof utils.columnRef;
  utils.columnRef = th;
  (th as any).mouseDown = true;
  utils.isDragging = true;

  utils.handleMouseup();

  expect((th as any).mouseDown).toBe(false);
  expect(utils.isDragging).toBe(false);
});

test('handleMouseup works when columnRef is null', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.columnRef = null;
  utils.isDragging = true;

  utils.handleMouseup();

  expect(utils.isDragging).toBe(false);
});

test('handleMouseDown sets mouseDown and oldX when within resize range', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });

  const event = {
    currentTarget: target,
    offsetX: 95, // 100 - 95 = 5, within threshold of 8
    x: 95,
  } as unknown as MouseEvent;

  utils.handleMouseDown(event);

  expect(target.mouseDown).toBe(true);
  expect(target.oldX).toBe(95);
  expect(target.oldWidth).toBe(100);
  expect(target.draggable).toBe(false);
});

test('handleMouseDown sets draggable when outside resize range and reorderable', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.reorderable = true;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });

  const event = {
    currentTarget: target,
    offsetX: 50, // 100 - 50 = 50, outside threshold of 8
    x: 50,
  } as unknown as MouseEvent;

  utils.handleMouseDown(event);

  expect(target.draggable).toBe(true);
});

test('initializeResizableColumns adds event listeners when resizable is true', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const cell = table.rows[0].cells[0];
  const addEventSpy = jest.spyOn(cell, 'addEventListener');

  utils.initializeResizableColumns(true, table);

  expect(utils.resizable).toBe(true);
  expect(addEventSpy).toHaveBeenCalledWith('mousedown', utils.handleMouseDown);
  expect(addEventSpy).toHaveBeenCalledWith(
    'mousemove',
    utils.handleMouseMove,
    true,
  );
});

test('initializeResizableColumns removes event listeners when resizable is false', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const cell = table.rows[0].cells[0];
  const removeEventSpy = jest.spyOn(cell, 'removeEventListener');

  utils.initializeResizableColumns(false, table);

  expect(utils.resizable).toBe(false);
  expect(removeEventSpy).toHaveBeenCalledWith(
    'mousedown',
    utils.handleMouseDown,
  );
  expect(removeEventSpy).toHaveBeenCalledWith(
    'mousemove',
    utils.handleMouseMove,
    true,
  );
});

test('initializeDragDropColumns adds event listeners when reorderable is true', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const cell = table.rows[0].cells[0];
  const addEventSpy = jest.spyOn(cell, 'addEventListener');

  utils.initializeDragDropColumns(true, table);

  expect(utils.reorderable).toBe(true);
  expect(addEventSpy).toHaveBeenCalledWith(
    'dragstart',
    utils.handleColumnDragStart,
  );
  expect(addEventSpy).toHaveBeenCalledWith('drop', utils.handleDragDrop);
});

test('initializeDragDropColumns removes event listeners when reorderable is false', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const cell = table.rows[0].cells[0];
  const removeEventSpy = jest.spyOn(cell, 'removeEventListener');

  utils.initializeDragDropColumns(false, table);

  expect(utils.reorderable).toBe(false);
  expect(removeEventSpy).toHaveBeenCalledWith(
    'dragstart',
    utils.handleColumnDragStart,
  );
  expect(removeEventSpy).toHaveBeenCalledWith('drop', utils.handleDragDrop);
});

test('handleColumnDragStart sets isDragging and calls setData', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  const row = table.rows[0];
  const target = row.cells[0] as any;
  const setDataMock = jest.fn();
  const event = {
    currentTarget: target,
    dataTransfer: { setData: setDataMock },
  } as unknown as DragEvent;

  utils.handleColumnDragStart(event);

  expect(utils.isDragging).toBe(true);
  expect(setDataMock).toHaveBeenCalledWith(
    SUPERSET_TABLE_COLUMN,
    expect.any(String),
  );
});

test('handleDragDrop reorders columns when valid drag data exists', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );

  const row = table.rows[0];
  // Set columnRef to first column (drag source)
  utils.columnRef = row.cells[0] as unknown as typeof utils.columnRef;

  const dragData = JSON.stringify({ index: 0, columnData: mockColumns[0] });
  const dropTarget = row.cells[1];
  const event = {
    currentTarget: dropTarget,
    dataTransfer: { getData: jest.fn().mockReturnValue(dragData) },
    preventDefault: jest.fn(),
  } as unknown as DragEvent;

  utils.handleDragDrop(event);

  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(setDerivedColumns).toHaveBeenCalledTimes(1);
});

test('handleDragDrop does nothing when no drag data', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );

  const row = table.rows[0];
  const event = {
    currentTarget: row.cells[0],
    dataTransfer: { getData: jest.fn().mockReturnValue('') },
    preventDefault: jest.fn(),
  } as unknown as DragEvent;

  utils.handleDragDrop(event);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(setDerivedColumns).not.toHaveBeenCalled();
});

test('handleMouseMove updates cursor to col-resize when within resize range', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.resizable = true;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });
  target.style = { cursor: '' };

  const event = {
    currentTarget: target,
    offsetX: 95,
    x: 0,
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(target.style.cursor).toBe('col-resize');
});

test('handleMouseMove sets default cursor when outside resize range', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.resizable = true;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });
  target.style = { cursor: '' };

  const event = {
    currentTarget: target,
    offsetX: 50,
    x: 0,
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(target.style.cursor).toBe('default');
});

test('handleMouseMove resizes column when mouseDown and within bounds', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );
  utils.resizable = true;

  const row = table.rows[0];
  const col = row.cells[0] as any;
  col.mouseDown = true;
  col.oldWidth = 100;
  col.oldX = 50;
  utils.columnRef = col;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });
  target.style = { cursor: '' };

  const event = {
    currentTarget: target,
    offsetX: 50,
    x: 70, // diff = 70 - 50 = 20, width = 100 + 20 = 120
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(setDerivedColumns).toHaveBeenCalledTimes(1);
  expect(utils.derivedColumns[0].width).toBe(120);
});

test('handleMouseMove skips resize when not resizable', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );
  utils.resizable = false;

  const target = document.createElement('th') as any;
  const event = {
    currentTarget: target,
    offsetX: 50,
    x: 70,
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(setDerivedColumns).not.toHaveBeenCalled();
});

test('handleMouseMove handles negative diff by keeping original width', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );
  utils.resizable = true;

  const row = table.rows[0];
  const col = row.cells[0] as any;
  col.mouseDown = true;
  col.oldWidth = 50;
  col.oldX = 200;
  utils.columnRef = col;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 50,
    configurable: true,
  });
  target.style = { cursor: '' };

  const event = {
    currentTarget: target,
    offsetX: 45,
    x: 0, // diff = 0 - 200 = -200, width would be 50 + (-200) = -150 < 0 → keep 50
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(setDerivedColumns).toHaveBeenCalledTimes(1);
  expect(utils.derivedColumns[0].width).toBe(50); // unchanged because negative would result
});

test('handleColumnDragStart does not set columnRef when currentTarget is null (line 82 false)', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  const event = {
    currentTarget: null,
    dataTransfer: { setData: jest.fn() },
  } as unknown as DragEvent;

  utils.handleColumnDragStart(event);

  expect(utils.isDragging).toBe(true);
  expect(utils.columnRef).toBeFalsy();
});

test('handleMouseDown does nothing when currentTarget is null (line 118 false)', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  const event = {
    currentTarget: null,
    offsetX: 50,
    x: 50,
  } as unknown as MouseEvent;

  utils.handleMouseDown(event);

  expect(utils.columnRef).toBeFalsy();
});

test('handleMouseDown does nothing to draggable when outside resize range and not reorderable (line 132 false)', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  utils.reorderable = false;

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });

  const event = {
    currentTarget: target,
    offsetX: 50, // 100 - 50 = 50, outside threshold of 8
    x: 50,
  } as unknown as MouseEvent;

  utils.handleMouseDown(event);

  expect(target.draggable).toBe(false);
});

test('handleMouseMove skips column update when getColumnIndex returns NaN (line 162 false)', () => {
  const table = createMockTable(2);
  const setDerivedColumns = jest.fn();
  const utils = new InteractiveTableUtils(
    table,
    mockColumns,
    setDerivedColumns,
  );
  utils.resizable = true;

  const row = table.rows[0];
  const col = row.cells[0] as any;
  col.mouseDown = true;
  col.oldWidth = 100;
  col.oldX = 50;
  utils.columnRef = col;

  jest.spyOn(utils, 'getColumnIndex').mockReturnValueOnce(NaN);

  const target = document.createElement('th') as any;
  Object.defineProperty(target, 'offsetWidth', {
    value: 100,
    configurable: true,
  });
  target.style = { cursor: '' };

  const event = {
    currentTarget: target,
    offsetX: 50,
    x: 70,
  } as unknown as MouseEvent;

  utils.handleMouseMove(event);

  expect(setDerivedColumns).not.toHaveBeenCalled();
});

test('initializeResizableColumns does nothing when table is null (lines 182-187 false)', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  expect(() => utils.initializeResizableColumns(true, null)).not.toThrow();
  expect(utils.tableRef).toBeNull();
});

test('initializeResizableColumns uses default resizable=false when first arg is undefined (line 182 default branch)', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  utils.initializeResizableColumns(undefined, table);

  expect(utils.resizable).toBe(false);
});

test('initializeDragDropColumns does nothing when table is null (lines 206-211 false)', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  expect(() => utils.initializeDragDropColumns(true, null)).not.toThrow();
  expect(utils.tableRef).toBeNull();
});

test('initializeDragDropColumns uses default reorderable=false when first arg is undefined (line 206 default branch)', () => {
  const table = createMockTable(2);
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());

  utils.initializeDragDropColumns(undefined, table);

  expect(utils.reorderable).toBe(false);
});

test('clearListeners removes document mouseup listener', () => {
  const table = createMockTable();
  const utils = new InteractiveTableUtils(table, mockColumns, jest.fn());
  const removeEventSpy = jest.spyOn(document, 'removeEventListener');

  utils.clearListeners();

  expect(removeEventSpy).toHaveBeenCalledWith('mouseup', utils.handleMouseup);
});
