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
import { render, screen } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';
import { ProviderWrapper } from './testHelpers';

describe('plugin-chart-table', () => {
  describe('transformProps', () => {
    it('should parse pageLength to pageSize', () => {
      expect(transformProps(testData.basic).pageSize).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, page_length: '20' },
        }).pageSize,
      ).toBe(20);
      expect(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, page_length: '' },
        }).pageSize,
      ).toBe(0);
    });

    it('should memoize data records', () => {
      expect(transformProps(testData.basic).data).toBe(
        transformProps(testData.basic).data,
      );
    });

    it('should memoize columns meta', () => {
      expect(transformProps(testData.basic).columns).toBe(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, pageLength: null },
        }).columns,
      );
    });

    it('should format timestamp', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parsedDate = transformProps(testData.basic).data[0]
        .__timestamp as DateWithFormatter;
      expect(String(parsedDate)).toBe('2020-01-01 12:34:56');
      expect(parsedDate.getTime()).toBe(1577882096000);
    });
    it('should process comparison columns when time_compare and comparison_type are set', () => {
      const transformedProps = transformProps(testData.comparison);

      // Check if comparison columns are processed
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.label === 'Main' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );

      expect(comparisonColumns.length).toBeGreaterThan(0);
      expect(comparisonColumns.some(col => col.label === 'Main')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '#')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '△')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '%')).toBe(true);
    });

    it('should not process comparison columns when time_compare is empty', () => {
      const propsWithoutTimeCompare = {
        ...testData.comparison,
        rawFormData: {
          ...testData.comparison.rawFormData,
          time_compare: [],
        },
      };

      const transformedProps = transformProps(propsWithoutTimeCompare);

      // Check if comparison columns are not processed
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.label === 'Main' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );

      expect(comparisonColumns.length).toBe(0);
    });

    it('should correctly apply column configuration for comparison columns', () => {
      const transformedProps = transformProps(testData.comparisonWithConfig);

      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.key.startsWith('Main') ||
          col.key.startsWith('#') ||
          col.key.startsWith('△') ||
          col.key.startsWith('%'),
      );

      expect(comparisonColumns).toHaveLength(4);

      const mainMetricConfig = comparisonColumns.find(
        col => col.key === 'Main metric_1',
      );
      expect(mainMetricConfig).toBeDefined();
      expect(mainMetricConfig?.config).toEqual({ d3NumberFormat: '.2f' });

      const hashMetricConfig = comparisonColumns.find(
        col => col.key === '# metric_1',
      );
      expect(hashMetricConfig).toBeDefined();
      expect(hashMetricConfig?.config).toEqual({ d3NumberFormat: '.1f' });

      const deltaMetricConfig = comparisonColumns.find(
        col => col.key === '△ metric_1',
      );
      expect(deltaMetricConfig).toBeDefined();
      expect(deltaMetricConfig?.config).toEqual({ d3NumberFormat: '.0f' });

      const percentMetricConfig = comparisonColumns.find(
        col => col.key === '% metric_1',
      );
      expect(percentMetricConfig).toBeDefined();
      expect(percentMetricConfig?.config).toEqual({ d3NumberFormat: '.3f' });
    });

    it('should correctly format comparison columns using getComparisonColFormatter', () => {
      const transformedProps = transformProps(testData.comparisonWithConfig);
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.key.startsWith('Main') ||
          col.key.startsWith('#') ||
          col.key.startsWith('△') ||
          col.key.startsWith('%'),
      );

      const formattedMainMetric = comparisonColumns
        .find(col => col.key === 'Main metric_1')
        ?.formatter?.(12345.678);
      expect(formattedMainMetric).toBe('12345.68');

      const formattedHashMetric = comparisonColumns
        .find(col => col.key === '# metric_1')
        ?.formatter?.(12345.678);
      expect(formattedHashMetric).toBe('12345.7');

      const formattedDeltaMetric = comparisonColumns
        .find(col => col.key === '△ metric_1')
        ?.formatter?.(12345.678);
      expect(formattedDeltaMetric).toBe('12346');

      const formattedPercentMetric = comparisonColumns
        .find(col => col.key === '% metric_1')
        ?.formatter?.(0.123456);
      expect(formattedPercentMetric).toBe('0.123');
    });
  });

  describe('TableChart', () => {
    it('render basic data', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <TableChart {...transformProps(testData.basic)} sticky={false} />,
        </ThemeProvider>,
      );

      const firstDataRow = screen.getAllByRole('rowgroup')[1];
      const cells = firstDataRow.querySelectorAll('td');
      expect(cells).toHaveLength(12);
      expect(cells[0]).toHaveTextContent('2020-01-01 12:34:56');
      expect(cells[1]).toHaveTextContent('Michael');
      // number is not in `metrics` list, so it should output raw value
      // (in real world Superset, this would mean the column is used in GROUP BY)
      expect(cells[2]).toHaveTextContent('2467063');
      // should not render column with `.` in name as `undefined`
      expect(cells[3]).toHaveTextContent('foo');
      expect(cells[6]).toHaveTextContent('2467');
      expect(cells[8]).toHaveTextContent('N/A');
    });

    it('render advanced data', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <TableChart {...transformProps(testData.advanced)} sticky={false} />,
        </ThemeProvider>,
      );
      const secondColumnHeader = screen.getByText('Sum of Num');
      expect(secondColumnHeader).toBeInTheDocument();
      expect(secondColumnHeader?.getAttribute('data-column-name')).toEqual('1');

      const firstDataRow = screen.getAllByRole('rowgroup')[1];
      const cells = firstDataRow.querySelectorAll('td');
      expect(cells[0]).toHaveTextContent('Michael');
      expect(cells[2]).toHaveTextContent('12.346%');
      expect(cells[4]).toHaveTextContent('2.47k');
    });

    it('render advanced data with currencies', () => {
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
      expect(document.querySelectorAll('th')[1]).toHaveTextContent(
        'Sum of Num',
      );
      expect(cells[0]).toHaveTextContent('Michael');
      expect(cells[2]).toHaveTextContent('12.346%');
      expect(cells[4]).toHaveTextContent('$ 2.47k');
    });

    it('render raw data', () => {
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
      expect(cells[1]).toHaveTextContent('0');
    });

    it('render raw data with currencies', () => {
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

    it('render small formatted data with currencies', () => {
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
            data: [
              {
                num: 1234,
              },
              {
                num: 0.5,
              },
              {
                num: 0.61234,
              },
            ],
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

    it('render empty data', () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <TableChart {...transformProps(testData.empty)} sticky={false} />,
        </ThemeProvider>,
      );
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    it('render color with column color formatter', () => {
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
                      column: 'sum__num',
                      operator: '>',
                      targetValue: 2467,
                    },
                  ],
                },
              })}
            />
          ),
        }),
      );

      expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
        'rgba(172, 225, 196, 1)',
      );
      expect(getComputedStyle(screen.getByTitle('2467')).background).toBe('');
    });

    it('render cell without color', () => {
      const dataWithEmptyCell = testData.advanced.queriesData[0];
      dataWithEmptyCell.data.push({
        __timestamp: null,
        name: 'Noah',
        sum__num: null,
        '%pct_nice': 0.643,
        'abc.com': 'bazzinga',
      });

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
      expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
        '',
      );
      expect(getComputedStyle(screen.getByText('N/A')).background).toBe('');
    });
  });

  it('render cell bars properly, and only when it is toggled on in both regular and percent metrics', () => {
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
    let cells = document.querySelectorAll('div.cell-bar');
    cells.forEach(cell => {
      expect(cell).toHaveClass('positive');
    });
    props.columns[0].isMetric = false;
    props.columns[0].isPercentMetric = true;

    render(
      ProviderWrapper({
        children: <TableChart {...props} sticky={false} />,
      }),
    );
    cells = document.querySelectorAll('div.cell-bar');
    cells.forEach(cell => {
      expect(cell).toHaveClass('positive');
    });

    props.showCellBars = false;

    render(
      ProviderWrapper({
        children: <TableChart {...props} sticky={false} />,
      }),
    );
    cells = document.querySelectorAll('td');

    cells.forEach(cell => {
      expect(cell).toHaveClass('test-c7w8t3');
    });

    props.columns[0].isPercentMetric = false;
    props.columns[0].isMetric = true;

    render(
      ProviderWrapper({
        children: <TableChart {...props} sticky={false} />,
      }),
    );
    cells = document.querySelectorAll('td');
    cells.forEach(cell => {
      expect(cell).toHaveClass('test-c7w8t3');
    });
  });
});
