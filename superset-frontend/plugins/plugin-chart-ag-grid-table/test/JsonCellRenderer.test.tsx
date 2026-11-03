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
import { act } from 'react';
import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@superset-ui/core/spec';
import { JsonCellRenderer } from '../src/renderers/JsonCellRenderer';
import {
  type JsonContainer,
  jsonCellPreview,
  parseJsonCellValue,
} from '../src/renderers/parseJsonCellValue';
import { syncJsonCellRowHeight } from '../src/renderers/jsonCellRowHeight';
import { TextCellRenderer } from '../src/renderers/TextCellRenderer';
import {
  isJsonCellActionTarget,
  openJsonDialogOnEnter,
} from '../src/utils/isJsonCellActionTarget';
import { CellRendererProps } from '../src/types';

const nestedJson = '{"user":"ada","address":{"city":"London"}}';

const textCellParams = {
  value: nestedJson,
  valueFormatted: nestedJson,
  node: { rowPinned: undefined },
  api: {},
  colDef: { field: 'payload', autoHeight: true },
  columns: [],
  allowRenderHtml: true,
} as unknown as CellRendererProps;

test('parseJsonCellValue accepts objects and arrays only', () => {
  expect(parseJsonCellValue('{"a":1}')).toEqual({ a: 1 });
  expect(parseJsonCellValue('  [1, 2]  ')).toEqual([1, 2]);
  expect(parseJsonCellValue({ a: 1 })).toEqual({ a: 1 });
  expect(parseJsonCellValue('[1]')).toEqual([1]);
  expect(parseJsonCellValue('plain')).toBeNull();
  expect(parseJsonCellValue('{not json')).toBeNull();
  expect(parseJsonCellValue('"just a string"')).toBeNull();
  expect(parseJsonCellValue('123')).toBeNull();
  expect(parseJsonCellValue(null)).toBeNull();
  expect(parseJsonCellValue(new Date('2024-01-01'))).toBeNull();
});

test('parseJsonCellValue reuses a parsed string and skips oversized text', () => {
  const first = parseJsonCellValue('{"a":1}');
  expect(parseJsonCellValue('{"a":1}')).toBe(first);
  expect(parseJsonCellValue(`{"a":"${'x'.repeat(100_000)}"}`)).toBeNull();
  expect(parseJsonCellValue(`${' '.repeat(100_001)}{}`)).toBeNull();
  expect(parseJsonCellValue('   {"a":1}   ')).toEqual({ a: 1 });
  expect(parseJsonCellValue('')).toBeNull();
  expect(parseJsonCellValue('   ')).toBeNull();
  expect(parseJsonCellValue(Object.create(null))).toEqual({});
});

test('parseJsonCellValue drops the oldest cached string when the cache is full', () => {
  const filler = 'x'.repeat(40_000);
  const firstText = `{"n":"0${filler}"}`;
  const first = parseJsonCellValue(firstText);
  for (let index = 1; index <= 12; index += 1) {
    parseJsonCellValue(`{"n":"${index}${filler}"}`);
  }
  expect(parseJsonCellValue(firstText)).not.toBe(first);
  expect(parseJsonCellValue(firstText)).toEqual({ n: `0${filler}` });
});

test('jsonCellPreview collapses formatting whitespace and keeps string contents', () => {
  expect(jsonCellPreview({ a: 1 }, '{\n  "a": 1\n}')).toBe('{ "a": 1 }');
  expect(jsonCellPreview({ a: 'x  y' }, '{\n  "a": "x  y"\n}')).toBe(
    '{ "a": "x  y" }',
  );
  expect(jsonCellPreview({ a: 'x"y' }, '{"a":"x\\"y"}')).toBe('{"a":"x\\"y"}');
  expect(jsonCellPreview({ a: 1 }, '{\r\n\t"a": 1}')).toBe('{ "a": 1}');
  expect(jsonCellPreview({ a: 'x'.repeat(100_001) })).toBe('{…}');
  expect(jsonCellPreview(Array.from({ length: 100_001 }, () => 1))).toBe('[…]');
  expect(jsonCellPreview({ a: BigInt(1) })).toBe('{…}');
  expect(jsonCellPreview([BigInt(1)])).toBe('[…]');
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(jsonCellPreview(cyclic)).toBe('{…}');
  let deep: unknown = { leaf: 'end' };
  for (let index = 0; index < 1001; index += 1) {
    deep = [deep];
  }
  expect(jsonCellPreview(deep as JsonContainer)).toBe('[…]');
  expect(jsonCellPreview({ a: 1 })).toBe('{"a":1}');
  expect(jsonCellPreview([1, 2])).toBe('[1,2]');
});

