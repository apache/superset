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
import { cloneDeep } from 'lodash';
import TableChart, { sanitizeHeaderId } from '../src/TableChart';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';
import { ProviderWrapper } from './testHelpers';

test('sanitizeHeaderId should sanitize percent sign', () => {
  expect(sanitizeHeaderId('%pct_nice')).toBe('percentpct_nice');
});

test('sanitizeHeaderId should sanitize hash/pound sign', () => {
  expect(sanitizeHeaderId('# metric_1')).toBe('hash_metric_1');
});

test('sanitizeHeaderId should sanitize delta symbol', () => {
  expect(sanitizeHeaderId('△ delta')).toBe('delta_delta');
});

test('sanitizeHeaderId should replace spaces with underscores', () => {
  expect(sanitizeHeaderId('Main metric_1')).toBe('Main_metric_1');
  expect(sanitizeHeaderId('multiple  spaces')).toBe('multiple_spaces');
});

test('sanitizeHeaderId should handle multiple special characters', () => {
  expect(sanitizeHeaderId('% #△ test')).toBe('percent_hashdelta_test');
  expect(sanitizeHeaderId('% # △ test')).toBe('percent_hash_delta_test');
});

test('sanitizeHeaderId should preserve alphanumeric, underscore, and hyphen', () => {
  expect(sanitizeHeaderId('valid-name_123')).toBe('valid-name_123');
});

test('sanitizeHeaderId should replace other special characters with underscore', () => {
  expect(sanitizeHeaderId('col@name!test')).toBe('col_name_test');
  expect(sanitizeHeaderId('test.column')).toBe('test_column');
});

test('sanitizeHeaderId should handle edge cases', () => {
  expect(sanitizeHeaderId('')).toBe('');
  expect(sanitizeHeaderId('simple')).toBe('simple');
});

test('sanitizeHeaderId should collapse consecutive underscores', () => {
  expect(sanitizeHeaderId('test @@ space')).toBe('test_space');
  expect(sanitizeHeaderId('col___name')).toBe('col_name');
  expect(sanitizeHeaderId('a  b  c')).toBe('a_b_c');
  expect(sanitizeHeaderId('test@@name')).toBe('test_name');
});

test('sanitizeHeaderId should remove leading underscores', () => {
  expect(sanitizeHeaderId('@col')).toBe('col');
  expect(sanitizeHeaderId('!revenue')).toBe('revenue');
  expect(sanitizeHeaderId('@@test')).toBe('test');
  expect(sanitizeHeaderId('   leading_spaces')).toBe('leading_spaces');
});

test('sanitizeHeaderId should remove trailing underscores', () => {
  expect(sanitizeHeaderId('col@')).toBe('col');
  expect(sanitizeHeaderId('revenue!')).toBe('revenue');
  expect(sanitizeHeaderId('test@@')).toBe('test');
  expect(sanitizeHeaderId('trailing_spaces   ')).toBe('trailing_spaces');
});

test('sanitizeHeaderId should remove leading and trailing underscores', () => {
  expect(sanitizeHeaderId('@col@')).toBe('col');
  expect(sanitizeHeaderId('!test!')).toBe('test');
  expect(sanitizeHeaderId('  spaced  ')).toBe('spaced');
  expect(sanitizeHeaderId('@@multiple@@')).toBe('multiple');
});

test('sanitizeHeaderId should handle inputs with only special characters', () => {
  expect(sanitizeHeaderId('@')).toBe('');
  expect(sanitizeHeaderId('@@')).toBe('');
  expect(sanitizeHeaderId('   ')).toBe('');
  expect(sanitizeHeaderId('!@$')).toBe('');
  expect(sanitizeHeaderId('!@#$')).toBe('hash'); // # is replaced with 'hash' (semantic replacement)
  // Semantic replacements produce readable output even when alone
  expect(sanitizeHeaderId('%')).toBe('percent');
  expect(sanitizeHeaderId('#')).toBe('hash');
  expect(sanitizeHeaderId('△')).toBe('delta');
  expect(sanitizeHeaderId('% # △')).toBe('percent_hash_delta');
});

