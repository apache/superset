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

import { groupingValueSort } from '../../src/react-pivottable/utilities';

import type { ReactElement } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { TableRenderer } from '../../src/react-pivottable/TableRenderers';
import { aggregatorTemplates } from '../../src/react-pivottable/utilities';

jest.mock(
  'react-icons/fa',
  () => ({
    FaSort: () => <span data-testid="sort-icon" />,
    FaSortDown: () => <span data-testid="sort-desc-icon" />,
    FaSortUp: () => <span data-testid="sort-asc-icon" />,
  }),
  { virtual: true },
);

/**
 * A minimal aggregatorsFactory that mirrors the production one.
 * PivotData's constructor calls `aggregatorsFactory(defaultFormatter)`
 * to obtain a map of aggregator constructors keyed by name.
 * The `formatter` argument is ignored here because the tests only
 * care about rendering output, not number formatting precision.
 */
const aggregatorsFactory = () => ({
  Count: aggregatorTemplates.count(),
  Sum: aggregatorTemplates.sum(),
});

const SAMPLE_DATA = [
  { color: 'blue', shape: 'circle', value: 10 },
  { color: 'blue', shape: 'square', value: 20 },
  { color: 'red', shape: 'circle', value: 30 },
  { color: 'red', shape: 'square', value: 40 },
];

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={supersetTheme}>{ui}</ThemeProvider>);
}

function buildDefaultProps(overrides: Record<string, unknown> = {}) {
  return {
    data: SAMPLE_DATA,
    rows: ['color'] as string[],
    cols: ['shape'] as string[],
    aggregatorName: 'Count',
    vals: [] as string[],
    aggregatorsFactory,
    tableOptions: {},
    onContextMenu: jest.fn(),
    ...overrides,
  };
}

test('TableRenderer renders a table element with the pvtTable class', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();
  expect(table).toHaveClass('pvtTable');
});

test('TableRenderer renders column headers from pivot data', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  // The column attribute values ("circle" and "square") should appear as
  // column headers in the rendered table.
  expect(screen.getByText('circle')).toBeInTheDocument();
  expect(screen.getByText('square')).toBeInTheDocument();
});

test('TableRenderer renders row headers from pivot data', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  // The row attribute values ("blue" and "red") should appear as
  // row headers in the rendered table.
  expect(screen.getByText('blue')).toBeInTheDocument();
  expect(screen.getByText('red')).toBeInTheDocument();
});

test('TableRenderer renders aggregated cell values', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  // With "Count" aggregator, each cell (row x col intersection) should
  // contain "1" because each combination appears exactly once.
  const cells = screen.getAllByRole('gridcell');
  const cellTexts = cells.map(cell => cell.textContent);

  // There should be cell values of "1" for each of the four intersections
  // (blue+circle, blue+square, red+circle, red+square).
  const onesCount = cellTexts.filter(text => text === '1').length;
  expect(onesCount).toBeGreaterThanOrEqual(4);
});

