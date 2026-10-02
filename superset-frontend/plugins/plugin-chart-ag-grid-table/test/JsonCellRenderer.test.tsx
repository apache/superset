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
import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from '@superset-ui/core/spec';
import { JsonCellRenderer } from '../src/renderers/JsonCellRenderer';
import {
  jsonCellPreview,
  parseJsonCellValue,
} from '../src/renderers/parseJsonCellValue';
import { syncJsonCellRowHeight } from '../src/renderers/jsonCellRowHeight';
import { TextCellRenderer } from '../src/renderers/TextCellRenderer';
import { isJsonCellActionTarget } from '../src/utils/isJsonCellActionTarget';
import { CellRendererProps } from '../src/types';

const nestedJson = '{"user":"ada","address":{"city":"London"}}';

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

test('jsonCellPreview collapses whitespace onto one line', () => {
  expect(jsonCellPreview({ a: 1 }, '{\n  "a": 1\n}')).toBe('{ "a": 1 }');
});

test('syncJsonCellRowHeight keeps the tallest expanded cell', () => {
  const node = { setRowHeight: jest.fn() };
  const api = { onRowHeightChanged: jest.fn() };

  syncJsonCellRowHeight(node, api, 'a', 100);
  syncJsonCellRowHeight(node, api, 'b', 40);
  expect(node.setRowHeight).toHaveBeenLastCalledWith(100);

  syncJsonCellRowHeight(node, api, 'a', 0);
  expect(node.setRowHeight).toHaveBeenLastCalledWith(40);

  syncJsonCellRowHeight(node, api, 'b', 0);
  expect(node.setRowHeight).toHaveBeenLastCalledWith(null);
});

test('syncJsonCellRowHeight ignores a collapse that was never expanded', () => {
  const node = { setRowHeight: jest.fn() };
  const api = { onRowHeightChanged: jest.fn() };
  syncJsonCellRowHeight(node, api, 'c', 0);
  expect(node.setRowHeight).not.toHaveBeenCalled();
  expect(api.onRowHeightChanged).not.toHaveBeenCalled();
});

test('isJsonCellActionTarget matches controls inside a JSON cell', () => {
  document.body.innerHTML =
    '<div data-json-cell-action="true"><span id="json-action"></span></div><span id="plain"></span>';
  expect(isJsonCellActionTarget(document.getElementById('json-action'))).toBe(
    true,
  );
  expect(isJsonCellActionTarget(document.getElementById('plain'))).toBe(false);
  expect(isJsonCellActionTarget(null)).toBe(false);
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

test('the default cell keeps the original JSON text, including line breaks', () => {
  const raw = '{\n  "user": "ada"\n}';
  render(
    <JsonCellRenderer
      value={{ user: 'ada' }}
      rawText={raw}
      colId="payload"
      autoHeight={false}
    />,
  );

  expect(screen.getByTestId('json-cell-preview').textContent).toBe(raw);
  expect(
    screen.queryByRole('button', { name: 'Expand JSON' }),
  ).not.toBeInTheDocument();
});

test('JSON stays the original text and opens on click', async () => {
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
    />,
  );

  expect(
    screen.queryByRole('button', { name: 'Expand JSON' }),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('json-cell-preview').textContent).toBe(nestedJson);
  await userEvent.click(screen.getByTestId('json-cell-preview'));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Cell content');
  expect(within(dialog).getByText('"ada"')).toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
  expect(writeText).toHaveBeenCalledWith(nestedJson);
  expect(
    await within(dialog).findByRole('button', { name: 'Copied' }),
  ).toBeInTheDocument();
});

test('a click on the arrow expands the cell and a second click opens the dialog', async () => {
  render(
    <JsonCellRenderer
      value={{ user: 'ada', address: { city: 'London' } }}
      rawText={nestedJson}
      colId="payload"
      autoHeight={false}
      jsonInCell
    />,
  );

  fireEvent.dblClick(screen.getByTestId('json-cell-preview'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  const cell = screen.getByTestId('json-cell');
  const arrow = within(cell).getByRole('button', { name: 'Expand JSON' });
  fireEvent.click(arrow);
  fireEvent.click(arrow);
  expect(await screen.findByRole('dialog')).toHaveTextContent('Cell content');
  expect(
    within(cell).queryByRole('button', { name: 'Expand address' }),
  ).not.toBeInTheDocument();
  expect(within(cell).getByTestId('json-cell-preview')).toBeInTheDocument();
});

test('text cells render JSON, and leave other strings untouched', () => {
  const jsonParams = {
    value: nestedJson,
    valueFormatted: nestedJson,
    node: { rowPinned: undefined },
    api: {},
    colDef: { field: 'payload', autoHeight: true },
    columns: [],
    allowRenderHtml: true,
  } as unknown as CellRendererProps;

  const { unmount } = render(<TextCellRenderer {...jsonParams} />);
  expect(screen.getByTestId('json-cell-preview')).toHaveTextContent('ada');
  unmount();

  const textParams = {
    ...jsonParams,
    value: 'plain text',
    valueFormatted: 'plain text',
  } as CellRendererProps;
  const { unmount: unmountText } = render(<TextCellRenderer {...textParams} />);
  expect(screen.getByText('plain text')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Expand JSON' }),
  ).not.toBeInTheDocument();
  unmountText();

  const linkParams = {
    ...jsonParams,
    value: 'https://example.com',
    valueFormatted: 'https://example.com',
  } as CellRendererProps;
  render(<TextCellRenderer {...linkParams} />);
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com',
  );
});