describe('plugin-chart-table', () => {
  describe('transformProps', () => {
    test('should parse pageLength to pageSize', () => {
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

    test('should memoize data records', () => {
      expect(transformProps(testData.basic).data).toBe(
        transformProps(testData.basic).data,
      );
    });

    test('should memoize columns meta', () => {
      expect(transformProps(testData.basic).columns).toBe(
        transformProps({
          ...testData.basic,
          rawFormData: { ...testData.basic.rawFormData, pageLength: null },
        }).columns,
      );
    });

    test('should format timestamp', () => {
      // eslint-disable-next-line no-underscore-dangle
      const parsedDate = transformProps(testData.basic).data[0]
        .__timestamp as DateWithFormatter;
      expect(String(parsedDate)).toBe('2020-01-01 12:34:56');
      expect(parsedDate.getTime()).toBe(1577882096000);
    });
    test('should process comparison columns when time_compare and comparison_type are set', () => {
      const transformedProps = transformProps(testData.comparison);
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.originalLabel === 'metric_1' ||
          col.originalLabel === 'metric_2' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );
      expect(comparisonColumns.length).toBeGreaterThan(0);
      expect(
        comparisonColumns.some(col => col.originalLabel === 'metric_1'),
      ).toBe(true);
      expect(
        comparisonColumns.some(col => col.originalLabel === 'metric_2'),
      ).toBe(true);
      expect(comparisonColumns.some(col => col.label === '#')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '△')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '%')).toBe(true);
    });

    test('should not process comparison columns when time_compare is empty', () => {
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

    test('should correctly apply column configuration for comparison columns', () => {
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

    test('should correctly format comparison columns using getComparisonColFormatter', () => {
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

    test('should set originalLabel for comparison columns when time_compare and comparison_type are set', () => {
      const transformedProps = transformProps(testData.comparison);

      // Check if comparison columns are processed
      // Now we're looking for columns with metric names as labels
      const comparisonColumns = transformedProps.columns.filter(
        col =>
          col.originalLabel === 'metric_1' ||
          col.originalLabel === 'metric_2' ||
          col.label === '#' ||
          col.label === '△' ||
          col.label === '%',
      );

      expect(comparisonColumns.length).toBeGreaterThan(0);
      expect(
        comparisonColumns.some(col => col.originalLabel === 'metric_1'),
      ).toBe(true);
      expect(
        comparisonColumns.some(col => col.originalLabel === 'metric_2'),
      ).toBe(true);
      expect(comparisonColumns.some(col => col.label === '#')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '△')).toBe(true);
      expect(comparisonColumns.some(col => col.label === '%')).toBe(true);
      // Verify originalLabel for metric_1 comparison columns
      const metric1Column = transformedProps.columns.find(
        col =>
          col.originalLabel === 'metric_1' &&
          !col.key.startsWith('#') &&
          !col.key.startsWith('△') &&
          !col.key.startsWith('%'),
      );
      expect(metric1Column).toBeDefined();
      expect(metric1Column?.originalLabel).toBe('metric_1');
      expect(metric1Column?.label).toBe('Main');

      const hashMetric1 = transformedProps.columns.find(
        col => col.key === '# metric_1',
      );
      expect(hashMetric1).toBeDefined();
      expect(hashMetric1?.originalLabel).toBe('metric_1');

      const deltaMetric1 = transformedProps.columns.find(
        col => col.key === '△ metric_1',
      );
      expect(deltaMetric1).toBeDefined();
      expect(deltaMetric1?.originalLabel).toBe('metric_1');

      const percentMetric1 = transformedProps.columns.find(
        col => col.key === '% metric_1',
      );
      expect(percentMetric1).toBeDefined();
      expect(percentMetric1?.originalLabel).toBe('metric_1');

      // Verify originalLabel for metric_2 comparison columns
      const metric2Column = transformedProps.columns.find(
        col =>
          col.originalLabel === 'metric_2' &&
          !col.key.startsWith('#') &&
          !col.key.startsWith('△') &&
          !col.key.startsWith('%'),
      );
      expect(metric2Column).toBeDefined();
      expect(metric2Column?.originalLabel).toBe('metric_2');

      expect(metric2Column?.label).toBe('Main');

      const hashMetric2 = transformedProps.columns.find(
        col => col.key === '# metric_2',
      );
      expect(hashMetric2).toBeDefined();
      expect(hashMetric2?.originalLabel).toBe('metric_2');

      const deltaMetric2 = transformedProps.columns.find(
        col => col.key === '△ metric_2',
      );
      expect(deltaMetric2).toBeDefined();
      expect(deltaMetric2?.originalLabel).toBe('metric_2');

      const percentMetric2 = transformedProps.columns.find(
        col => col.key === '% metric_2',
      );
      expect(percentMetric2).toBeDefined();
      expect(percentMetric2?.originalLabel).toBe('metric_2');
    });

    describe('TableChart', () => {
      test('render basic data', () => {
        render(
          <TableChart {...transformProps(testData.basic)} sticky={false} />,
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

      test('render advanced data', () => {
        render(
          <TableChart {...transformProps(testData.advanced)} sticky={false} />,
        );
        const secondColumnHeader = screen.getByText('Sum of Num');
        expect(secondColumnHeader).toBeInTheDocument();
        expect(secondColumnHeader?.getAttribute('data-column-name')).toEqual(
          '1',
        );

        const firstDataRow = screen.getAllByRole('rowgroup')[1];
        const cells = firstDataRow.querySelectorAll('td');
        expect(cells[0]).toHaveTextContent('Michael');
        expect(cells[2]).toHaveTextContent('12.346%');
        expect(cells[4]).toHaveTextContent('2.47k');
      });

      test('render advanced data with currencies', () => {
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

      test('render data with a bigint value in a raw record mode', () => {
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

      test('render raw data', () => {
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

      test('render raw data with currencies', () => {
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

      test('render small formatted data with currencies', () => {
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

      test('render empty data', () => {
        render(
          <TableChart {...transformProps(testData.empty)} sticky={false} />,
        );
        expect(screen.getByText('No records found')).toBeInTheDocument();
      });

      test('render color with column color formatter', () => {
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

      test('render cell without color', () => {
        const dataWithEmptyCell = cloneDeep(testData.advanced.queriesData[0]);
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
      test('should display original label in grouped headers', () => {
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

      test('should set meaningful header IDs for time-comparison columns', () => {
        // Test time-comparison columns have proper IDs
        // Uses originalLabel (e.g., "metric_1") which is sanitized for CSS safety
        const props = transformProps(testData.comparison);

        const { container } = render(<TableChart {...props} sticky={false} />);

        const headers = screen.getAllByRole('columnheader');

        // All headers should have IDs
        const headersWithIds = headers.filter(header => header.id);
        expect(headersWithIds.length).toBeGreaterThan(0);

        // None should have "header-undefined"
        const undefinedHeaders = headersWithIds.filter(header =>
          header.id.includes('undefined'),
        );
        expect(undefinedHeaders).toHaveLength(0);

        // Should have IDs based on sanitized originalLabel (e.g., "metric_1")
        const hasMetricHeaders = headersWithIds.some(
          header =>
            header.id.includes('metric_1') || header.id.includes('metric_2'),
        );
        expect(hasMetricHeaders).toBe(true);

        // CRITICAL: Verify sanitization - no spaces or special chars in any header ID
        headersWithIds.forEach(header => {
          // IDs must not contain spaces (would break CSS selectors and ARIA)
          expect(header.id).not.toMatch(/\s/);
          // IDs must not contain special chars like %, #, △
          expect(header.id).not.toMatch(/[%#△]/);
          // IDs should only contain valid characters: alphanumeric, underscore, hyphen
          expect(header.id).toMatch(/^header-[a-zA-Z0-9_-]+$/);
        });

        // CRITICAL: Verify ALL cells reference valid headers (no broken ARIA)
        const cellsWithLabels = container.querySelectorAll(
          'td[aria-labelledby]',
        );
        cellsWithLabels.forEach(cell => {
          const labelledBy = cell.getAttribute('aria-labelledby');
          // Cells with aria-labelledby must have a valid ID
          expect(labelledBy).toBeTruthy();
          // Check that the ID doesn't contain spaces (would be interpreted as multiple IDs)
          expect(labelledBy).not.toMatch(/\s/);
          // Check that the ID doesn't contain special characters
          expect(labelledBy).not.toMatch(/[%#△]/);
          // Verify the referenced header actually exists
          const referencedHeader = container.querySelector(
            `#${CSS.escape(labelledBy!)}`,
          );
          expect(referencedHeader).toBeTruthy();
        });
      });

      test('should set meaningful header IDs for regular table columns', () => {
        // Test regular (non-time-comparison) columns have proper IDs
        // Uses fallback to column.key since originalLabel is undefined
        const props = transformProps(testData.advanced);

        const { container } = render(
          ProviderWrapper({
            children: <TableChart {...props} sticky={false} />,
          }),
        );

        const headers = screen.getAllByRole('columnheader');

        // Test 1: "name" column (regular string column)
        const nameHeader = headers.find(header =>
          header.textContent?.includes('name'),
        );
        expect(nameHeader).toBeDefined();
        expect(nameHeader?.id).toBe('header-name'); // Falls back to column.key

        // Verify cells reference this header correctly
        const nameCells = container.querySelectorAll(
          'td[aria-labelledby="header-name"]',
        );
        expect(nameCells.length).toBeGreaterThan(0);

        // Test 2: "sum__num" column (metric with verbose map "Sum of Num")
        const sumHeader = headers.find(header =>
          header.textContent?.includes('Sum of Num'),
        );
        expect(sumHeader).toBeDefined();
        expect(sumHeader?.id).toBe('header-sum_num'); // Falls back to column.key, consecutive underscores collapsed

        // Verify cells reference this header correctly
        const sumCells = container.querySelectorAll(
          'td[aria-labelledby="header-sum_num"]',
        );
        expect(sumCells.length).toBeGreaterThan(0);

        // Test 3: Verify NO headers have "undefined" in their ID
        const undefinedHeaders = headers.filter(header =>
          header.id?.includes('undefined'),
        );
        expect(undefinedHeaders).toHaveLength(0);

        // Test 4: Verify ALL headers have proper IDs (no missing IDs)
        const headersWithIds = headers.filter(header => header.id);
        expect(headersWithIds.length).toBe(headers.length);

        // Test 5: Verify ALL header IDs are properly sanitized
        headersWithIds.forEach(header => {
          // IDs must not contain spaces
          expect(header.id).not.toMatch(/\s/);
          // IDs must not contain special chars like % (from %pct_nice column)
          expect(header.id).not.toMatch(/[%#△]/);
          // IDs should only contain valid CSS selector characters
          expect(header.id).toMatch(/^header-[a-zA-Z0-9_-]+$/);
        });

        // Test 6: Verify ALL cells reference valid headers (no broken ARIA)
        const cellsWithLabels = container.querySelectorAll(
          'td[aria-labelledby]',
        );
        cellsWithLabels.forEach(cell => {
          const labelledBy = cell.getAttribute('aria-labelledby');
          // Cells with aria-labelledby must have a valid ID
          expect(labelledBy).toBeTruthy();
          // Verify no spaces (would be interpreted as multiple IDs)
          expect(labelledBy).not.toMatch(/\s/);
          // Verify no special characters
          expect(labelledBy).not.toMatch(/[%#△]/);
          // Verify the referenced header actually exists
          const referencedHeader = container.querySelector(
            `#${CSS.escape(labelledBy!)}`,
          );
          expect(referencedHeader).toBeTruthy();
        });
      });

      test('render cell bars properly, and only when it is toggled on in both regular and percent metrics', () => {
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

        props.columns[0].isPercentMetric = false;
        props.columns[0].isMetric = true;

        render(
          ProviderWrapper({
            children: <TableChart {...props} sticky={false} />,
          }),
        );
        cells = document.querySelectorAll('td');
      });
    });
  });
});
