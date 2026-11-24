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
import { render } from 'spec/helpers/testing-library';
import { isLongText, LONG_TEXT_THRESHOLD, renderResultCell } from './utils';

jest.mock('src/components/JsonModal', () => ({
  ...jest.requireActual('src/components/JsonModal'),
  JsonModal: () => <div data-test="mock-json-modal" />,
}));

jest.mock('src/components/TextModal', () => ({
  TextModal: ({
    value,
    triggerNode,
  }: {
    value: string;
    triggerNode: string;
  }) => (
    <div data-test="mock-text-modal" data-value={value}>
      {triggerNode}
    </div>
  ),
}));

const unexpectedGetCellContent = () => 'none';

test('should render NULL for null cell data', () => {
  const { container } = render(
    <>
      {renderResultCell({
        cellData: null,
        columnKey: 'column1',
        getCellContent: unexpectedGetCellContent,
      })}
    </>,
  );
  expect(container).toHaveTextContent('NULL');
});

test('should render JsonModal for json cell data', () => {
  const { getByTestId } = render(
    <>
      {renderResultCell({
        cellData: '{ "a": 1 }',
        columnKey: 'a',
        getCellContent: unexpectedGetCellContent,
      })}
    </>,
  );
  expect(getByTestId('mock-json-modal')).toBeInTheDocument();
});

test('should render cellData value for default cell data', () => {
  const { container } = render(
    <>
      {renderResultCell({
        cellData: 'regular_text',
        columnKey: 'a',
      })}
    </>,
  );
  expect(container).toHaveTextContent('regular_text');
});

test('should render HTML cell data as inert text by default', () => {
  const { container } = render(
    <>
      {renderResultCell({
        cellData: '<img src="https://attacker.example/beacon.gif" />link',
        columnKey: 'a',
      })}
    </>,
  );
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(container).toHaveTextContent(
    '<img src="https://attacker.example/beacon.gif" />link',
  );
});

test('should render sanitized HTML only when allowHTML is explicitly enabled', () => {
  const { container } = render(
    <>
      {renderResultCell({
        cellData: '<b>bold</b>',
        columnKey: 'a',
        allowHTML: true,
      })}
    </>,
  );
  expect(container.querySelector('b')).toBeInTheDocument();
  expect(container).toHaveTextContent('bold');
});

test('should transform cell data by getCellContent for the regular text', () => {
  const { container } = render(
    <>
      {renderResultCell({
        cellData: 'regular_text',
        columnKey: 'a',
        getCellContent: ({ cellData, columnKey }) => `${cellData}:${columnKey}`,
      })}
    </>,
  );
  expect(container).toHaveTextContent('regular_text:a');
});

const longText = 'x'.repeat(LONG_TEXT_THRESHOLD + 1);

const renderCell = (
  cellData: string | number | null,
  options: { expandLongText?: boolean; allowHTML?: boolean } = {},
) =>
  render(
    <>
      {renderResultCell({
        cellData,
        columnKey: 'a',
        expandLongText: true,
        ...options,
      })}
    </>,
  );

test('isLongText flags values over the threshold or with line breaks', () => {
  expect(isLongText('x'.repeat(LONG_TEXT_THRESHOLD))).toBe(false);
  expect(isLongText('x'.repeat(LONG_TEXT_THRESHOLD + 1))).toBe(true);
  expect(isLongText('short\ntext')).toBe(true);
  expect(isLongText('short text')).toBe(false);
});

test('should render TextModal for long text when expandLongText is on', () => {
  const { getByTestId } = renderCell(longText);
  expect(getByTestId('mock-text-modal')).toHaveAttribute(
    'data-value',
    longText,
  );
  expect(getByTestId('mock-text-modal')).toHaveTextContent(longText);
});

test('should render TextModal for multi-line text when expandLongText is on', () => {
  const multiLine = 'line one\nline two';
  const { getByTestId } = renderCell(multiLine);
  expect(getByTestId('mock-text-modal')).toHaveAttribute(
    'data-value',
    multiLine,
  );
});

test('should keep the formatted cell content as the TextModal trigger', () => {
  const { getByTestId } = render(
    <>
      {renderResultCell({
        cellData: longText,
        columnKey: 'a',
        expandLongText: true,
        getCellContent: () => 'formatted',
      })}
    </>,
  );
  expect(getByTestId('mock-text-modal')).toHaveTextContent('formatted');
  expect(getByTestId('mock-text-modal')).toHaveAttribute(
    'data-value',
    longText,
  );
});

test('should not render TextModal for text at the threshold', () => {
  const atThreshold = 'x'.repeat(LONG_TEXT_THRESHOLD);
  const { container, queryByTestId } = renderCell(atThreshold);
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container).toHaveTextContent(atThreshold);
});

test('should not render TextModal for short text', () => {
  const { container, queryByTestId } = renderCell('short text');
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container).toHaveTextContent('short text');
});

test('should not render TextModal for numbers', () => {
  const longNumber = Number('9'.repeat(LONG_TEXT_THRESHOLD + 1));
  const { container, queryByTestId } = renderCell(longNumber);
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container).toHaveTextContent(String(longNumber));
});

test('should render NULL rather than TextModal for null', () => {
  const { container, queryByTestId } = renderCell(null);
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container).toHaveTextContent('NULL');
});

test('should render JsonModal rather than TextModal for long JSON', () => {
  const longJson = JSON.stringify({ key: longText });
  const { getByTestId, queryByTestId } = renderCell(longJson);
  expect(getByTestId('mock-json-modal')).toBeInTheDocument();
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
});

test('should not render TextModal for long text when expandLongText is off', () => {
  const { container, queryByTestId } = renderCell(longText, {
    expandLongText: false,
  });
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container).toHaveTextContent(longText);
});

test('should keep HTML rendering for long text when allowHTML is on', () => {
  const longHtml = `<b>bold</b>${longText}`;
  const { container, queryByTestId } = renderCell(longHtml, {
    allowHTML: true,
  });
  expect(queryByTestId('mock-text-modal')).not.toBeInTheDocument();
  expect(container.querySelector('b')).toBeInTheDocument();
});

test('should open the text modal for plain multi-line text when allowHTML is on', () => {
  const { queryByTestId } = renderCell('first line\nsecond line', {
    allowHTML: true,
  });
  expect(queryByTestId('mock-text-modal')).toBeInTheDocument();
});
