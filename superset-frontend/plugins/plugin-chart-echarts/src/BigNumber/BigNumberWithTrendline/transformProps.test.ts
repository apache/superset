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
import { GenericDataType } from '@superset-ui/core';
import transformProps from './transformProps';
import { BigNumberWithTrendlineChartProps, BigNumberDatum } from '../types';

// Mock chart-controls to avoid styled-components issues in Jest
jest.mock('@superset-ui/chart-controls', () => ({
  aggregationChoices: {
    raw: {
      label: 'Force server-side aggregation',
      compute: (data: number[]) => data[0] ?? null,
    },
    LAST_VALUE: {
      label: 'Last Value',
      compute: (data: number[]) => data[0] ?? null,
    },
    sum: {
      label: 'Total (Sum)',
      compute: (data: number[]) => data.reduce((a, b) => a + b, 0),
    },
    mean: {
      label: 'Average (Mean)',
      compute: (data: number[]) =>
        data.reduce((a, b) => a + b, 0) / data.length,
    },
    min: { label: 'Minimum', compute: (data: number[]) => Math.min(...data) },
    max: { label: 'Maximum', compute: (data: number[]) => Math.max(...data) },
    median: {
      label: 'Median',
      compute: (data: number[]) => {
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      },
    },
  },
}));

jest.mock('@superset-ui/core', () => ({
  GenericDataType: { Temporal: 2, String: 1 },
  extractTimegrain: jest.fn(() => 'P1D'),
  getMetricLabel: jest.fn(metric => metric),
  getXAxisLabel: jest.fn(() => '__timestamp'),
  getValueFormatter: jest.fn(() => ({
    format: (v: number) => `$${v}`,
  })),
  getNumberFormatter: jest.fn(() => (v: number) => `${(v * 100).toFixed(1)}%`),
  t: jest.fn(v => v),
  tooltipHtml: jest.fn(() => '<div>tooltip</div>'),
  NumberFormats: {
    PERCENT_SIGNED_1_POINT: '.1%',
  },
}));

jest.mock('../utils', () => ({
  getDateFormatter: jest.fn(() => (v: any) => `${v}pm`),
  parseMetricValue: jest.fn(val => Number(val)),
  getOriginalLabel: jest.fn((metric, metrics) => {
    console.log(metrics);
    return metric;
  }),
}));

jest.mock('../../utils/tooltip', () => ({
  getDefaultTooltip: jest.fn(() => ({})),
}));

describe('BigNumberWithTrendline transformProps', () => {
  const onContextMenu = jest.fn();
  const baseFormData = {
    headerFontSize: 20,
    metric: 'value',
    subtitle: 'subtitle message',
    subtitleFontSize: 14,
    forceTimestampFormatting: false,
    timeFormat: 'YYYY-MM-DD',
    yAxisFormat: 'SMART_NUMBER',
    compareLag: 1,
    compareSuffix: 'WoW',
    colorPicker: { r: 0, g: 0, b: 0 },
    currencyFormat: { symbol: '$', symbolPosition: 'prefix' },
  };

  const baseDatasource = {
    currencyFormats: { value: '$0,0.00' },
    columnFormats: { value: '$0,0.00' },
    metrics: [{ metric_name: 'value', d3format: '.2f' }],
  };

  const baseHooks = { onContextMenu };
  const baseRawFormData = { dummy: 'raw' };

  it('should return null bigNumber when no data is provided', () => {
    const chartProps = {
      width: 400,
      height: 300,
      queriesData: [{ data: [] as unknown as BigNumberDatum[], coltypes: [] }],
      formData: baseFormData,
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.bigNumber).toBeNull();
    expect(result.subtitle).toBe('subtitle message');
  });

  it('should calculate subheader as percent change with suffix', () => {
    const chartProps = {
      width: 500,
      height: 400,
      queriesData: [
        {
          data: [
            { __timestamp: 2, value: 110 },
            { __timestamp: 1, value: 100 },
          ] as unknown as BigNumberDatum[],
          colnames: ['__timestamp', 'value'],
          coltypes: ['TEMPORAL', 'NUMERIC'],
        },
      ],
      formData: baseFormData,
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.subheader).toBe('10.0% WoW');
  });

  it('should compute bigNumber from parseMetricValue', () => {
    const chartProps = {
      width: 600,
      height: 450,
      queriesData: [
        {
          data: [
            { __timestamp: 2, value: '456' },
          ] as unknown as BigNumberDatum[],
          colnames: ['__timestamp', 'value'],
          coltypes: [GenericDataType.Temporal, GenericDataType.String],
        },
      ],
      formData: baseFormData,
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.bigNumber).toEqual(456);
  });

  it('should use formatTime as headerFormatter for Temporal/String or forced', () => {
    const formData = { ...baseFormData, forceTimestampFormatting: true };
    const chartProps = {
      width: 600,
      height: 450,
      queriesData: [
        {
          data: [
            { __timestamp: 2, value: '123' },
          ] as unknown as BigNumberDatum[],
          colnames: ['__timestamp', 'value'],
          coltypes: [0, GenericDataType.String],
        },
      ],
      formData,
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.headerFormatter(5)).toBe('5pm');
  });

  it('should use numberFormatter when not Temporal/String and not forced', () => {
    const formData = { ...baseFormData, forceTimestampFormatting: false };
    const chartProps = {
      width: 600,
      height: 450,
      queriesData: [
        {
          data: [{ __timestamp: 2, value: 500 }] as unknown as BigNumberDatum[],
          colnames: ['__timestamp', 'value'],
          coltypes: [0, 0],
        },
      ],
      formData,
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.headerFormatter.format(500)).toBe('$500');
  });

  it('should use last data point for comparison when big number comes from aggregated data', () => {
    const chartProps = {
      width: 500,
      height: 400,
      queriesData: [
        {
          data: [
            { __timestamp: 3, value: 150 },
            { __timestamp: 2, value: 100 },
            { __timestamp: 1, value: 110 },
          ] as unknown as BigNumberDatum[],
          colnames: ['__timestamp', 'value'],
          coltypes: ['TEMPORAL', 'NUMERIC'],
        },
        {
          data: [{ value: 360 }],
          colnames: ['value'],
          coltypes: ['NUMERIC'],
        },
      ],
      formData: { ...baseFormData, aggregation: 'sum' },
      rawFormData: baseRawFormData,
      hooks: baseHooks,
      datasource: baseDatasource,
      theme: { colors: { grayscale: { light5: '#eee' } } },
    };

    const result = transformProps(
      chartProps as unknown as BigNumberWithTrendlineChartProps,
    );
    expect(result.bigNumber).toBe(360);
    expect(result.subheader).toBe('50.0% WoW');
  });
});
