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
import TooltipRenderer, { Data } from '../../src/utils/TooltipRenderer';

const defaultData: Data = {
  columns: [
    { type: GenericDataType.String, formatter: String },
    { type: GenericDataType.Numeric, formatter: String },
  ],
  rows: [
    ['a', 2],
    ['b', 2],
  ],
};

test('calculates the total even if data has non-numeric values', () => {
  const data: Data = {
    columns: [
      { type: GenericDataType.String, formatter: String },
      { type: GenericDataType.Numeric, formatter: String },
    ],
    rows: [
      ['a', 1],
      ['b', 2],
      ['c', null],
      ['d', 'x'],
    ],
  };
  const tooltipRenderer = new TooltipRenderer(data, false, true);
  expect(tooltipRenderer.calculateTotal()).toEqual(3);
});

test('renderCell should align text based on column type', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, false, true);
  const stringCell = tooltipRenderer.renderCell('a', defaultData.columns[0], 0);
  const numericCell = tooltipRenderer.renderCell(1, defaultData.columns[1], 0);
  expect(stringCell).toContain('text-align: left');
  expect(numericCell).toContain('text-align: right');
});

test('does not render the total if column type is not numeric even if showTotal is true', () => {
  const data: Data = {
    columns: [
      { type: GenericDataType.String, formatter: String },
      { type: GenericDataType.String, formatter: String },
    ],
    rows: [
      ['a', '1'],
      ['b', '2'],
    ],
  };
  const tooltipRenderer = new TooltipRenderer(data, false, true);
  expect(tooltipRenderer.renderHtml()).not.toContain('Total');
});

test('renders title', () => {
  const tooltipRenderer = new TooltipRenderer(
    defaultData,
    false,
    true,
    undefined,
    'Title',
  );
  expect(tooltipRenderer.renderHtml()).toContain('Title');
});

test('renders total with percentage', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, true, true);
  const html = tooltipRenderer.renderHtml();
  expect(html).toContain('Total');
  expect(html).toContain('100.00%');
});

test('renders total without percentage', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, false, true);
  const html = tooltipRenderer.renderHtml();
  expect(html).toContain('Total');
  expect(html).not.toContain('%');
});

test('renders a percentage column', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, true, true);
  expect(tooltipRenderer.renderHtml()).toContain('50.00%');
});

test('renders focused row', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, false, true, 0);
  const html = tooltipRenderer.renderHtml();
  expect(html).toContain('<tr style="font-weight: 700;">');
  expect(html).toContain('<tr>');
});

test('renders no focused row if focusedRow is not set', () => {
  const tooltipRenderer = new TooltipRenderer(defaultData, false, true);
  const html = tooltipRenderer.renderHtml();
  expect(html).not.toContain('<tr style="font-weight: 700;">');
});

test('renders percentage column only when the second column is numeric even if showPercentage is true', () => {
  const data: Data = {
    columns: [
      { type: GenericDataType.String, formatter: String },
      { type: GenericDataType.String, formatter: String },
    ],
    rows: [
      ['a', '1'],
      ['b', '2'],
    ],
  };
  const tooltipRenderer = new TooltipRenderer(data, true, true);
  expect(tooltipRenderer.renderHtml()).not.toContain('%');
});

test('renders a formatted column', () => {
  const data: Data = {
    columns: [
      { type: GenericDataType.String, formatter: String },
      {
        type: GenericDataType.Numeric,
        formatter: ((value: number) => value.toFixed(2)) as StringConstructor,
      },
    ],
    rows: [
      ['a', 1000],
      ['b', 2000],
    ],
  };
  const tooltipRenderer = new TooltipRenderer(data, false, true);
  const html = tooltipRenderer.renderHtml();
  expect(html).toContain('1000.00');
  expect(html).toContain('2000.00');
});
