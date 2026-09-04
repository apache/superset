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
import DefaultValue from './DefaultValue';

const capturedFilterStates: unknown[] = [];

jest.mock('@superset-ui/core', () => {
  const original = jest.requireActual('@superset-ui/core');
  return {
    ...original,
    SuperChart: (props: Record<string, unknown>) => {
      capturedFilterStates.push(props.filterState);
      return <div data-test="mock-super-chart" />;
    },
  };
});

const FILTER_ID = 'filter-1';

// A minimal stand-in for antd's FormInstance: DefaultValue only ever calls
// `form.getFieldValue('filters')`.
const makeForm = (filtersValue: Record<string, unknown>) => ({
  getFieldValue: (name: string) =>
    name === 'filters' ? filtersValue : undefined,
});

const baseProps = {
  hasDefaultValue: true,
  filterId: FILTER_ID,
  setDataMask: jest.fn(),
  hasDataset: true,
  formData: { filterType: 'filter_select' } as any,
  enableNoResults: true,
};

beforeEach(() => {
  capturedFilterStates.length = 0;
});

test('keeps the same filterState object reference across renders that do not change its contents', () => {
  // Same underlying filterState object on every call to getFieldValue,
  // exactly like re-opening the form without touching the field.
  const filterState = { value: [1, 2], label: 'One, Two' };
  const formFilter = {
    filterType: 'filter_select',
    defaultValueQueriesData: [{ data: [{ col: 1 }, { col: 2 }] }],
    defaultDataMask: { filterState },
  };

  const { rerender } = render(
    <DefaultValue
      {...baseProps}
      form={makeForm({ [FILTER_ID]: formFilter }) as any}
    />,
  );

  // A parent re-render triggered by something unrelated (e.g. the config
  // modal's forceUpdate() after an ownState-only dataMask change while the
  // user is typing/searching) with the exact same underlying form data.
  rerender(
    <DefaultValue
      {...baseProps}
      form={makeForm({ [FILTER_ID]: formFilter }) as any}
    />,
  );

  expect(capturedFilterStates).toHaveLength(2);
  // Before the fix, DefaultValue spread `filterState` into a brand new
  // object literal on every render, so this would be two distinct objects
  // (even though their contents matched) — and the underlying Select
  // resets its selection whenever the object it receives changes identity.
  expect(capturedFilterStates[0]).toBe(capturedFilterStates[1]);
});

test('produces a new filterState object once the underlying value actually changes', () => {
  const formFilterWithValue = (value: number[]) => ({
    filterType: 'filter_select',
    defaultValueQueriesData: [{ data: [{ col: 1 }, { col: 2 }] }],
    defaultDataMask: { filterState: { value, label: value.join(', ') } },
  });

  const { rerender } = render(
    <DefaultValue
      {...baseProps}
      form={makeForm({ [FILTER_ID]: formFilterWithValue([1, 2]) }) as any}
    />,
  );

  rerender(
    <DefaultValue
      {...baseProps}
      form={makeForm({ [FILTER_ID]: formFilterWithValue([1, 2, 3]) }) as any}
    />,
  );

  expect(capturedFilterStates).toHaveLength(2);
  expect(capturedFilterStates[0]).not.toBe(capturedFilterStates[1]);
  expect(
    (capturedFilterStates[1] as { value: number[] }).value,
  ).toEqual([1, 2, 3]);
});