test('TableRenderer renders row totals when rowTotals is enabled', () => {
  const props = buildDefaultProps({
    tableOptions: { rowTotals: true, colTotals: true },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // Row totals column should show "2" for each color (blue has 2 records,
  // red has 2 records).
  const totalCells = screen
    .getAllByRole('gridcell')
    .filter(cell => cell.classList.contains('pvtTotal'));
  expect(totalCells.length).toBeGreaterThan(0);

  const totalValues = totalCells.map(cell => cell.textContent);
  expect(totalValues).toContain('2');
});

test('TableRenderer renders col totals row when colTotals is enabled', () => {
  const props = buildDefaultProps({
    tableOptions: { rowTotals: true, colTotals: true },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // The totals row should have cells with class pvtRowTotal.
  const rowTotalCells = screen
    .getAllByRole('gridcell')
    .filter(cell => cell.classList.contains('pvtRowTotal'));
  expect(rowTotalCells.length).toBeGreaterThan(0);
});

test('TableRenderer renders grand total when both totals are enabled', () => {
  const props = buildDefaultProps({
    tableOptions: { rowTotals: true, colTotals: true },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // The grand total cell should show "4" (total record count).
  const grandTotalCells = screen
    .getAllByRole('gridcell')
    .filter(cell => cell.classList.contains('pvtGrandTotal'));
  expect(grandTotalCells.length).toBe(1);
  expect(grandTotalCells[0]).toHaveTextContent('4');
});

test('TableRenderer handles empty data gracefully', () => {
  const props = buildDefaultProps({ data: [] });
  renderWithTheme(<TableRenderer {...props} />);

  // The table should still render without crashing, just with no data rows.
  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();

  // With empty data, there are no regular value cells (pvtVal).
  const valueCells = document.querySelectorAll('.pvtVal');
  expect(valueCells).toHaveLength(0);

  // No row headers should be present.
  const rowLabels = document.querySelectorAll('.pvtRowLabel');
  expect(rowLabels).toHaveLength(0);
});

test('TableRenderer handles data with no rows dimension', () => {
  const props = buildDefaultProps({
    rows: [],
    cols: ['color'],
  });
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();

  // Column headers should still render.
  expect(screen.getByText('blue')).toBeInTheDocument();
  expect(screen.getByText('red')).toBeInTheDocument();
});

test('TableRenderer handles data with no cols dimension', () => {
  const props = buildDefaultProps({
    rows: ['color'],
    cols: [],
  });
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();

  // Row headers should still render.
  expect(screen.getByText('blue')).toBeInTheDocument();
  expect(screen.getByText('red')).toBeInTheDocument();
});

test('TableRenderer renders with Sum aggregator', () => {
  const props = buildDefaultProps({
    aggregatorName: 'Sum',
    vals: ['value'],
  });
  renderWithTheme(<TableRenderer {...props} />);

  const cells = screen.getAllByRole('gridcell');
  const cellTexts = cells.map(cell => cell.textContent);

  // Sum of value for blue+circle=10, blue+square=20, red+circle=30,
  // red+square=40. Check that at least some of these appear.
  expect(cellTexts.some(text => text?.includes('10'))).toBe(true);
  expect(cellTexts.some(text => text?.includes('40'))).toBe(true);
});

test('TableRenderer applies namesMapping to header labels', () => {
  const props = buildDefaultProps({
    namesMapping: { blue: 'Blue Color', red: 'Red Color' },
  });
  renderWithTheme(<TableRenderer {...props} />);

  expect(screen.getByText('Blue Color')).toBeInTheDocument();
  expect(screen.getByText('Red Color')).toBeInTheDocument();
});

test('TableRenderer renders the row attribute label in the header', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  // The row attribute name "color" should appear as an axis label.
  const axisLabels = document.querySelectorAll('.pvtAxisLabel');
  const axisLabelTexts = Array.from(axisLabels).map(el => el.textContent);
  expect(axisLabelTexts).toContain('color');
});

test('TableRenderer renders the column attribute label in the header', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  // The column attribute name "shape" should appear as an axis label.
  const axisLabels = document.querySelectorAll('.pvtAxisLabel');
  const axisLabelTexts = Array.from(axisLabels).map(el => el.textContent);
  expect(axisLabelTexts).toContain('shape');
});

test('TableRenderer calls onContextMenu callback', () => {
  const onContextMenu = jest.fn();
  const props = buildDefaultProps({
    onContextMenu,
    tableOptions: { highlightHeaderCellsOnHover: true },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // The column attribute value "circle" is rendered inside a header <th> whose
  // onContextMenu handler calls the callback.
  const columnHeaderCell = screen.getByText('circle').closest('th');
  expect(columnHeaderCell).not.toBeNull();
  fireEvent.contextMenu(columnHeaderCell!);

  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [, colKey, rowKey, filters] = onContextMenu.mock.calls[0];
  expect(colKey).toEqual(['circle']);
  expect(rowKey).toBeUndefined();
  expect(filters).toEqual({ shape: 'circle' });
});

test('TableRenderer renders with multiple row dimensions', () => {
  const multiRowData = [
    { country: 'US', city: 'NYC', value: 10 },
    { country: 'US', city: 'LA', value: 20 },
    { country: 'UK', city: 'London', value: 30 },
  ];

  const props = buildDefaultProps({
    data: multiRowData,
    rows: ['country', 'city'],
    cols: [],
  });
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();

  expect(screen.getByText('US')).toBeInTheDocument();
  expect(screen.getByText('UK')).toBeInTheDocument();
  expect(screen.getByText('NYC')).toBeInTheDocument();
  expect(screen.getByText('LA')).toBeInTheDocument();
  expect(screen.getByText('London')).toBeInTheDocument();
});

test('TableRenderer renders with multiple column dimensions', () => {
  const multiColData = [
    { year: '2023', quarter: 'Q1', metric: 5 },
    { year: '2023', quarter: 'Q2', metric: 10 },
    { year: '2024', quarter: 'Q1', metric: 15 },
  ];

  const props = buildDefaultProps({
    data: multiColData,
    rows: [],
    cols: ['year', 'quarter'],
  });
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');
  expect(table).toBeInTheDocument();

  expect(screen.getByText('2023')).toBeInTheDocument();
  expect(screen.getByText('2024')).toBeInTheDocument();
  // Q1 appears under both 2023 and 2024, so use getAllByText.
  expect(screen.getAllByText('Q1').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Q2')).toBeInTheDocument();
});

test('TableRenderer renders value cells with the pvtVal class', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  const valueCells = document.querySelectorAll('.pvtVal');
  // 2 rows x 2 cols = 4 value cells
  expect(valueCells.length).toBe(4);
});

test('TableRenderer coerces numeric timestamp strings to numbers for column header date formatters', () => {
  const dateFormatter = jest.fn((val: unknown) => `col:${String(val)}`);
  const data = [
    { shape: '1700000000000', color: 'blue', value: 1 },
    { shape: 'square', color: 'blue', value: 2 },
  ];
  const props = buildDefaultProps({
    data,
    rows: ['color'],
    cols: ['shape'],
    tableOptions: { dateFormatters: { shape: dateFormatter } },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // Numeric string should be coerced to a Number before being passed to the
  // date formatter; plain (non-numeric) strings should pass through verbatim.
  expect(dateFormatter).toHaveBeenCalledWith(1700000000000);
  expect(dateFormatter).toHaveBeenCalledWith('square');

  expect(screen.getByText('col:1700000000000')).toBeInTheDocument();
  expect(screen.getByText('col:square')).toBeInTheDocument();
});

type TestData = {
  [key: string]: number | string | null;
};

const createMockAggregator =
  (data: TestData) =>
  (key: string[], _context: never[]): unknown => {
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
    Region: 150,
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
    Region: 150,
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
    Electronics: 2100,
    'Electronics|Phones': 900,
    'Electronics|Phones|iPhone': 500,
    'Electronics|Phones|Samsung': 400,
    'Electronics|Laptops': 1200,
    'Electronics|Laptops|MacBook': 1200,
    Clothing: 2550,
    'Clothing|Shirts': 1400,
    'Clothing|Shirts|T-Shirt': 1400,
    'Clothing|Pants': 1150,
    'Clothing|Pants|Jeans': 1150,
  };

  groupingValueSort(keys, createMockAggregator(data), true, true);

  expect(keys[0]).toEqual(['Electronics']);
  expect(keys[1]).toEqual(['Electronics', 'Phones']);
  expect(keys[2]).toEqual(['Electronics', 'Phones', 'Samsung']);
  expect(keys[3]).toEqual(['Electronics', 'Phones', 'iPhone']);
  expect(keys[4]).toEqual(['Electronics', 'Laptops']);
  expect(keys[5]).toEqual(['Electronics', 'Laptops', 'MacBook']);
  expect(keys[6]).toEqual(['Clothing']);
  expect(keys[7]).toEqual(['Clothing', 'Pants']);
  expect(keys[8]).toEqual(['Clothing', 'Pants', 'Jeans']);
  expect(keys[9]).toEqual(['Clothing', 'Shirts']);
  expect(keys[10]).toEqual(['Clothing', 'Shirts', 'T-Shirt']);
});

test('TableRenderer coerces numeric timestamp strings to numbers for row header date formatters', () => {
  const dateFormatter = jest.fn((val: unknown) => `row:${String(val)}`);
  const data = [
    { color: '1700000000000', shape: 'circle', value: 1 },
    { color: 'red', shape: 'circle', value: 2 },
  ];
  const props = buildDefaultProps({
    data,
    rows: ['color'],
    cols: ['shape'],
    tableOptions: { dateFormatters: { color: dateFormatter } },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // Row-header path mirrors the column path: numeric strings coerce to
  // Number, non-numeric strings pass through verbatim.
  expect(dateFormatter).toHaveBeenCalledWith(1700000000000);
  expect(dateFormatter).toHaveBeenCalledWith('red');

  expect(screen.getByText('row:1700000000000')).toBeInTheDocument();
  expect(screen.getByText('row:red')).toBeInTheDocument();
});

test('TableRenderer applies cellColorFormatters background and contrast color to column headers', () => {
  const cellColorFormatters = {
    shape: [
      {
        column: 'shape',
        getColorFromValue: (val: unknown) =>
          val === 'circle' ? '#ff0000' : undefined,
      },
    ],
  };
  const props = buildDefaultProps({
    tableOptions: { cellColorFormatters },
  });
  renderWithTheme(<TableRenderer {...props} />);

  // The matching column header should pick up the formatter's background
  // color and a contrast-aware text color from getTextColorForBackground.
  const formattedHeader = screen.getByText('circle').closest('th');
  expect(formattedHeader).not.toBeNull();
  expect(formattedHeader!.style.backgroundColor).not.toBe('');
  expect(formattedHeader!.style.color).not.toBe('');

  // The non-matching header should not get a background applied.
  const plainHeader = screen.getByText('square').closest('th');
  expect(plainHeader!.style.backgroundColor).toBe('');
});

test('TableRenderer applies cellColorFormatters background and contrast color to value cells', () => {
  // Value-cell formatters are matched against actual row/col key values
  // (not attribute names), so a formatter with column: 'blue' fires for
  // every value cell whose row key contains 'blue'.
  const cellColorFormatters = {
    color: [
      {
        column: 'blue',
        getColorFromValue: () => '#000000',
      },
    ],
  };
  const props = buildDefaultProps({
    tableOptions: { cellColorFormatters },
  });
  renderWithTheme(<TableRenderer {...props} />);

  const valueCells = Array.from(
    document.querySelectorAll<HTMLElement>('.pvtVal'),
  );
  expect(valueCells.length).toBeGreaterThan(0);

  // At least one value cell in the "blue" row should have both a background
  // and a contrast-aware text color applied.
  const formattedCells = valueCells.filter(
    cell => cell.style.backgroundColor !== '',
  );
  expect(formattedCells.length).toBeGreaterThan(0);
  formattedCells.forEach(cell => {
    expect(cell.style.color).not.toBe('');
  });
});

test('TableRenderer renders correct number of thead and tbody sections', () => {
  const props = buildDefaultProps();
  renderWithTheme(<TableRenderer {...props} />);

  const table = screen.getByRole('grid');

  // The table should have thead and tbody elements.
  const theadEl = table.querySelector('thead');
  const tbodyEl = table.querySelector('tbody');
  expect(theadEl).toBeInTheDocument();
  expect(tbodyEl).toBeInTheDocument();
});
