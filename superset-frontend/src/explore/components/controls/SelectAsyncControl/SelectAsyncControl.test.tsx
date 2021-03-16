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
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import SelectAsyncControl from '.';

jest.mock('src/components/AsyncSelect', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-test="select-test"
      data-data-endpoint={props.dataEndpoint}
      data-value={JSON.stringify(props.value)}
      data-placeholder={props.placeholder}
      data-multi={props.multi ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => props.onChange(props.multi ? [] : {})}
      >
        onChange
      </button>
      <button type="button" onClick={() => props.mutator()}>
        mutator
      </button>

      <div data-test="valueRenderer">
        {props.valueRenderer({ label: 'valueRenderer' })}
      </div>
    </div>
  ),
}));

let defaultProps = {
  value: [],
  dataEndpoint: 'api/v1/dataset/related/owners',
  multi: true,
  onAsyncErrorMessage: 'Error while fetching data',
  placeholder: 'Select ...',
  onChange: jest.fn(),
  mutator: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  defaultProps = {
    value: [],
    dataEndpoint: 'api/v1/dataset/related/owners',
    multi: true,
    onAsyncErrorMessage: 'Error while fetching data',
    placeholder: 'Select ...',
    onChange: jest.fn(),
    mutator: jest.fn(),
  };
});

test('Should render', () => {
  render(<SelectAsyncControl {...defaultProps} />, { useRedux: true });
  expect(screen.getByTestId('SelectAsyncControl')).toBeInTheDocument();
});

test('Should send correct props to AsyncSelect component - value props', () => {
  render(<SelectAsyncControl {...defaultProps} />, { useRedux: true });

  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-data-endpoint',
    defaultProps.dataEndpoint,
  );
  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-value',
    JSON.stringify(defaultProps.value),
  );
  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-placeholder',
    defaultProps.placeholder,
  );
  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-multi',
    'true',
  );
  expect(screen.getByTestId('valueRenderer')).toHaveTextContent(
    'valueRenderer',
  );
});

test('Should send correct props to AsyncSelect component - function onChange multi:true', () => {
  render(<SelectAsyncControl {...defaultProps} />, { useRedux: true });
  expect(defaultProps.onChange).toBeCalledTimes(0);
  userEvent.click(screen.getByText('onChange'));
  expect(defaultProps.onChange).toBeCalledTimes(1);
});

test('Should send correct props to AsyncSelect component - function onChange multi:false', () => {
  render(<SelectAsyncControl {...{ ...defaultProps, multi: false }} />, {
    useRedux: true,
  });
  expect(defaultProps.onChange).toBeCalledTimes(0);
  userEvent.click(screen.getByText('onChange'));
  expect(defaultProps.onChange).toBeCalledTimes(1);
});