test('syncJsonCellRowHeight writes height onto the row node', () => {
  class FakeRow {
    rowHeight: number | null = null;

    setRowHeight(height: number | null | undefined) {
      this.rowHeight = height ?? null;
    }
  }
  const row = new FakeRow();
  const onRowHeightChanged = jest.fn();

  syncJsonCellRowHeight(row, onRowHeightChanged, 'a', 100);
  syncJsonCellRowHeight(row, onRowHeightChanged, 'b', 40);
  expect(row.rowHeight).toBe(100);

  syncJsonCellRowHeight(row, onRowHeightChanged, 'a', 0);
  expect(row.rowHeight).toBe(40);

  syncJsonCellRowHeight(row, onRowHeightChanged, 'b', 0);
  expect(row.rowHeight).toBeNull();
});

test('syncJsonCellRowHeight ignores a collapse that was never expanded', () => {
  const row = { setRowHeight: jest.fn() };
  const onRowHeightChanged = jest.fn();
  syncJsonCellRowHeight(row, onRowHeightChanged, 'c', 0);
  expect(row.setRowHeight).not.toHaveBeenCalled();
  expect(onRowHeightChanged).not.toHaveBeenCalled();
});

test('isJsonCellActionTarget matches controls inside a JSON cell', () => {
  document.body.innerHTML =
    '<div data-json-cell-action="true"><span id="json-action"></span></div><span id="plain"></span>';
  expect(isJsonCellActionTarget(document.getElementById('json-action'))).toBe(
    true,
  );
  expect(isJsonCellActionTarget(document.getElementById('plain'))).toBe(false);
  expect(isJsonCellActionTarget(null)).toBe(false);

  const cell = document.createElement('div');
  cell.className = 'ag-cell';
  const open = document.createElement('button');
  open.setAttribute('data-json-cell-open', '');
  const onClick = jest.fn();
  open.addEventListener('click', onClick);
  cell.appendChild(open);
  const preventDefault = jest.fn();
  expect(
    openJsonDialogOnEnter({
      key: 'Enter',
      target: cell,
      preventDefault,
    } as unknown as KeyboardEvent),
  ).toBe(true);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(
    openJsonDialogOnEnter({
      key: 'Enter',
      ctrlKey: true,
      target: cell,
      preventDefault,
    } as unknown as KeyboardEvent),
  ).toBe(false);

  const arrow = document.createElement('button');
  arrow.setAttribute('data-json-cell-action', '');
  cell.appendChild(arrow);
  onClick.mockClear();
  expect(
    openJsonDialogOnEnter({
      key: 'Enter',
      target: arrow,
      preventDefault,
    } as unknown as KeyboardEvent),
  ).toBe(false);
  expect(onClick).not.toHaveBeenCalled();
});

