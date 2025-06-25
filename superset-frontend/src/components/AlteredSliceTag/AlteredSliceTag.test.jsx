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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import AlteredSliceTag, {
  alterForComparison,
  formatValueHandler,
  isEqualish,
} from 'src/components/AlteredSliceTag';
import { defaultProps } from './AlteredSliceTagMocks';

const controlsMap = {
  b: { type: 'BoundsControl', label: 'Bounds' },
  column_collection: { type: 'CollectionControl', label: 'Collection' },
  metrics: { type: 'MetricsControl', label: 'Metrics' },
  adhoc_filters: { type: 'AdhocFilterControl', label: 'Adhoc' },
  other_control: { type: 'OtherControl', label: 'Other' },
};

test('renders the "Altered" label', () => {
  render(
    <AlteredSliceTag
      origFormData={defaultProps.origFormData}
      currentFormData={defaultProps.currentFormData}
    />,
  );

  const alteredLabel = screen.getByText('Altered');
  expect(alteredLabel).toBeInTheDocument();
});

test('opens the modal on click', () => {
  render(
    <AlteredSliceTag
      origFormData={defaultProps.origFormData}
      currentFormData={defaultProps.currentFormData}
    />,
  );

  const alteredLabel = screen.getByText('Altered');
  userEvent.click(alteredLabel);

  const modalTitle = screen.getByText('Chart changes');
  expect(modalTitle).toBeInTheDocument();
});

test('displays the differences in the modal', () => {
  render(
    <AlteredSliceTag
      origFormData={defaultProps.origFormData}
      currentFormData={defaultProps.currentFormData}
    />,
  );

  const alteredLabel = screen.getByText('Altered');
  userEvent.click(alteredLabel);

  const beforeValue = screen.getByText('1, 2, 3, 4');
  const afterValue = screen.getByText('a, b, c, d');
  expect(beforeValue).toBeInTheDocument();
  expect(afterValue).toBeInTheDocument();
});

test('does not render anything if there are no differences', () => {
  render(
    <AlteredSliceTag
      origFormData={defaultProps.origFormData}
      currentFormData={defaultProps.origFormData}
    />,
  );

  const alteredLabel = screen.queryByText('Altered');
  expect(alteredLabel).not.toBeInTheDocument();
});

test('alterForComparison returns null for undefined value', () => {
  expect(alterForComparison(undefined)).toBeNull();
});

test('alterForComparison returns null for null value', () => {
  expect(alterForComparison(null)).toBeNull();
});

test('alterForComparison returns null for empty string value', () => {
  expect(alterForComparison('')).toBeNull();
});

test('alterForComparison returns null for empty array value', () => {
  expect(alterForComparison([])).toBeNull();
});

test('alterForComparison returns null for empty object value', () => {
  expect(alterForComparison({})).toBeNull();
});

test('alterForComparison returns value for non-empty array', () => {
  const value = [1, 2, 3];
  expect(alterForComparison(value)).toEqual(value);
});

test('alterForComparison returns value for non-empty object', () => {
  const value = { key: 'value' };
  expect(alterForComparison(value)).toEqual(value);
});

test('formatValueHandler handles undefined value', () => {
  const value = undefined;
  const key = 'b';
  const formattedValue = formatValueHandler(value, key, controlsMap);
  expect(formattedValue).toBe('N/A');
});

test('formatValueHandler handles null value', () => {
  const value = null;
  const key = 'b';
  const formattedValue = formatValueHandler(value, key, controlsMap);
  expect(formattedValue).toBe('null');
});

test('formatValueHandler returns "[]" for empty filters', () => {
  const value = [];
  const key = 'adhoc_filters';
  const formattedValue = formatValueHandler(value, key, controlsMap);
  expect(formattedValue).toBe('[]');
});

