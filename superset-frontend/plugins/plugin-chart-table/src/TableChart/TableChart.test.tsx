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
import { render, screen } from '@superset-ui/core/spec';
import TableChart from './index';
import transformProps from '../transformProps';
import testData from '../../test/testData';
import { ProviderWrapper } from '../../test/testHelpers';

test('renders basic table with data', () => {
  render(<TableChart {...transformProps(testData.basic)} sticky={false} />);

  const firstDataRow = screen.getAllByRole('rowgroup')[1];
  const cells = firstDataRow.querySelectorAll('td');

  expect(cells).toHaveLength(12);
  expect(cells[0]).toHaveTextContent('2020-01-01 12:34:56');
  expect(cells[1]).toHaveTextContent('Michael');
  expect(cells[2]).toHaveTextContent('2467063');
});

test('renders advanced table with formatted numbers', () => {
  render(<TableChart {...transformProps(testData.advanced)} sticky={false} />);

  const secondColumnHeader = screen.getByText('Sum of Num').closest('th');
  expect(secondColumnHeader).toBeTruthy();
  expect(secondColumnHeader).toHaveAttribute('data-column-name', '1');

  const firstDataRow = screen.getAllByRole('rowgroup')[1];
  const cells = firstDataRow.querySelectorAll('td');

  expect(cells[0]).toHaveTextContent('Michael');
  expect(cells[2]).toHaveTextContent('12.346%');
  expect(cells[4]).toHaveTextContent('2.47k');
});

test('renders empty data with no records message', () => {
  render(<TableChart {...transformProps(testData.empty)} sticky={false} />);

  const noResultsMessage = screen.getByText('No records found');
  expect(noResultsMessage).toHaveClass('dt-no-results');
});

test('renders table with currencies correctly', () => {
  render(
    ProviderWrapper({
      children: (
        <TableChart
          {...transformProps(testData.advancedWithCurrency)}
          sticky={false}
        />
      ),
    }),
  );

  const cells = document.querySelectorAll('td');
  expect(document.querySelectorAll('th')[1]).toHaveTextContent('Sum of Num');
  expect(cells[0]).toHaveTextContent('Michael');
  expect(cells[2]).toHaveTextContent('12.346%');
  expect(cells[4]).toHaveTextContent('$ 2.47k');
});

test('renders bigint values in raw record mode', () => {
  render(
    ProviderWrapper({
      children: (
        <TableChart
          {...transformProps(testData.bigint)}
          sticky={false}
          isRawRecords
        />
      ),
    }),
  );

  const cells = document.querySelectorAll('td');
  expect(document.querySelectorAll('th')[0]).toHaveTextContent('name');
  expect(document.querySelectorAll('th')[1]).toHaveTextContent('id');
  expect(cells[0]).toHaveTextContent('Michael');
  expect(cells[1]).toHaveTextContent('4312');
  expect(cells[2]).toHaveTextContent('John');
  expect(cells[3]).toHaveTextContent('1234567890123456789');
});

test('displays grouped headers for time comparison columns', () => {
  const props = transformProps(testData.comparison);

  render(<TableChart {...props} sticky={false} />);

  const groupHeaders = screen.getAllByRole('columnheader');
  expect(groupHeaders.length).toBeGreaterThan(0);

  const hasMetricHeaders = groupHeaders.some(
    header =>
      header.textContent &&
      (header.textContent.includes('metric') ||
        header.textContent.includes('Metric')),
  );
  expect(hasMetricHeaders).toBe(true);
});

test('renders cell bars for metrics when enabled', () => {
  const props = transformProps({
    ...testData.raw,
    rawFormData: { ...testData.raw.rawFormData },
  });

  props.columns[0].isMetric = true;

  render(
    ProviderWrapper({
      children: <TableChart {...props} sticky={false} />,
    }),
  );

  const cellBars = document.querySelectorAll('div.cell-bar');
  cellBars.forEach(cell => {
    expect(cell).toHaveClass('positive');
  });
});

test('hides cell bars when showCellBars is false', () => {
  const props = transformProps({
    ...testData.raw,
    rawFormData: { ...testData.raw.rawFormData },
  });

  props.columns[0].isPercentMetric = true;
  props.showCellBars = false;

  render(
    ProviderWrapper({
      children: <TableChart {...props} sticky={false} />,
    }),
  );

  const cellBars = document.querySelectorAll('div.cell-bar');
  expect(cellBars.length).toBe(0);
});