test('collapsed JSON shows a one-line preview and hides nested keys', async () => {
  render(
    <JsonCellRenderer
      value={{ user: 'ada', address: { city: 'London' } }}
      rawText={nestedJson}
      colId="payload"
      autoHeight={false}
      jsonInCell
    />,
  );

  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent(nestedJson);
  expect(
    screen.queryByRole('button', { name: 'Expand address' }),
  ).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));

  expect(
    await screen.findByRole('button', { name: 'Expand address' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('json-cell-preview')).not.toBeInTheDocument();
  expect(screen.queryByText('London')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Expand address' }));
  expect(screen.getByText('"London"')).toBeInTheDocument();
});

test('JSON controls do not bubble clicks to the cell', async () => {
  const onParentClick = jest.fn();
  const { container } = render(
    <JsonCellRenderer
      value={{ a: 1 }}
      colId="payload"
      autoHeight={false}
      jsonInCell
    />,
  );
  container.addEventListener('click', onParentClick);

  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));
  expect(onParentClick).not.toHaveBeenCalled();
});

test('expanded JSON asks an auto-height grid to remeasure the row', async () => {
  const resetRowHeights = jest.fn();
  render(
    <JsonCellRenderer
      value={{ a: 1 }}
      colId="payload"
      autoHeight
      jsonInCell
      api={{ resetRowHeights }}
    />,
  );

  expect(resetRowHeights).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));
  expect(
    await screen.findByRole('button', { name: 'Collapse JSON' }),
  ).toBeInTheDocument();
  expect(resetRowHeights).toHaveBeenCalled();
});

test('a wrapping column shows the original JSON across lines', () => {
  const raw = '{\n  "user": "ada"\n}';
  render(
    <JsonCellRenderer
      value={{ user: 'ada' }}
      rawText={raw}
      colId="payload"
      autoHeight
      wrapText
    />,
  );
  const preview = screen.getByTestId('json-cell-preview');
  expect(preview.textContent).toBe(raw);
  expect(preview).toHaveAttribute('data-wrap', 'true');
});

test('a wrapping column abbreviates an oversized parsed value', () => {
  render(
    <JsonCellRenderer
      value={Array.from({ length: 100_001 }, () => 1)}
      colId="payload"
      autoHeight
      wrapText
    />,
  );
  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent('[…]');
});

test('JSON in cell keeps a one-line preview in a wrapping column', () => {
  const raw = '{\n  "user": "ada"\n}';
  render(
    <JsonCellRenderer
      value={{ user: 'ada' }}
      rawText={raw}
      colId="payload"
      autoHeight
      wrapText
      jsonInCell
    />,
  );
  const preview = screen.getByTestId('json-cell-preview');
  expect(preview.textContent).toBe('{ "user": "ada" }');
  expect(preview).toHaveAttribute('data-wrap', 'false');
});

test('the default cell is a collapsed preview without an arrow', async () => {
  const onParentClick = jest.fn();
  const raw = '{\n  "user": "ada"\n}';
  const { container } = render(
    <JsonCellRenderer
      value={{ user: 'ada' }}
      rawText={raw}
      colId="payload"
      autoHeight={false}
    />,
  );
  container.addEventListener('click', onParentClick);

  const preview = screen.getByTestId('json-cell-preview');
  const openJson = screen.getByRole('button', { name: 'Open JSON' });
  expect(preview.textContent).toBe('{ "user": "ada" }');
  expect(
    preview.compareDocumentPosition(openJson) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Expand JSON' }),
  ).not.toBeInTheDocument();
  fireEvent.click(preview);
  expect(onParentClick).toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  fireEvent.dblClick(preview);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  onParentClick.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  expect(onParentClick).not.toHaveBeenCalled();
  expect(await screen.findByRole('dialog')).toHaveTextContent('Cell content');
});

