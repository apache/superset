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
import { ObjectFormattingEnum } from '@superset-ui/chart-controls';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@superset-ui/core/spec';
import { cloneDeep } from 'lodash';
import {
  QueryMode,
  TimeGranularity,
  SMART_DATE_ID,
  getTimeFormatterForGranularity,
} from '@superset-ui/core';
import TableChart, { sanitizeHeaderId } from '../src/TableChart';
import { GenericDataType } from '@apache-superset/core/api/core';
import transformProps from '../src/transformProps';
import DateWithFormatter from '../src/utils/DateWithFormatter';
import testData from './testData';
import { ProviderWrapper } from './testHelpers';

const expectValidAriaLabels = (container: HTMLElement) => {
  const allCells = container.querySelectorAll('tbody td');
  const cellsWithLabels = container.querySelectorAll(
    'tbody td[aria-labelledby]',
  );

  // Table must render data cells (catch empty table regression)
  expect(allCells.length).toBeGreaterThan(0);

  // ALL data cells must have aria-labelledby (no unlabeled cells)
  expect(cellsWithLabels.length).toBe(allCells.length);

  // ALL aria-labelledby values should be valid
  cellsWithLabels.forEach(cell => {
    const labelledBy = cell.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(labelledBy).toEqual(expect.stringMatching(/\S/));
    const labelledByValue = labelledBy as string;
    expect(labelledByValue).not.toMatch(/\s/);
    expect(labelledByValue).not.toMatch(/[%#△]/);
    const referencedHeader = container.querySelector(
      `#${CSS.escape(labelledByValue)}`,
    );
    expect(referencedHeader).toBeTruthy();
  });
};

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

    test('should not apply time grain formatting in Raw Records mode', () => {
      const rawRecordsProps = {
        ...testData.basic,
        rawFormData: {
          ...testData.basic.rawFormData,
          query_mode: QueryMode.Raw,
          time_grain_sqla: TimeGranularity.MONTH,
          table_timestamp_format: SMART_DATE_ID,
        },
      };

      const transformedProps = transformProps(rawRecordsProps);
      const timestampColumn = transformedProps.columns.find(
        col => col.key === '__timestamp',
      );

      expect(timestampColumn).toBeDefined();
      const testValue = new Date('2023-01-15T10:30:45');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = (timestampColumn?.formatter as any)?.(testValue);
      const granularityFormatted = getTimeFormatterForGranularity(
        TimeGranularity.MONTH,
      )(testValue as number | Date | null);
      expect(formatted).not.toBe(granularityFormatted);
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('2023');
    });

    test('should handle null/undefined timestamp values correctly', () => {
      const rawRecordsProps = {
        ...testData.basic,
        rawFormData: {
          ...testData.basic.rawFormData,
          query_mode: QueryMode.Raw,
        },
      };

      const transformedProps = transformProps(rawRecordsProps);
      expect(transformedProps.isRawRecords).toBe(true);

      const timestampColumn = transformedProps.columns.find(
        col => col.key === '__timestamp',
      );
      expect(timestampColumn).toBeDefined();
    });

    describe('TableChart', () => {
      test('render basic data', () => {
        render(
          <TableChart {...transformProps(testData.basic)} sticky={false} />,
        );

        const firstDataRow = screen.getAllByRole('rowgroup')[1];
        const cells = firstDataRow.querySelectorAll('td');
        expect(cells).toHaveLength(12);
        // Date is rendered as ISO string format
        expect(cells[0]).toHaveTextContent('2020-01-01T12:34:56');
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

        render(<TableChart {...props} sticky={false} />);

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
      });

      test('should validate ARIA references for time-comparison table cells', () => {
        // Test that ALL cells with aria-labelledby have valid references
        // This is critical for screen reader accessibility
        const props = transformProps(testData.comparison);

        const { container } = render(<TableChart {...props} sticky={false} />);

        expectValidAriaLabels(container);
      });

      test('should align group headers correctly when some comparison columns are hidden (#37074)', () => {
        // Test that group headers align correctly when columns have visible: false
        // This reproduces issue #37074 where headers became misaligned
        const props = transformProps(testData.comparisonWithHiddenColumns);

        const { container } = render(<TableChart {...props} sticky={false} />);

        // Get all header rows - first row contains group headers, second row contains column headers
        const headerRows = container.querySelectorAll('thead tr');
        expect(headerRows.length).toBe(2);

        // Get group headers from the first row (th elements with colSpan > 1 or group headers)
        const groupHeaderRow = headerRows[0];
        const groupHeaders = groupHeaderRow.querySelectorAll('th');

        // Extract group header text content (filter out empty placeholder headers)
        const groupHeaderTexts = Array.from(groupHeaders)
          .map(th => th.textContent?.trim())
          .filter(text => text && text.length > 0);

        // Verify metric_1 group header appears before metric_2
        // With hidden columns: metric_1 has 2 visible columns (△, %), metric_2 has 4 (Main, #, △, %)
        const metric1Index = groupHeaderTexts.findIndex(
          text => text?.includes('metric_1') || text?.includes('Metric 1'),
        );
        const metric2Index = groupHeaderTexts.findIndex(
          text => text?.includes('metric_2') || text?.includes('Metric 2'),
        );

        // Both headers should exist and metric_1 should come before metric_2
        expect(metric1Index).toBeGreaterThanOrEqual(0);
        expect(metric2Index).toBeGreaterThanOrEqual(0);
        expect(metric1Index).toBeLessThan(metric2Index);

        // Verify colSpan values match the number of visible columns
        const metric1Header = Array.from(groupHeaders).find(
          th =>
            th.textContent?.includes('metric_1') ||
            th.textContent?.includes('Metric 1'),
        );
        const metric2Header = Array.from(groupHeaders).find(
          th =>
            th.textContent?.includes('metric_2') ||
            th.textContent?.includes('Metric 2'),
        );

        // metric_1 should span 2 columns (△ and % are visible, Main and # are hidden)
        expect(metric1Header?.getAttribute('colspan')).toBe('2');
        // metric_2 should span 4 columns (all visible)
        expect(metric2Header?.getAttribute('colspan')).toBe('4');

        // Verify ARIA labels are still valid after filtering
        expectValidAriaLabels(container);
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
      });

      test('should validate ARIA references for regular table cells', () => {
        // Test that ALL cells with aria-labelledby have valid references
        // This is critical for screen reader accessibility
        const props = transformProps(testData.advanced);

        const { container } = render(
          ProviderWrapper({
            children: <TableChart {...props} sticky={false} />,
          }),
        );

        expectValidAriaLabels(container);
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

      test('render cell bars even when column contains NULL values', () => {
        const props = transformProps({
          ...testData.raw,
          queriesData: [
            {
              ...testData.raw.queriesData[0],
              colnames: ['category', 'value1', 'value2', 'value3', 'value4'],
              coltypes: [
                GenericDataType.String,
                GenericDataType.Numeric,
                GenericDataType.Numeric,
                GenericDataType.Numeric,
                GenericDataType.Numeric,
              ],
              data: [
                {
                  category: 'Category A',
                  value1: 10,
                  value2: 20,
                  value3: 30,
                  value4: null,
                },
                {
                  category: 'Category B',
                  value1: 15,
                  value2: 25,
                  value3: 35,
                  value4: 100,
                },
                {
                  category: 'Category C',
                  value1: 18,
                  value2: 28,
                  value3: 38,
                  value4: null,
                },
              ],
            },
          ],
          rawFormData: {
            ...testData.raw.rawFormData,
            show_cell_bars: true,
            metrics: ['value1', 'value2', 'value3', 'value4'],
          },
        });

        const { container } = render(
          ProviderWrapper({
            children: <TableChart {...props} sticky={false} />,
          }),
        );

        // Get all cell bars - should exist for both columns with and without NULL values
        const cellBars = container.querySelectorAll('div.cell-bar');

        // Should have cell bars in all numeric columns, even those with NULL values
        // value1, value2, value3 all have 3 values, value4 has 1 non-NULL value
        // Total: 3 + 3 + 3 + 1 = 10 cell bars
        expect(cellBars.length).toBeGreaterThan(0);

        // Specifically check that value4 column (which has NULLs) still renders bars for non-NULL cells
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBe(3);

        // Row 2 should have a cell bar in value4 column (value: 100)
        const row2Cells = rows[1].querySelectorAll('td');
        const value4Cell = row2Cells[4]; // 5th column (0-indexed)
        const value4Bar = value4Cell.querySelector('div.cell-bar');
        expect(value4Bar).toBeTruthy();
      });

      test('render color with string column color formatter(operator begins with)', () => {
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
                        operator: 'begins with',
                        targetValue: 'J',
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
          '',
        );
      });

      test('render color with string column color formatter (operator ends with)', () => {
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
                        operator: 'ends with',
                        targetValue: 'ia',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        expect(getComputedStyle(screen.getByText('Maria')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('Joe')).background).toBe('');
      });

      test('render color with string column color formatter (operator containing)', () => {
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
                        operator: 'containing',
                        targetValue: 'c',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        expect(getComputedStyle(screen.getByText('Michael')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('Joe')).background).toBe('');
      });

      test('render color with string column color formatter (operator not containing)', () => {
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
                        operator: 'not containing',
                        targetValue: 'i',
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
          '',
        );
      });

      test('render color with string column color formatter (operator =)', () => {
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
                        operator: '=',
                        targetValue: 'Joe',
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
          '',
        );
      });

      test('render color with string column color formatter (operator None)', () => {
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

      test('render color with boolean column color formatter (operator is true)', () => {
        render(
          ProviderWrapper({
            children: (
              <TableChart
                {...transformProps({
                  ...testData.nameAndBoolean,
                  rawFormData: {
                    ...testData.nameAndBoolean.rawFormData,
                    conditional_formatting: [
                      {
                        colorScheme: '#ACE1C4',
                        column: 'is_adult',
                        operator: 'is true',
                        targetValue: '',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        expect(getComputedStyle(screen.getByText('true')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('false')).background).toBe('');
      });

      test('render color with boolean column color formatter (operator is false)', () => {
        render(
          ProviderWrapper({
            children: (
              <TableChart
                {...transformProps({
                  ...testData.nameAndBoolean,
                  rawFormData: {
                    ...testData.nameAndBoolean.rawFormData,
                    conditional_formatting: [
                      {
                        colorScheme: '#ACE1C4',
                        column: 'is_adult',
                        operator: 'is false',
                        targetValue: '',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        expect(getComputedStyle(screen.getByText('false')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('true')).background).toBe('');
      });

      test('render color with boolean column color formatter (operator is null)', () => {
        render(
          ProviderWrapper({
            children: (
              <TableChart
                {...transformProps({
                  ...testData.nameAndBoolean,
                  rawFormData: {
                    ...testData.nameAndBoolean.rawFormData,
                    conditional_formatting: [
                      {
                        colorScheme: '#ACE1C4',
                        column: 'is_adult',
                        operator: 'is null',
                        targetValue: '',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        expect(getComputedStyle(screen.getByText('N/A')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('true')).background).toBe('');
        expect(getComputedStyle(screen.getByText('false')).background).toBe('');
      });

      test('render color with boolean column color formatter (operator is not null)', () => {
        render(
          ProviderWrapper({
            children: (
              <TableChart
                {...transformProps({
                  ...testData.nameAndBoolean,
                  rawFormData: {
                    ...testData.nameAndBoolean.rawFormData,
                    conditional_formatting: [
                      {
                        colorScheme: '#ACE1C4',
                        column: 'is_adult',
                        operator: 'is not null',
                        targetValue: '',
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );
        const trueElements = screen.getAllByText('true');
        const falseElements = screen.getAllByText('false');
        expect(getComputedStyle(trueElements[0]).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(falseElements[0]).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByText('N/A')).background).toBe('');
      });

      test('render color with column color formatter to entire row', () => {
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
                        columnFormatting: ObjectFormattingEnum.ENTIRE_ROW,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        expect(getComputedStyle(screen.getByText('Michael')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('0.123456')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
      });

      test('display text color using column color formatter', () => {
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
                        objectFormatting: ObjectFormattingEnum.TEXT_COLOR,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        expect(getComputedStyle(screen.getByTitle('2467063')).color).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('2467')).color).toBe(
          'rgba(0, 0, 0, 0.88)',
        );
      });

      test('display text color using column color formatter for entire row', () => {
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
                        columnFormatting: ObjectFormattingEnum.ENTIRE_ROW,
                        objectFormatting: ObjectFormattingEnum.TEXT_COLOR,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        expect(getComputedStyle(screen.getByText('Michael')).color).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('2467063')).color).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('0.123456')).color).toBe(
          'rgba(172, 225, 196, 1)',
        );
      });

      test('render color with useGradient false returns solid color', () => {
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
                        useGradient: false,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        // When useGradient is false, should return solid color (no opacity variation)
        // The color should be the same for all matching values
        expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
          'rgb(172, 225, 196)',
        );
        expect(getComputedStyle(screen.getByTitle('2467')).background).toBe('');
      });

      test('render color with useGradient true returns gradient color', () => {
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
                        useGradient: true,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        // When useGradient is true, should return gradient color with opacity
        expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('2467')).background).toBe('');
      });

      test('render color with useGradient undefined defaults to gradient (backward compatibility)', () => {
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

        // When useGradient is undefined, should default to gradient for backward compatibility
        expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
          'rgba(172, 225, 196, 1)',
        );
        expect(getComputedStyle(screen.getByTitle('2467')).background).toBe('');
      });

      test('render color with useGradient false and None operator returns solid color', () => {
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
                        operator: 'None',
                        useGradient: false,
                      },
                    ],
                  },
                })}
              />
            ),
          }),
        );

        // When useGradient is false with None operator, all values should have solid color
        expect(getComputedStyle(screen.getByTitle('2467063')).background).toBe(
          'rgb(172, 225, 196)',
        );
        expect(getComputedStyle(screen.getByTitle('2467')).background).toBe(
          'rgb(172, 225, 196)',
        );
      });

      test('recalculates totals when user filters data', async () => {
        const formDataWithTotals = {
          ...testData.basic.formData,
          show_totals: true,
          include_search: true,
          server_pagination: false,
          metrics: ['sum__num'],
        };

        const { data } = testData.basic.queriesData[0];
        const totalBeforeFilter = data.reduce(
          (sum, row) => sum + Number(row.sum__num || 0),
          0,
        );
        const totalAfterFilter =
          data.find(item => item.name === 'Michael')?.sum__num || 0;

        const props = transformProps({
          ...testData.basic,
          formData: formDataWithTotals,
        });
        props.totals = { sum__num: totalBeforeFilter };
        props.includeSearch = true;
        render(
          <ProviderWrapper>
            <TableChart {...props} sticky={false} />
          </ProviderWrapper>,
        );

        const table = screen.getByRole('table');
        const totalCellBefore = within(table).getByText(
          String(totalBeforeFilter),
        );
        expect(totalCellBefore).toBeInTheDocument();

        const searchInput = screen.getByRole('textbox');
        fireEvent.change(searchInput, { target: { value: 'Michael' } });

        await waitFor(() => {
          const totalCellAfter = within(table).getByText(
            String(totalAfterFilter),
          );
          expect(totalCellAfter).toBeInTheDocument();
        });
      });
    });
  });
});
