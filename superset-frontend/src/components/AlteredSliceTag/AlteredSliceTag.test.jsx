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
import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import AlteredSliceTag, {
  alterForComparison,
  formatValueHandler,
} from 'src/components/AlteredSliceTag';
import { defaultProps, expectedRows } from './AlteredSliceTagMocks';

const controlsMap = {
  key1: { type: 'AdhocFilterControl', label: 'Label1' },
  key2: { type: 'BoundsControl', label: 'Label2' },
  key3: { type: 'CollectionControl', label: 'Label3' },
  key4: { type: 'MetricsControl', label: 'Label4' },
  key5: { type: 'OtherControl', label: 'Label5' },
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

test('formatValueHandler formats AdhocFilterControl values correctly', () => {
  const result = formatValueHandler(
    defaultProps.origFormData.adhoc_filters,
    'key1',
    controlsMap,
  );
  expect(result).toEqual(expectedRows[0].before);
});

test('formatValueHandler formats BoundsControl values correctly', () => {
  const value = [1, 2];
  const result = formatValueHandler(value, 'key2', controlsMap);
  expect(result).toEqual('Min: 1, Max: 2');
});

test('formatValueHandler formats CollectionControl values correctly', () => {
  const value = [{ a: 1 }, { b: 2 }];
  const result = formatValueHandler(value, 'key3', controlsMap);
  expect(result).toEqual(
    `${JSON.stringify(value[0])}, ${JSON.stringify(value[1])}`,
  );
});

test('formatValueHandler formats MetricsControl values correctly', () => {
  const value = [{ label: 'Metric1' }, { label: 'Metric2' }];
  const result = formatValueHandler(value, 'key4', controlsMap);
  expect(result).toEqual('Metric1, Metric2');
});

test('formatValueHandler formats boolean values correctly', () => {
  const value = true;
  const result = formatValueHandler(value, 'key5', controlsMap);
  expect(result).toEqual('true');
});

test('formatValueHandler formats array values correctly', () => {
  const value = [{ label: 'Label1' }, { label: 'Label2' }];
  const result = formatValueHandler(value, 'key5', controlsMap);
  expect(result).toEqual('Label1, Label2');
});

test('formatValueHandler formats string values correctly', () => {
  const value = 'test';
  const result = formatValueHandler(value, 'key5', controlsMap);
  expect(result).toEqual('test');
});

test('formatValueHandler formats number values correctly', () => {
  const value = 123;
  const result = formatValueHandler(value, 'key5', controlsMap);
  expect(result).toEqual(123);
});

test('formatValueHandler formats other values correctly', () => {
  const value = { a: 1, b: 2 };
  const result = formatValueHandler(value, 'key5', controlsMap);
  expect(result).toEqual(JSON.stringify(value));
});
