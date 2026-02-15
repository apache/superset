/*
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
import { TableRenderer } from '../../src/react-pivottable/TableRenderers';
import type { PivotData } from '../../src/react-pivottable/utilities';
import { groupingValueSort } from '../../src/react-pivottable/utilities';

let tableRenderer: TableRenderer;
let mockGetAggregatedData: jest.Mock;
let mockSortAndCacheData: jest.Mock;

const columnIndex = 0;
const visibleColKeys = [['col1'], ['col2']];
const pivotData = {
  subtotals: {
    rowEnabled: true,
    rowPartialOnTop: false,
  },
} as any;
const maxRowIndex = 2;

const mockProps = {
  rows: ['row1'],
  cols: ['col1'],
  data: [],
  aggregatorName: 'Sum',
  vals: ['value'],
  valueFilter: {},
  sorters: {},
  rowOrder: 'key_a_to_z',
  colOrder: 'key_a_to_z',
  tableOptions: {},
  namesMapping: {},
  allowRenderHtml: false,
  onContextMenu: jest.fn(),
  aggregatorsFactory: jest.fn(),
  defaultFormatter: jest.fn(),
  customFormatters: {},
  rowEnabled: true,
  rowPartialOnTop: false,
  colEnabled: false,
  colPartialOnTop: false,
};

beforeEach(() => {
  tableRenderer = new TableRenderer(mockProps);

  mockGetAggregatedData = jest.fn();
  mockSortAndCacheData = jest.fn();

  tableRenderer.getAggregatedData = mockGetAggregatedData;
  tableRenderer.sortAndCacheData = mockSortAndCacheData;

  tableRenderer.cachedBasePivotSettings = {
    pivotData: {
      subtotals: {
        rowEnabled: true,
        rowPartialOnTop: false,
        colEnabled: false,
        colPartialOnTop: false,
      },
    },
    rowKeys: [['A'], ['B'], ['C']],
  } as any;

  tableRenderer.state = {
    sortingOrder: [],
    activeSortColumn: null,
    collapsedRows: {},
    collapsedCols: {},
  } as any;
});

const mockGroups = {
  B: {
    currentVal: 20,
    B1: { currentVal: 15 },
    B2: { currentVal: 5 },
  },
  A: {
    currentVal: 10,
    A1: { currentVal: 8 },
    A2: { currentVal: 2 },
  },
  C: {
    currentVal: 30,
    C1: { currentVal: 25 },
    C2: { currentVal: 5 },
  },
};

const createMockPivotData = (rowData: Record<string, number>) =>
  ({
    rowKeys: Object.keys(rowData).map(key => key.split('.')),
    getAggregator: (rowKey: string[], colName: string) => ({
      value: () => rowData[rowKey.join('.')],
    }),
  }) as unknown as PivotData;

test('should set initial ascending sort when no active sort column', () => {
  mockGetAggregatedData.mockReturnValue({
    A: { currentVal: 30 },
    B: { currentVal: 10 },
    C: { currentVal: 20 },
  });

  const setStateMock = jest.fn();
  tableRenderer.setState = setStateMock;

  tableRenderer.sortData(columnIndex, visibleColKeys, pivotData, maxRowIndex);

  expect(setStateMock).toHaveBeenCalled();

  const [stateUpdater] = setStateMock.mock.calls[0];

  expect(typeof stateUpdater).toBe('function');

  const previousState = {
    sortingOrder: [],
    activeSortColumn: 0,
  };

  const newState = stateUpdater(previousState);

  expect(newState.sortingOrder[columnIndex]).toBe('asc');
  expect(newState.activeSortColumn).toBe(columnIndex);

  expect(mockGetAggregatedData).toHaveBeenCalledWith(
    pivotData,
    visibleColKeys[columnIndex],
    false,
  );

  expect(mockSortAndCacheData).toHaveBeenCalledWith(
    { A: { currentVal: 30 }, B: { currentVal: 10 }, C: { currentVal: 20 } },
    'asc',
    true,
    false,
    maxRowIndex,
  );
});

test('should toggle from asc to desc when clicking same column', () => {
  mockGetAggregatedData.mockReturnValue({
    A: { currentVal: 30 },
    B: { currentVal: 10 },
    C: { currentVal: 20 },
  });
  const setStateMock = jest.fn(stateUpdater => {
    if (typeof stateUpdater === 'function') {
      const newState = stateUpdater({
        sortingOrder: ['asc' as never],
        activeSortColumn: 0,
      });

      tableRenderer.state = {
        ...tableRenderer.state,
        ...newState,
      };
    }
  });
  tableRenderer.setState = setStateMock;

  tableRenderer.sortData(columnIndex, visibleColKeys, pivotData, maxRowIndex);

  expect(mockSortAndCacheData).toHaveBeenCalledWith(
    { A: { currentVal: 30 }, B: { currentVal: 10 }, C: { currentVal: 20 } },
    'desc',
    true,
    false,
    maxRowIndex,
  );
});

test('should check second call in sequence', () => {
  mockGetAggregatedData.mockReturnValue({
    A: { currentVal: 30 },
    B: { currentVal: 10 },
    C: { currentVal: 20 },
  });

  mockSortAndCacheData.mockClear();

  const setStateMock = jest.fn(stateUpdater => {
    if (typeof stateUpdater === 'function') {
      const newState = stateUpdater(tableRenderer.state);
      tableRenderer.state = {
        ...tableRenderer.state,
        ...newState,
      };
    }
  });
  tableRenderer.setState = setStateMock;

  tableRenderer.state = {
    sortingOrder: [],
    activeSortColumn: 0,
    collapsedRows: {},
    collapsedCols: {},
  } as any;
  tableRenderer.sortData(columnIndex, visibleColKeys, pivotData, maxRowIndex);

  tableRenderer.state = {
    sortingOrder: ['asc' as never],
    activeSortColumn: 0 as any,
    collapsedRows: {},
    collapsedCols: {},
  } as any;
  tableRenderer.sortData(columnIndex, visibleColKeys, pivotData, maxRowIndex);

  expect(mockSortAndCacheData).toHaveBeenCalledTimes(2);

  expect(mockSortAndCacheData.mock.calls[0]).toEqual([
    { A: { currentVal: 30 }, B: { currentVal: 10 }, C: { currentVal: 20 } },
    'asc',
    true,
    false,
    maxRowIndex,
  ]);

  expect(mockSortAndCacheData.mock.calls[1]).toEqual([
    { A: { currentVal: 30 }, B: { currentVal: 10 }, C: { currentVal: 20 } },
    'desc',
    true,
    false,
    maxRowIndex,
  ]);
});

test('should sort hierarchical data in descending order', () => {
  tableRenderer = new TableRenderer(mockProps);
  const groups = {
    A: {
      currentVal: 30,
      A1: { currentVal: 13 },
      A2: { currentVal: 17 },
    },
    B: {
      currentVal: 10,
      B1: { currentVal: 7 },
      B2: { currentVal: 3 },
    },

    C: {
      currentVal: 18,
      C1: { currentVal: 7 },
      C2: { currentVal: 11 },
    },
  };

  const result = tableRenderer.sortAndCacheData(groups, 'desc', true, false, 2);

  expect(result).toBeDefined();

  expect(Array.isArray(result)).toBe(true);

  expect(result).toEqual([
    ['A', 'A2'],
    ['A', 'A1'],
    ['A'],
    ['C', 'C2'],
    ['C', 'C1'],
    ['C'],
    ['B', 'B1'],
    ['B', 'B2'],
    ['B'],
  ]);
});

test('should sort hierarchical data in ascending order', () => {
  tableRenderer = new TableRenderer(mockProps);
  const groups = {
    A: {
      currentVal: 30,
      A1: { currentVal: 13 },
      A2: { currentVal: 17 },
    },
    B: {
      currentVal: 10,
      B1: { currentVal: 7 },
      B2: { currentVal: 3 },
    },

    C: {
      currentVal: 18,
      C1: { currentVal: 7 },
      C2: { currentVal: 11 },
    },
  };

  const result = tableRenderer.sortAndCacheData(groups, 'asc', true, false, 2);

  expect(result).toBeDefined();

  expect(Array.isArray(result)).toBe(true);

  expect(result).toEqual([
    ['B', 'B2'],
    ['B', 'B1'],
    ['B'],
    ['C', 'C1'],
    ['C', 'C2'],
    ['C'],
    ['A', 'A1'],
    ['A', 'A2'],
    ['A'],
  ]);
});

test('should calculate groups from pivot data', () => {
  tableRenderer = new TableRenderer(mockProps);
  const mockAggregator = (value: number) => ({
    value: () => value,
    format: jest.fn(),
    isSubtotal: false,
  });

  const mockPivotData = {
    rowKeys: [['A'], ['B'], ['C']],
    getAggregator: jest
      .fn()
      .mockReturnValueOnce(mockAggregator(30))
      .mockReturnValueOnce(mockAggregator(10))
      .mockReturnValueOnce(mockAggregator(20)),
  };

  const result = tableRenderer.getAggregatedData(
    mockPivotData as any,
    ['col1'],
    false,
  );

  expect(result).toEqual({
    A: { currentVal: 30 },
    B: { currentVal: 10 },
    C: { currentVal: 20 },
  });
});

test('should sort groups and convert to array in ascending order', () => {
  tableRenderer = new TableRenderer(mockProps);
  const result = tableRenderer.sortAndCacheData(
    mockGroups,
    'asc',
    true,
    false,
    2,
  );

  expect(result).toEqual([
    ['A', 'A2'],
    ['A', 'A1'],
    ['A'],
    ['B', 'B2'],
    ['B', 'B1'],
    ['B'],
    ['C', 'C2'],
    ['C', 'C1'],
    ['C'],
  ]);
});

test('should sort groups and convert to array in descending order', () => {
  tableRenderer = new TableRenderer(mockProps);
  const result = tableRenderer.sortAndCacheData(
    mockGroups,
    'desc',
    true,
    false,
    2,
  );

  expect(result).toEqual([
    ['C', 'C1'],
    ['C', 'C2'],
    ['C'],
    ['B', 'B1'],
    ['B', 'B2'],
    ['B'],
    ['A', 'A1'],
    ['A', 'A2'],
    ['A'],
  ]);
});

test('should handle rowPartialOnTop = true configuration', () => {
  tableRenderer = new TableRenderer(mockProps);
  const result = tableRenderer.sortAndCacheData(
    mockGroups,
    'asc',
    true,
    true,
    2,
  );

  expect(result).toEqual([
    ['A'],
    ['A', 'A2'],
    ['A', 'A1'],
    ['B'],
    ['B', 'B2'],
    ['B', 'B1'],
    ['C'],
    ['C', 'C2'],
    ['C', 'C1'],
  ]);
});

test('should handle rowEnabled = false and rowPartialOnTop = false, sorting asc', () => {
  tableRenderer = new TableRenderer(mockProps);

  const result = tableRenderer.sortAndCacheData(
    mockGroups,
    'asc',
    false,
    false,
    2,
  );

  expect(result).toEqual([
    ['A', 'A2'],
    ['A', 'A1'],
    ['B', 'B2'],
    ['B', 'B1'],
    ['C', 'C2'],
    ['C', 'C1'],
  ]);
});

test('should handle rowEnabled = false and rowPartialOnTop = false , sorting desc', () => {
  tableRenderer = new TableRenderer(mockProps);

  const result = tableRenderer.sortAndCacheData(
    mockGroups,
    'desc',
    false,
    false,
    2,
  );

  expect(result).toEqual([
    ['C', 'C1'],
    ['C', 'C2'],
    ['B', 'B1'],
    ['B', 'B2'],
    ['A', 'A1'],
    ['A', 'A2'],
  ]);
});

test('create hierarchical structure with subtotal at bottom', () => {
  tableRenderer = new TableRenderer(mockProps);
  const rowData = {
    'A.A1': 10,
    'A.A2': 20,
    A: 30,
    'B.B1': 30,
    'B.B2': 40,
    B: 70,
    'C.C1': 50,
    'C.C2': 60,
    C: 110,
  };

  const pivotData = createMockPivotData(rowData);
  const result = tableRenderer.getAggregatedData(pivotData, ['Col1'], false);

  expect(result).toEqual({
    A: {
      A1: { currentVal: 10 },
      A2: { currentVal: 20 },
      currentVal: 30,
    },
    B: {
      B1: { currentVal: 30 },
      B2: { currentVal: 40 },
      currentVal: 70,
    },
    C: {
      C1: { currentVal: 50 },
      C2: { currentVal: 60 },
      currentVal: 110,
    },
  });
});

test('create hierarchical structure with subtotal at top', () => {
  tableRenderer = new TableRenderer(mockProps);
  const rowData = {
    A: 30,
    'A.A1': 10,
    'A.A2': 20,
    B: 70,
    'B.B1': 30,
    'B.B2': 40,
    C: 110,
    'C.C1': 50,
    'C.C2': 60,
  };

  const pivotData = createMockPivotData(rowData);
  const result = tableRenderer.getAggregatedData(pivotData, ['Col1'], true);

  expect(result).toEqual({
    A: {
      A1: { currentVal: 10 },
      A2: { currentVal: 20 },
      currentVal: 30,
    },
    B: {
      B1: { currentVal: 30 },
      B2: { currentVal: 40 },
      currentVal: 70,
    },
    C: {
      C1: { currentVal: 50 },
      C2: { currentVal: 60 },
      currentVal: 110,
    },
  });
});

test('values ​​from the 3rd level of the hierarchy with a subtotal at the bottom', () => {
  tableRenderer = new TableRenderer(mockProps);
  const rowData = {
    'A.A1.A11': 10,
    'A.A1.A12': 20,
    'A.A1': 30,
    'A.A2': 30,
    'A.A3': 50,
    A: 110,
  };

  const pivotData = createMockPivotData(rowData);
  const result = tableRenderer.getAggregatedData(pivotData, ['Col1'], false);

  expect(result).toEqual({
    A: {
      A1: {
        A11: { currentVal: 10 },
        A12: { currentVal: 20 },
        currentVal: 30,
      },
      A2: { currentVal: 30 },
      A3: { currentVal: 50 },
      currentVal: 110,
    },
  });
});

test('values ​​from the 3rd level of the hierarchy with a subtotal at the top', () => {
  tableRenderer = new TableRenderer(mockProps);
  const rowData = {
    A: 110,
    'A.A1': 30,
    'A.A1.A11': 10,
    'A.A1.A12': 20,
    'A.A2': 30,
    'A.A3': 50,
  };

  const pivotData = createMockPivotData(rowData);
  const result = tableRenderer.getAggregatedData(pivotData, ['Col1'], true);

  expect(result).toEqual({
    A: {
      A1: {
        A11: { currentVal: 10 },
        A12: { currentVal: 20 },
        currentVal: 30,
      },
      A2: { currentVal: 30 },
      A3: { currentVal: 50 },
      currentVal: 110,
    },
  });
});

type TestData = {
  [key: string]: number | string | null;
};

const createMockAggregator = (data: TestData) => (key: string[], _context: never[]): unknown => {
    const keyStr = key.join('|');
    return data[keyStr] ?? null;
  };

test('should sort flat keys in ascending order', () => {
  const keys: string[][] = [['A'], ['C'], ['B']];
  const data = {
    A: 30,
    B: 10,
    C: 20,
  };

  groupingValueSort(keys, createMockAggregator(data), false, true);

  expect(keys).toEqual([['B'], ['C'], ['A']]);
});

test('should sort flat keys in descending order', () => {
  const keys: string[][] = [['A'], ['C'], ['B']];
  const data = {
    A: 30,
    B: 10,
    C: 20,
  };

  groupingValueSort(keys, createMockAggregator(data), false, false);

  expect(keys).toEqual([['A'], ['C'], ['B']]);
});

test('should place subtotal at top when top=true and ascending', () => {
  const keys: string[][] = [
    ['Region', 'City1'],
    ['Region'],
    ['Region', 'City2'],
  ];
  const data = {
    'Region|City1': 100,
    'Region|City2': 50,
  };

  groupingValueSort(keys, createMockAggregator(data), true, true);

  expect(keys[0]).toEqual(['Region']);
  expect(keys[1]).toEqual(['Region', 'City2']);
  expect(keys[2]).toEqual(['Region', 'City1']);
});

test('should place subtotal at bottom when top=false and descending', () => {
  const keys: string[][] = [
    ['Region', 'City1'],
    ['Region'],
    ['Region', 'City2'],
  ];
  const data = {
    'Region|City1': 100,
    'Region|City2': 50,
  };

  groupingValueSort(keys, createMockAggregator(data), false, false);

  expect(keys[0]).toEqual(['Region', 'City1']);
  expect(keys[1]).toEqual(['Region', 'City2']);
  expect(keys[2]).toEqual(['Region']);
});

test('should use alphabetical order for terminals with equal values', () => {
  const keys: string[][] = [
    ['Group', 'Apple'],
    ['Group', 'Banana'],
    ['Group', 'Cherry'],
  ];
  const data = {
    'Group|Apple': 50,
    'Group|Banana': 50,
    'Group|Cherry': 50,
  };

  groupingValueSort(keys, createMockAggregator(data), false, true);

  expect(keys).toEqual([
    ['Group', 'Apple'],
    ['Group', 'Banana'],
    ['Group', 'Cherry'],
  ]);
});

test('should handle null values gracefully', () => {
  const keys: string[][] = [['A'], ['B'], ['C']];
  const data = {
    A: 100,
    B: null,
    C: 50,
  };

  groupingValueSort(keys, createMockAggregator(data), false, true);
  expect(keys).toEqual([['B'], ['C'], ['A']]);
});

test('should handle string numbers', () => {
  const keys: string[][] = [['A'], ['B'], ['C']];
  const data = {
    A: '100',
    B: '50',
    C: '200',
  };

  groupingValueSort(keys, createMockAggregator(data), false, false);
  expect(keys).toEqual([['C'], ['A'], ['B']]);
});

test('should handle NaN values', () => {
  const keys: string[][] = [['A'], ['B'], ['C']];
  const data = {
    A: 100,
    B: NaN,
    C: 50,
  };

  groupingValueSort(keys, createMockAggregator(data), false, true);
  expect(keys).toEqual([['B'], ['C'], ['A']]);
});

test('should handle single key', () => {
  const keys: string[][] = [['OnlyKey']];
  const data = { OnlyKey: 42 };

  groupingValueSort(keys, createMockAggregator(data), false, true);
  expect(keys).toEqual([['OnlyKey']]);
});

test('should handle empty keys array', () => {
  const keys: string[][] = [];
  const data = {};

  groupingValueSort(keys, createMockAggregator(data), false, true);
  expect(keys).toEqual([]);
});

test('should handle product categories with subcategories', () => {
  const keys: string[][] = [
    ['Electronics'],
    ['Electronics', 'Phones'],
    ['Electronics', 'Phones', 'iPhone'],
    ['Electronics', 'Phones', 'Samsung'],
    ['Electronics', 'Laptops'],
    ['Electronics', 'Laptops', 'MacBook'],
    ['Clothing'],
    ['Clothing', 'Shirts'],
    ['Clothing', 'Shirts', 'T-Shirt'],
    ['Clothing', 'Pants'],
    ['Clothing', 'Pants', 'Jeans'],
  ];
  const data = {
    'Electronics|Phones|iPhone': 500,
    'Electronics|Phones|Samsung': 400,
    'Electronics|Laptops|MacBook': 1200,
    'Clothing|Shirts|T-Shirt': 200,
    'Clothing|Pants|Jeans': 150,
  };

  groupingValueSort(keys, createMockAggregator(data), true, true);

  expect(keys[0]).toEqual(['Clothing']);
  expect(keys[1]).toEqual(['Clothing', 'Pants']);
  expect(keys[2]).toEqual(['Clothing', 'Pants', 'Jeans']);
  expect(keys[3]).toEqual(['Clothing', 'Shirts']);
  expect(keys[4]).toEqual(['Clothing', 'Shirts', 'T-Shirt']);
  expect(keys[5]).toEqual(['Electronics']);
  expect(keys[6]).toEqual(['Electronics', 'Phones']);
  expect(keys[7]).toEqual(['Electronics', 'Phones', 'Samsung']);
  expect(keys[8]).toEqual(['Electronics', 'Phones', 'iPhone']);
  expect(keys[9]).toEqual(['Electronics', 'Laptops']);
  expect(keys[10]).toEqual(['Electronics', 'Laptops', 'MacBook']);
});
