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
import { QueryFormData } from '@superset-ui/core';
import {
  BaseTransformedProps,
  CrossFilterTransformedProps,
} from '../../src/types';
import { allEventHandlers } from '../../src/utils/eventHandlers';

function buildProps(
  overrides: Partial<
    BaseTransformedProps<QueryFormData> & CrossFilterTransformedProps
  >,
): BaseTransformedProps<QueryFormData> & CrossFilterTransformedProps {
  return {
    formData: {} as QueryFormData,
    height: 400,
    width: 800,
    queriesData: [],
    filterState: {},
    onContextMenu: jest.fn(),
    setDataMask: jest.fn(),
    emitCrossFilters: true,
    groupby: [],
    labelMap: {} as Record<string, string[] | string[][]>,
    selectedValues: {},
    coltypeMapping: {},
    ...overrides,
  } as BaseTransformedProps<QueryFormData> & CrossFilterTransformedProps;
}

test('cross-filter emits dimension value, not metric label, for single-metric chart', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['topics'],
    labelMap: {
      cancellations: ['cancellations'],
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'cancellations' });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'topics',
            op: 'IN',
            val: ['cancellations'],
          },
        ],
      },
    }),
  );
});

test('cross-filter emits dimension value, not metric label, for multi-metric stacked chart', () => {
  const setDataMask = jest.fn();
  // For multi-metric stacked bars, labelMap values include
  // [metricLabel, ...dimensionValues]
  const props = buildProps({
    groupby: ['topics'],
    labelMap: {
      'Intent, cancellations': ['Intent', 'cancellations'],
      'Intent, renewals': ['Intent', 'renewals'],
      'Volume, cancellations': ['Volume', 'cancellations'],
      'Volume, renewals': ['Volume', 'renewals'],
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'Intent, cancellations' });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'topics',
            op: 'IN',
            val: ['cancellations'],
          },
        ],
      },
    }),
  );
});

test('cross-filter emits correct values for multi-metric chart with multiple groupby columns', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['region', 'topics'],
    labelMap: {
      'Intent, US, cancellations': ['Intent', 'US', 'cancellations'],
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'Intent, US, cancellations' });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'region',
            op: 'IN',
            val: ['US'],
          },
          {
            col: 'topics',
            op: 'IN',
            val: ['cancellations'],
          },
        ],
      },
    }),
  );
});

test('cross-filter deselects previously selected value', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['topics'],
    labelMap: {
      cancellations: ['cancellations'],
    },
    selectedValues: { 0: 'cancellations' },
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'cancellations' });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [],
      },
    }),
  );
});

test('cross-filter does nothing when emitCrossFilters is false', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['topics'],
    labelMap: { cancellations: ['cancellations'] },
    selectedValues: {},
    setDataMask,
    emitCrossFilters: false,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'cancellations' });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('cross-filter does not emit when pie Total pseudo-element is clicked (name not in labelMap)', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    labelMap: {
      Electronics: ['Electronics'],
      Clothing: ['Clothing'],
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  // "Total" is a graphic text element rendered by showTotal; it is never a
  // labelMap key, so clicking it must not emit any cross-filter.
  handlers.click({ name: 'Total' });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('cross-filter does not emit when pie Other slice is clicked (name not in labelMap)', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    labelMap: {
      Electronics: ['Electronics'],
      Clothing: ['Clothing'],
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  // "Other" is the aggregated slice rendered by thresholdForOther; it is never
  // a labelMap key, so clicking it must not emit any cross-filter.
  handlers.click({ name: 'Other' });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('cross-filter does not emit when click event name is empty string', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    labelMap: { Electronics: ['Electronics'] },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  // Some ECharts click events on non-data elements (e.g. legend, axis) arrive
  // with an empty name string.
  handlers.click({ name: '' });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('cross-filter emits aggregated rows when pie Other slice is clicked with isOther flag', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labelMap: {
      Electronics: ['Electronics'],
      Clothing: ['Clothing'],
      // The aggregated "Other" slice is stored under the __other__ prefix
      // to avoid colliding with any real data row named "Other".
      '__other__Other': [['SmallA'], ['SmallB']],
    } as any,
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  // Simulate ECharts click event on the aggregated Other slice.
  // The pie chart sets data.isOther = true for this slice.
  handlers.click({ name: 'Other', data: { isOther: true } });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'category',
            op: 'IN',
            val: ['SmallA', 'SmallB'],
          },
        ],
      },
    }),
  );
});

test('cross-filter emits correct filter for real data row named "Other" (no isOther flag)', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labelMap: {
      // A real data row whose category value is literally "Other"
      Other: ['Other'],
      // The aggregated slice is stored separately under the __other__ prefix
      '__other__Other': [['SmallA'], ['SmallB']],
    } as any,
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  // Clicking a real "Other" row — no isOther flag, so it uses the plain key.
  handlers.click({ name: 'Other' });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          {
            col: 'category',
            op: 'IN',
            val: ['Other'],
          },
        ],
      },
    }),
  );
});

test('cross-filter does not emit when isOther slice has no labelMap entry', () => {
  const setDataMask = jest.fn();
  const props = buildProps({
    groupby: ['category'],
    labelMap: {
      Electronics: ['Electronics'],
      // __other__Other is NOT in labelMap — no rows were aggregated
    },
    selectedValues: {},
    setDataMask,
  });

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'Other', data: { isOther: true } });

  expect(setDataMask).not.toHaveBeenCalled();
});