test('the arrow expands the cell and the right icon opens the dialog', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <JsonCellRenderer
      value={{ user: 'ada', address: { city: 'London' } }}
      rawText={nestedJson}
      colId="payload"
      autoHeight={false}
      jsonInCell
    />,
  );

  const cell = screen.getByTestId('json-cell');
  const preview = within(cell).getByTestId('json-cell-preview');
  const arrow = within(cell).getByRole('button', { name: 'Expand JSON' });
  const openJson = within(cell).getByRole('button', { name: 'Open JSON' });
  expect(
    arrow.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    preview.compareDocumentPosition(openJson) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await userEvent.click(
    within(cell).getByRole('button', { name: 'Expand JSON' }),
  );
  expect(
    within(cell).getByRole('button', { name: 'Expand address' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    within(cell).queryByTestId('json-cell-preview'),
  ).not.toBeInTheDocument();

  await userEvent.click(
    within(cell).getByRole('button', { name: 'Open JSON' }),
  );
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Cell content');
  expect(
    within(cell).getByRole('button', { name: 'Expand address' }),
  ).toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
  expect(writeText).toHaveBeenCalledWith(nestedJson);
  expect(
    await within(dialog).findByRole('button', { name: 'Copied' }),
  ).toBeInTheDocument();
});

test('the dialog shows primitives and arrays', async () => {
  render(
    <JsonCellRenderer
      value={{
        n: 1,
        big: BigInt(2),
        on: false,
        empty: null,
        items: ['ada'],
      }}
      colId="payload"
      autoHeight={false}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('1')).toBeInTheDocument();
  expect(within(dialog).getByText('2')).toBeInTheDocument();
  expect(within(dialog).getByText('false')).toBeInTheDocument();
  expect(within(dialog).getByText('null')).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Expand items' }),
  ).toBeInTheDocument();

  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Expand items' }),
  );
  expect(within(dialog).getByText('"ada"')).toBeInTheDocument();
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Collapse items' }),
  );
  expect(within(dialog).queryByText('"ada"')).not.toBeInTheDocument();

  await userEvent.click(within(dialog).getByTestId('close-modal-btn'));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
});

test('a nested value past the depth limit is abbreviated', async () => {
  let deep: Record<string, unknown> = { leaf: 'end' };
  for (let index = 0; index < 40; index += 1) {
    deep = { child: deep };
  }
  render(<JsonCellRenderer value={deep} colId="payload" autoHeight={false} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  const dialog = await screen.findByRole('dialog');
  for (let index = 0; index < 31; index += 1) {
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Expand child' }),
    );
  }
  expect(within(dialog).getByText('…')).toBeInTheDocument();
});

test('the copied label clears after two seconds', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <JsonCellRenderer value={{ a: 1 }} colId="payload" autoHeight={false} />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  const dialog = await screen.findByRole('dialog');

  jest.useFakeTimers();
  try {
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
      await Promise.resolve();
    });
    expect(
      within(dialog).getByRole('button', { name: 'Copied' }),
    ).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(
      within(dialog).getByRole('button', { name: 'Copy' }),
    ).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('a long preview has no title and an expanded cell sets the row height', async () => {
  const longValue = { a: 'y'.repeat(500) };
  const setRowHeight = jest.fn();
  const onRowHeightChanged = jest.fn();
  const cell = document.createElement('div');
  const { container, unmount } = render(
    <JsonCellRenderer
      value={longValue}
      colId="payload"
      autoHeight={false}
      jsonInCell
      node={{ setRowHeight }}
      api={{ onRowHeightChanged }}
      eGridCell={cell}
    />,
  );
  expect(screen.getByTestId('json-cell-preview')).not.toHaveAttribute('title');

  const root = container.querySelector(
    '[data-test="json-cell"]',
  ) as HTMLElement;
  Object.defineProperty(root, 'scrollHeight', {
    configurable: true,
    value: 40,
  });
  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));
  expect(
    await screen.findByRole('button', { name: 'Collapse JSON' }),
  ).toBeInTheDocument();
  expect(cell.classList.contains('json-cell-expanded')).toBe(true);
  expect(setRowHeight).toHaveBeenCalledWith(52);
  expect(onRowHeightChanged).toHaveBeenCalled();

  unmount();
  expect(setRowHeight).toHaveBeenCalledWith(null);
  expect(cell.classList.contains('json-cell-expanded')).toBe(false);
});

