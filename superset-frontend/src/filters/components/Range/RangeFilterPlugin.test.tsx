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
import { AppSection, GenericDataType } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import RangeFilterPlugin from './RangeFilterPlugin';
import { SingleValueType } from './SingleValueType';
import transformProps from './transformProps';

const rangeProps = {
  formData: {
    datasource: '3__table',
    groupby: ['SP_POP_TOTL'],
    adhocFilters: [],
    extraFilters: [],
    extraFormData: {},
    granularitySqla: 'ds',
    metrics: [
      {
        aggregate: 'MIN',
        column: {
          column_name: 'SP_POP_TOTL',
          id: 1,
          type_generic: GenericDataType.Numeric,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: true,
        label: 'min',
      },
      {
        aggregate: 'MAX',
        column: {
          column_name: 'SP_POP_TOTL',
          id: 2,
          type_generic: GenericDataType.Numeric,
        },
        expressionType: 'SIMPLE',
        hasCustomLabel: true,
        label: 'max',
      },
    ],
    rowLimit: 1000,
    showSearch: true,
    defaultValue: [10, 70],
    timeRangeEndpoints: ['inclusive', 'exclusive'],
    urlParams: {},
    vizType: 'filter_range',
    inputRef: { current: null },
  },
  height: 20,
  hooks: {},
  filterState: { value: [10, 70] },
  queriesData: [
    {
      rowcount: 1,
      colnames: ['min', 'max'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
      data: [{ min: 10, max: 100 }],
      applied_filters: [],
      rejected_filters: [],
    },
  ],
  width: 220,
  behaviors: ['NATIVE_FILTER'],
  isRefreshing: false,
  appSection: AppSection.Dashboard,
};

describe('RangeFilterPlugin', () => {
  const setDataMask = jest.fn();
  const getWrapper = (props = {}) =>
    render(
      // @ts-ignore
      <RangeFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...rangeProps,
          formData: { ...rangeProps.formData, ...props },
        })}
        setDataMask={setDataMask}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call setDataMask with correct filter', () => {
    getWrapper();
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'SP_POP_TOTL',
            op: '<=',
            val: 70,
          },
        ],
      },
      filterState: {
        label: 'x ≤ 70',
        value: [10, 70],
      },
    });
  });

  it('should call setDataMask with correct greater than filter', () => {
    getWrapper({
      enableSingleValue: SingleValueType.Minimum,
      defaultValue: [20, 60],
    });
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'SP_POP_TOTL',
            op: '>=',
            val: 20,
          },
        ],
      },
      filterState: {
        label: 'x ≥ 20',
        value: [20, 100],
      },
    });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '20');
  });

  it('should call setDataMask with correct less than filter', () => {
    getWrapper({
      enableSingleValue: SingleValueType.Maximum,
      defaultValue: [20, 60],
    });
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'SP_POP_TOTL',
            op: '<=',
            val: 60,
          },
        ],
      },
      filterState: {
        label: 'x ≤ 60',
        value: [10, 60],
      },
    });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '60');
  });

  it('should call setDataMask with correct exact filter', () => {
    getWrapper({ enableSingleValue: SingleValueType.Exact });
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'SP_POP_TOTL',
            op: '==',
            val: 10,
          },
        ],
      },
      filterState: {
        label: 'x = 10',
        value: [10, 10],
      },
    });
  });
});
