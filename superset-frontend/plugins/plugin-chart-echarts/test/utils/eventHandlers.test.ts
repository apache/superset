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
    labelMap: {},
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