test.each([
  {
    name: 'greater than operator',
    column: 'sum__num',
    operator: '>',
    targetValue: 2467,
    matchQuery: { type: 'title', value: '2467063' },
    noMatchQuery: { type: 'title', value: '2467' },
  },
  {
    name: 'begins with operator',
    column: 'name',
    operator: 'begins with',
    targetValue: 'J',
    matchQuery: { type: 'text', value: 'Joe' },
    noMatchQuery: { type: 'text', value: 'Michael' },
  },
  {
    name: 'ends with operator',
    column: 'name',
    operator: 'ends with',
    targetValue: 'ia',
    matchQuery: { type: 'text', value: 'Maria' },
    noMatchQuery: { type: 'text', value: 'Joe' },
  },
  {
    name: 'containing operator',
    column: 'name',
    operator: 'containing',
    targetValue: 'c',
    matchQuery: { type: 'text', value: 'Michael' },
    noMatchQuery: { type: 'text', value: 'Joe' },
  },
  {
    name: 'equals operator',
    column: 'name',
    operator: '=',
    targetValue: 'Joe',
    matchQuery: { type: 'text', value: 'Joe' },
    noMatchQuery: { type: 'text', value: 'Michael' },
  },
])(
  'applies conditional formatting with $name',
  ({ column, operator, targetValue, matchQuery, noMatchQuery }) => {
    render(
      ProviderWrapper({
        children: (
          <TableChart
            {...transformProps({
              ...testData.advanced,
              rawFormData: {
                ...testData.advanced.rawFormData,
                conditional_formatting: [
                  {
                    colorScheme: '#ACE1C4',
                    column,
                    operator,
                    targetValue,
                  },
                ],
              },
            })}
          />
        ),
      }),
    );

    const matchElement =
      matchQuery.type === 'text'
        ? screen.getByText(matchQuery.value)
        : screen.getByTitle(matchQuery.value);
    const noMatchElement =
      noMatchQuery.type === 'text'
        ? screen.getByText(noMatchQuery.value)
        : screen.getByTitle(noMatchQuery.value);

    expect(getComputedStyle(matchElement).background).toBe(
      'rgba(172, 225, 196, 1)',
    );
    expect(getComputedStyle(noMatchElement).background).toBe('');
  },
);

test('applies conditional formatting with None operator to all cells', () => {
  render(
    ProviderWrapper({
      children: (
        <TableChart
          {...transformProps({
            ...testData.advanced,
            rawFormData: {
              ...testData.advanced.rawFormData,
              conditional_formatting: [
                {
                  colorScheme: '#ACE1C4',
                  column: 'name',
                  operator: 'None',
                },
              ],
            },
          })}
        />
      ),
    }),
  );

  expect(getComputedStyle(screen.getByText('Joe')).background).toBe(
    'rgba(172, 225, 196, 1)',
  );
  expect(getComputedStyle(screen.getByText('Michael')).background).toBe(
    'rgba(172, 225, 196, 1)',
  );
  expect(getComputedStyle(screen.getByText('Maria')).background).toBe(
    'rgba(172, 225, 196, 1)',
  );
});

test('handles null values correctly with conditional formatting', () => {
  const dataWithEmptyCell = {
    ...testData.advanced.queriesData[0],
    data: [
      ...testData.advanced.queriesData[0].data,
      {
        __timestamp: null,
        name: 'Noah',
        sum__num: null,
        '%pct_nice': 0.643,
        'abc.com': 'bazzinga',
      },
    ],
  };

  render(
    ProviderWrapper({
      children: (
        <TableChart
          {...transformProps({
            ...testData.advanced,
            queriesData: [dataWithEmptyCell],
            rawFormData: {
              ...testData.advanced.rawFormData,
              conditional_formatting: [
                {
                  colorScheme: '#ACE1C4',
                  column: 'sum__num',
                  operator: '<',
                  targetValue: 12342,
                },
              ],
            },
          })}
        />
      ),
    }),
  );

  expect(getComputedStyle(screen.getByTitle('2467')).background).toBe(
    'rgba(172, 225, 196, 0.812)',
  );
  expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe('');
  expect(getComputedStyle(screen.getByText('N/A')).background).toBe('');
});

test('renders raw data correctly', () => {
  const props = transformProps({
    ...testData.raw,
    rawFormData: { ...testData.raw.rawFormData },
  });

  render(
    ProviderWrapper({
      children: <TableChart {...props} sticky={false} />,
    }),
  );

  const cells = document.querySelectorAll('td');
  expect(document.querySelectorAll('th')[0]).toHaveTextContent('num');
  expect(cells[0]).toHaveTextContent('1234');
  expect(cells[1]).toHaveTextContent('10000');
  expect(cells[2]).toHaveTextContent('0');
});

test('renders raw data with currencies', () => {
  const props = transformProps({
    ...testData.raw,
    rawFormData: {
      ...testData.raw.rawFormData,
      column_config: {
        num: {
          currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
        },
      },
    },
  });

  render(
    ProviderWrapper({
      children: <TableChart {...props} sticky={false} />,
    }),
  );

  const cells = document.querySelectorAll('td');
  expect(document.querySelectorAll('th')[0]).toHaveTextContent('num');
  expect(cells[0]).toHaveTextContent('$ 1.23k');
  expect(cells[1]).toHaveTextContent('$ 10k');
  expect(cells[2]).toHaveTextContent('$ 0');
});

test('renders small formatted numbers with currencies', () => {
  const props = transformProps({
    ...testData.raw,
    rawFormData: {
      ...testData.raw.rawFormData,
      column_config: {
        num: {
          d3SmallNumberFormat: '.2r',
          currencyFormat: { symbol: 'USD', symbolPosition: 'prefix' },
        },
      },
    },
    queriesData: [
      {
        ...testData.raw.queriesData[0],
        data: [{ num: 1234 }, { num: 0.5 }, { num: 0.61234 }],
      },
    ],
  });

  render(
    ProviderWrapper({
      children: <TableChart {...props} sticky={false} />,
    }),
  );

  const cells = document.querySelectorAll('td');
  expect(document.querySelectorAll('th')[0]).toHaveTextContent('num');
  expect(cells[0]).toHaveTextContent('$ 1.23k');
  expect(cells[1]).toHaveTextContent('$ 0.50');
  expect(cells[2]).toHaveTextContent('$ 0.61');
});
