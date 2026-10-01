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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import ParameterFilterPlugin from './ParameterFilterPlugin';
import { PluginFilterParameterProps } from './types';

const defaultProps: PluginFilterParameterProps = {
  data: [],
  formData: {
    parameter_name: 'test_param',
    parameter_type: 'string',
    defaultValue: 'hello',
  },
  height: 100,
  width: 300,
  setDataMask: jest.fn(),
  filterState: {
    value: 'hello',
  },
};

describe('ParameterFilterPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders text input and triggers setDataMask on change', () => {
    const setDataMask = jest.fn();
    render(<ParameterFilterPlugin {...defaultProps} setDataMask={setDataMask} />);
    const input = screen.getByTestId('parameter-text-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('hello');

    fireEvent.change(input, { target: { value: 'world' } });
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        parameters: {
          test_param: 'world',
        },
      },
      filterState: {
        value: 'world',
      },
    });
  });

  test('renders integer input and triggers setDataMask on change', () => {
    const setDataMask = jest.fn();
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        formData={{
          parameter_name: 'threshold',
          parameter_type: 'integer',
          defaultValue: 10,
        }}
        filterState={{ value: 10 }}
        setDataMask={setDataMask}
      />,
    );
    const input = screen.getByTestId('parameter-integer-input');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '25' } });
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        parameters: {
          threshold: 25,
        },
      },
      filterState: {
        value: 25,
      },
    });
  });

  test('renders boolean select when parameter_type is boolean', () => {
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        formData={{
          parameter_name: 'is_active',
          parameter_type: 'boolean',
          defaultValue: true,
        }}
        filterState={{ value: true }}
      />,
    );
    const select = screen.getByTestId('parameter-boolean-select');
    expect(select).toBeInTheDocument();
  });

  test('initializes with defaultValue when filterState.value is undefined', () => {
    const setDataMask = jest.fn();
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        formData={{
          parameter_name: 'cutoff',
          parameter_type: 'integer',
          defaultValue: 50,
        }}
        filterState={{}}
        setDataMask={setDataMask}
      />,
    );
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        parameters: {
          cutoff: 50,
        },
      },
      filterState: {
        value: 50,
      },
    });
  });

  test('renders float input when parameter_type is float', () => {
    const setDataMask = jest.fn();
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        formData={{
          parameter_name: 'ratio',
          parameter_type: 'float',
          defaultValue: 3.14,
        }}
        filterState={{ value: 3.14 }}
        setDataMask={setDataMask}
      />,
    );
    const input = screen.getByTestId('parameter-float-input');
    expect(input).toBeInTheDocument();
  });

  test('calls setHoveredFilter and unsetHoveredFilter on mouse enter and leave', () => {
    const setHoveredFilter = jest.fn();
    const unsetHoveredFilter = jest.fn();
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        setHoveredFilter={setHoveredFilter}
        unsetHoveredFilter={unsetHoveredFilter}
      />,
    );
    const container = screen.getByTestId('parameter-container');
    expect(container).toBeInTheDocument();

    fireEvent.mouseEnter(container);
    expect(setHoveredFilter).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(container);
    expect(unsetHoveredFilter).toHaveBeenCalledTimes(1);
  });

  test('calls setFocusedFilter and unsetFocusedFilter on focus and blur', () => {
    const setFocusedFilter = jest.fn();
    const unsetFocusedFilter = jest.fn();
    render(
      <ParameterFilterPlugin
        {...defaultProps}
        setFocusedFilter={setFocusedFilter}
        unsetFocusedFilter={unsetFocusedFilter}
      />,
    );
    const container = screen.getByTestId('parameter-container');
    expect(container).toBeInTheDocument();

    fireEvent.focus(container);
    expect(setFocusedFilter).toHaveBeenCalledTimes(1);

    fireEvent.blur(container);
    expect(unsetFocusedFilter).toHaveBeenCalledTimes(1);
  });
});