test('formatValueHandler formats filters with array values', () => {
  const filters = [
    {
      clause: 'WHERE',
      comparator: ['1', 'g', '7', 'ho'],
      expressionType: 'SIMPLE',
      operator: 'IN',
      subject: 'a',
    },
    {
      clause: 'WHERE',
      comparator: ['hu', 'ho', 'ha'],
      expressionType: 'SIMPLE',
      operator: 'NOT IN',
      subject: 'b',
    },
  ];
  const key = 'adhoc_filters';
  const formattedValue = formatValueHandler(filters, key, controlsMap);
  const expected = 'a IN [1, g, 7, ho], b NOT IN [hu, ho, ha]';
  expect(formattedValue).toBe(expected);
});

test('formatValueHandler formats filters with string values', () => {
  const filters = [
    {
      clause: 'WHERE',
      comparator: 'gucci',
      expressionType: 'SIMPLE',
      operator: '==',
      subject: 'a',
    },
    {
      clause: 'WHERE',
      comparator: 'moshi moshi',
      expressionType: 'SIMPLE',
      operator: 'LIKE',
      subject: 'b',
    },
  ];
  const key = 'adhoc_filters';
  const expected = 'a == gucci, b LIKE moshi moshi';
  const formattedValue = formatValueHandler(filters, key, controlsMap);
  expect(formattedValue).toBe(expected);
});

test('formatValueHandler formats "Min" and "Max" for BoundsControl', () => {
  const value = [1, 2];
  const key = 'b';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual('Min: 1, Max: 2');
});

test('formatValueHandler formats stringified objects for CollectionControl', () => {
  const value = [{ a: 1 }, { b: 2 }];
  const key = 'column_collection';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual(
    `${JSON.stringify(value[0])}, ${JSON.stringify(value[1])}`,
  );
});

test('formatValueHandler formats MetricsControl values correctly', () => {
  const value = [{ label: 'SUM(Sales)' }, { label: 'Metric2' }];
  const key = 'metrics';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual('SUM(Sales), Metric2');
});

test('formatValueHandler formats boolean values as string', () => {
  const value1 = true;
  const value2 = false;
  const key = 'b';
  const formattedValue1 = formatValueHandler(value1, key, controlsMap);
  const formattedValue2 = formatValueHandler(value2, key, controlsMap);
  expect(formattedValue1).toBe('true');
  expect(formattedValue2).toBe('false');
});

test('formatValueHandler formats array values correctly', () => {
  const value = [
    { label: 'Label1' },
    { label: 'Label2' },
    5,
    6,
    7,
    8,
    'hello',
    'goodbye',
  ];
  const result = formatValueHandler(value, undefined, controlsMap);
  const expected = 'Label1, Label2, 5, 6, 7, 8, hello, goodbye';
  expect(result).toEqual(expected);
});

test('formatValueHandler formats string values correctly', () => {
  const value = 'test';
  const key = 'other_control';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual('test');
});

test('formatValueHandler formats number values correctly', () => {
  const value = 123;
  const key = 'other_control';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual(123);
});

test('formatValueHandler formats object values correctly', () => {
  const value = { 1: 2, alpha: 'bravo' };
  const key = 'other_control';
  const expected = '{"1":2,"alpha":"bravo"}';
  const result = formatValueHandler(value, key, controlsMap);
  expect(result).toEqual(expected);
});

test('isEqualish considers null, undefined, {} and [] as equal', () => {
  expect(isEqualish(null, undefined)).toBe(true);
  expect(isEqualish(null, [])).toBe(true);
  expect(isEqualish(null, {})).toBe(true);
  expect(isEqualish(undefined, {})).toBe(true);
});

test('isEqualish considers empty strings equal to null', () => {
  expect(isEqualish(undefined, '')).toBe(true);
  expect(isEqualish(null, '')).toBe(true);
});

test('isEqualish considers deeply equal objects equal', () => {
  const obj1 = { a: { b: { c: 1 } } };
  const obj2 = { a: { b: { c: 1 } } };
  expect(isEqualish('', '')).toBe(true);
  expect(isEqualish(obj1, obj2)).toBe(true);
  // Actually  not equal
  expect(isEqualish({ a: 1, b: 2, z: 9 }, { a: 1, b: 2, c: 3 })).toBe(false);
});
