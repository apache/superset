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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { DatabaseSelect } from './DatabaseSelect';

jest.mock('src/components/AsyncSelect', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-test={props['data-test']}
      data-endpoint={props.dataEndpoint}
      data-clearable={props.clearable ? 'true' : 'false'}
      data-value={props.value}
      data-valuekey={props.valueKey}
      data-placeholder={props.placeholder}
      data-autoselect={props.autoSelect ? 'true' : 'false'}
      data-isdisabled={props.isDisabled}
    >
      <button
        data-test="onChange"
        type="button"
        onClick={() => props.onChange()}
      >
        onChange
      </button>
      <button
        data-test="onAsyncError"
        type="button"
        onClick={() => props.onAsyncError()}
      >
        onAsyncError
      </button>
      <div data-test="valueRenderer">
        {props.valueRenderer({
          backend: 'backend_valueRenderer',
          database_name: 'database_name_valueRenderer',
        })}
      </div>
      <div data-test="optionRenderer">
        {props.optionRenderer({
          backend: 'backend_optionRenderer',
          database_name: 'database_name_optionRenderer',
        })}
      </div>
      <button data-test="mutator" type="button" onClick={() => props.mutator()}>
        mutator
      </button>
    </div>
  ),
}));

test('Should send props correctly', () => {
  const mutator = { current: jest.fn() };
  const props = {
    disableFilters: false,
    isDisabled: false,
    currentDbId: 123,
    mutator,
    onChange: jest.fn(),
    handleError: jest.fn(),
  };
  render(<DatabaseSelect {...props} />);

  expect(screen.getByTestId('select-database')).toBeInTheDocument();
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-autoselect',
    'true',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-clearable',
    'false',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-placeholder',
    'Select a database',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-value',
    '123',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-valuekey',
    'id',
  );
});

test('Should send props correctly - disableFilters:false and isDisabled:false', () => {
  const mutator = { current: jest.fn() };
  const props = {
    disableFilters: false,
    isDisabled: false,
    currentDbId: 123,
    mutator,
    onChange: jest.fn(),
    handleError: jest.fn(),
  };
  render(<DatabaseSelect {...props} />);

  expect(screen.getByTestId('select-database')).toBeInTheDocument();

  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-isdisabled',
    'false',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-endpoint',
    '/api/v1/database/?q=(filters:!((col:expose_in_sqllab,opr:eq,value:!t)),order_columns:database_name,order_direction:asc,page:0,page_size:-1)',
  );
});

test('Should send props correctly - disableFilters:false and isDisabled:true', () => {
  const mutator = { current: jest.fn() };
  const props = {
    disableFilters: true,
    isDisabled: true,
    currentDbId: 123,
    mutator,
    onChange: jest.fn(),
    handleError: jest.fn(),
  };
  render(<DatabaseSelect {...props} />);

  expect(screen.getByTestId('select-database')).toBeInTheDocument();
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-isdisabled',
    'true',
  );
  expect(screen.getByTestId('select-database')).toHaveAttribute(
    'data-endpoint',
    '/api/v1/database/?q=(order_columns:database_name,order_direction:asc,page:0,page_size:-1)',
  );
});

test('Should call the actions correctly', () => {
  const mutator = { current: jest.fn() };
  const props = {
    disableFilters: false,
    isDisabled: false,
    currentDbId: 123,
    mutator,
    onChange: jest.fn(),
    handleError: jest.fn(),
  };
  render(<DatabaseSelect {...props} />);

  expect(screen.getByTestId('select-database')).toBeInTheDocument();

  expect(props.onChange).toBeCalledTimes(0);
  expect(props.handleError).toBeCalledTimes(0);
  expect(props.mutator.current).toBeCalledTimes(0);

  fireEvent.click(screen.getByTestId('onChange'));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.handleError).toBeCalledTimes(0);
  expect(props.mutator.current).toBeCalledTimes(0);

  fireEvent.click(screen.getByTestId('onAsyncError'));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.handleError).toBeCalledTimes(1);
  expect(props.mutator.current).toBeCalledTimes(0);

  fireEvent.click(screen.getByTestId('mutator'));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.handleError).toBeCalledTimes(1);
  expect(props.mutator.current).toBeCalledTimes(1);
});