test('a destroyed grid does not change row height, and auto-height resets on unmount', async () => {
  const setRowHeight = jest.fn();
  const resetRowHeights = jest.fn();
  const { unmount } = render(
    <JsonCellRenderer
      value={{ a: 1 }}
      colId="payload"
      autoHeight={false}
      jsonInCell
      node={{ setRowHeight }}
      api={{ onRowHeightChanged: jest.fn(), isDestroyed: () => true }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));
  expect(
    await screen.findByRole('button', { name: 'Collapse JSON' }),
  ).toBeInTheDocument();
  expect(setRowHeight).not.toHaveBeenCalled();
  unmount();

  const { unmount: unmountAuto } = render(
    <JsonCellRenderer
      value={{ a: 1 }}
      colId="payload"
      autoHeight
      jsonInCell
      api={{ resetRowHeights }}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand JSON' }));
  expect(
    await screen.findByRole('button', { name: 'Collapse JSON' }),
  ).toBeInTheDocument();
  const callsAfterExpand = resetRowHeights.mock.calls.length;
  unmountAuto();
  expect(resetRowHeights.mock.calls.length).toBeGreaterThan(callsAfterExpand);
});

test('copy reports failure when the clipboard is missing or rejects', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  const { unmount } = render(
    <JsonCellRenderer value={{ a: 1 }} colId="payload" autoHeight={false} />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
  expect(
    within(dialog).getByRole('button', { name: 'Copy' }),
  ).toBeInTheDocument();
  unmount();

  const writeText = jest.fn().mockRejectedValue(new Error('denied'));
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(
    <JsonCellRenderer
      value={{ a: 1 }}
      rawText='{"a":1}'
      colId="payload"
      autoHeight={false}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open JSON' }));
  const nextDialog = await screen.findByRole('dialog');
  await userEvent.click(
    within(nextDialog).getByRole('button', { name: 'Copy' }),
  );
  expect(writeText).toHaveBeenCalledWith('{"a":1}');
  expect(
    within(nextDialog).getByRole('button', { name: 'Copy' }),
  ).toBeInTheDocument();
});

test('text cells render JSON, and leave other strings untouched', () => {
  const { unmount } = render(<TextCellRenderer {...textCellParams} />);
  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent('ada');
  unmount();

  const { unmount: unmountText } = render(
    <TextCellRenderer
      {...textCellParams}
      value="plain text"
      valueFormatted="plain text"
    />,
  );
  expect(screen.getByText('plain text')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Expand JSON' }),
  ).not.toBeInTheDocument();
  unmountText();

  render(
    <TextCellRenderer
      {...textCellParams}
      value="https://example.com"
      valueFormatted="https://example.com"
    />,
  );
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com',
  );
});

test('a column formatter that rewrites the cell keeps the formatted text', () => {
  const { unmount } = render(
    <TextCellRenderer
      {...textCellParams}
      value={nestedJson}
      valueFormatted="Ada Lovelace"
    />,
  );
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.queryByTestId('json-cell')).not.toBeInTheDocument();
  unmount();

  const { unmount: unmountObject } = render(
    <TextCellRenderer
      {...textCellParams}
      value={{ user: 'ada' }}
      valueFormatted="Ada"
    />,
  );
  expect(screen.getByText('Ada')).toBeInTheDocument();
  expect(screen.queryByTestId('json-cell')).not.toBeInTheDocument();
  unmountObject();

  render(
    <TextCellRenderer
      {...textCellParams}
      value={{ user: 'ada' }}
      valueFormatted="[object Object]"
    />,
  );
  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent('ada');
});

test('JSON that the HTML renderer would claim stays HTML', () => {
  const htmlJson = '{"message":"<b>ok</b>"}';
  const params = {
    ...textCellParams,
    value: htmlJson,
    valueFormatted: htmlJson,
  };

  const { container, unmount } = render(<TextCellRenderer {...params} />);
  expect(screen.queryByTestId('json-cell')).not.toBeInTheDocument();
  expect(container.querySelector('b')).toHaveTextContent('ok');
  unmount();

  render(<TextCellRenderer {...params} allowRenderHtml={false} />);
  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent('ok');
});
