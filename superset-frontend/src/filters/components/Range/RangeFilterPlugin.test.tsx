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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import RangeFilterPlugin from './RangeFilterPlugin';
import { RangeDisplayMode } from './types';
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
  const getWrapper = (props: any = {}) =>
    render(
      // @ts-ignore
      <RangeFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...rangeProps,
          ...props,
          formData: { ...rangeProps.formData, ...props.formData },
        })}
        setDataMask={setDataMask}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render two numerical inputs and a slider by default', () => {
    getWrapper();

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);

    expect(inputs[0]).toHaveValue('10');
    expect(inputs[1]).toHaveValue('70');

    // For a range slider, there are two slider handles
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('should set the data mask to error when the range is incorrect', async () => {
    getWrapper({ filterState: { value: [null, null] } });

    const inputs = screen.getAllByRole('spinbutton');
    const fromInput = inputs[0];
    const toInput = inputs[1];

    userEvent.clear(fromInput);
    userEvent.type(fromInput, '20');

    userEvent.clear(toInput);
    userEvent.type(toInput, '10');

    userEvent.tab();

    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {},
      filterState: {
        label: '',
        validateMessage: 'Numbers must be within 10 and 100',
        validateStatus: 'error',
        value: null,
      },
    });
  });

  it('should call setDataMask with correct filter', () => {
    getWrapper();
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        filters: [
          {
            col: 'SP_POP_TOTL',
            op: '>=',
            val: 10,
          },
          {
            col: 'SP_POP_TOTL',
            op: '<=',
            val: 70,
          },
        ],
      },
      filterState: {
        label: '10 ≤ x ≤ 70',
        value: [10, 70],
        validateMessage: '',
        validateStatus: undefined,
      },
    });
  });

  it('should call setDataMask with correct greater than filter', () => {
    getWrapper({
      filterState: { value: [20, null] },
      formData: {
        enableSingleValue: SingleValueType.Minimum,
        defaultValue: undefined,
      },
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
        validateStatus: undefined,
        validateMessage: '',
        label: 'x ≥ 20',
        value: [20, null],
      },
    });

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue('20');
  });

  it('should call setDataMask with correct less than filter', () => {
    getWrapper({
      filterState: { value: [null, 60] },
      formData: {
        enableSingleValue: SingleValueType.Maximum,
      },
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
        value: [null, 60],
        validateMessage: '',
        validateStatus: undefined,
      },
    });

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue('60');
  });

  it('should call setDataMask with correct exact filter', () => {
    getWrapper({
      formData: {
        enableSingleValue: SingleValueType.Exact,
      },
      filterState: { value: [10, 10] },
    });
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
        validateStatus: undefined,
        validateMessage: '',
      },
    });

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue('10');
  });

  describe('Range Display Modes', () => {
    it('should render only the slider in slider mode', () => {
      getWrapper({
        formData: {
          rangeDisplayMode: RangeDisplayMode.Slider,
        },
      });

      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(0);

      expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    });

    it('should render only inputs in input mode', () => {
      getWrapper({
        formData: {
          rangeDisplayMode: RangeDisplayMode.Input,
        },
      });

      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);

      expect(screen.queryAllByRole('slider')).toHaveLength(0);
    });

    it('should render both slider and inputs in slider-and-input mode', () => {
      getWrapper({
        formData: {
          rangeDisplayMode: RangeDisplayMode.SliderAndInput,
        },
      });

      // Should show inputs
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);

      // Should show slider
      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(0);
    });

    it('should default to slider-and-input mode when not specified', () => {
      getWrapper({
        formData: {
          // No rangeDisplayMode specified
        },
      });

      // Should show inputs
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);

      // Should show slider
      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(0);
    });
  });
});
