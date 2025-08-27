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
import {
  DatasourceType,
  ChartProps,
  Behavior,
  supersetTheme,
  Metric,
} from '@superset-ui/core';
import { transformProps, TableChartProps } from './transformProps';

interface ExtendedMetric extends Omit<Metric, 'uuid'> {
  uuid?: string;
  label?: string;
}

const createMockDatasource = () => {
  const metrics: ExtendedMetric[] = [
    {
      uuid: '1',
      metric_name: 'SUM(sales)',
      verbose_name: 'Sum of Sales',
      label: 'Sum of Sales',
      expression: 'SUM(sales)',
      warning_text: null,
      description: null,
      d3format: null,
      is_certified: false,
      certified_by: null,
      certification_details: null,
    },
    {
      uuid: '2',
      metric_name: 'AVG(price)',
      verbose_name: 'Average Price',
      label: 'Average Price', // Additional field for transformProps
      expression: 'AVG(price)',
      warning_text: null,
      description: null,
      d3format: null,
      is_certified: false,
      certified_by: null,
      certification_details: null,
    },
  ];

  return {
    id: 1,
    name: 'test_datasource',
    type: DatasourceType.Table,
    columns: [],
    metrics: metrics.map(metric => ({
      ...metric,
      uuid: metric.uuid!,
    })) as Metric[],
    verboseMap: {},
    columnFormats: {},
    currencyFormats: {},
  };
};

function createMockChartProps(
  overrides: Partial<TableChartProps> = {},
): TableChartProps {
  const mockDatasource = createMockDatasource();

  const defaultFormData = {
    columnCollection: [],
    groupby: [],
    metrics: [{ label: 'SUM(sales)', metric_name: 'SUM(sales)' }] as object[],
    url: 'http://example.com',
  };

  const defaultQueryData = [
    {
      data: {
        records: [
          { time: '2023-01-01', 'SUM(sales)': 1000 },
          { time: '2023-01-02', 'SUM(sales)': 2000 },
        ],
        columns: ['time', 'SUM(sales)'],
      },
    },
  ];

  const baseChartProps = new ChartProps({
    annotationData: {},
    datasource: mockDatasource,
    initialValues: {},
    formData: defaultFormData,
    height: 400,
    hooks: {},
    ownState: {},
    filterState: {},
    queriesData: defaultQueryData,
    width: 800,
    behaviors: [] as Behavior[],
    theme: supersetTheme,
  });

  const tableChartProps: TableChartProps = {
    ...baseChartProps,
    formData: {
      ...defaultFormData,
      ...overrides.formData,
    },
    queriesData: overrides.queriesData || defaultQueryData,
    datasource: overrides.datasource || mockDatasource,
  };

  return tableChartProps;
}

describe('TimeTable transformProps', () => {
  test('should transform props correctly for metric rows', () => {
    const props = createMockChartProps();
    const result = transformProps(props);

    expect(result).toMatchObject({
      height: 400,
      data: [
        { time: '2023-01-01', 'SUM(sales)': 1000 },
        { time: '2023-01-02', 'SUM(sales)': 2000 },
      ],
      columnConfigs: [],
      rowType: 'metric',
      url: 'http://example.com',
    });

    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toMatchObject({
      metric_name: 'SUM(sales)',
      label: 'SUM(sales)',
    });
  });

  test('should transform props correctly for column rows (groupby)', () => {
    const props = createMockChartProps({
      formData: {
        columnCollection: [],
        groupby: ['category'],
        metrics: [] as object[],
        url: 'http://example.com',
      },
      queriesData: [
        {
          data: {
            records: [
              { time: '2023-01-01', category: 'A', value: 100 },
              { time: '2023-01-02', category: 'B', value: 200 },
            ],
            columns: [
              { column_name: 'category', id: 1 },
              { column_name: 'value', id: 2 },
            ],
          },
        },
      ],
    });

    const result = transformProps(props);

    expect(result.rowType).toBe('column');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(2);
  });

  test('should handle string columns correctly', () => {
    const props = createMockChartProps({
      formData: {
        columnCollection: [],
        groupby: ['category'],
        metrics: [
          { label: 'SUM(sales)', metric_name: 'SUM(sales)' },
        ] as object[],
        url: 'http://example.com',
      },
      queriesData: [
        {
          data: {
            records: [],
            columns: ['category', 'value'], // string columns
          },
        },
      ],
    });

    const result = transformProps(props);

    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual({ label: 'category' });
    expect(result.rows[1]).toEqual({ label: 'value' });
  });

  test('should handle column collection with time lag conversion', () => {
    const props = createMockChartProps({
      formData: {
        columnCollection: [
          {
            key: 'test1',
            timeLag: '5',
          },
          {
            key: 'test2',
            timeLag: 10,
          },
          {
            key: 'test3',
            timeLag: '',
          },
        ],
        groupby: [],
        metrics: [
          { label: 'SUM(sales)', metric_name: 'SUM(sales)' },
        ] as object[],
        url: 'http://example.com',
      },
    });

    const result = transformProps(props);

    expect(result.columnConfigs).toBeDefined();
    expect(result.columnConfigs.length).toBe(3);
    expect(result.columnConfigs[0]).toHaveProperty('timeLag', 5);
    expect(result.columnConfigs[1]).toHaveProperty('timeLag', 10);
    expect(result.columnConfigs[2]).toHaveProperty('timeLag', '');
  });

  test('should handle empty metrics array', () => {
    const props = createMockChartProps({
      formData: {
        columnCollection: [],
        groupby: [],
        metrics: [] as object[],
        url: 'http://example.com',
      },
    });

    const result = transformProps(props);

    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(0);
  });

  test('should handle missing metrics in datasource', () => {
    const props = createMockChartProps({
      formData: {
        columnCollection: [],
        groupby: [],
        metrics: [
          { label: 'NONEXISTENT_METRIC', metric_name: 'NONEXISTENT_METRIC' },
        ] as object[],
        url: 'http://example.com',
      },
    });

    const result = transformProps(props);

    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toMatchObject({
      label: 'NONEXISTENT_METRIC',
      metric_name: 'NONEXISTENT_METRIC',
    });
  });
});
