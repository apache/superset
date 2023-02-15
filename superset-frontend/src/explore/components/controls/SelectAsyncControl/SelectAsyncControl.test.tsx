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
import fetchMock from 'fetch-mock';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import SelectAsyncControl from '.';

const datasetsOwnersEndpoint = 'glob:*/api/v1/dataset/related/owners*';

jest.mock('src/components/Select/Select', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-test="select-test"
      data-value={JSON.stringify(props.value)}
      data-placeholder={props.placeholder}
      data-multi={props.mode}
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
    </div>
  ),
  propertyComparator: jest.fn(),
}));

fetchMock.get(datasetsOwnersEndpoint, {
  result: [],
});

const createProps = () => ({
  ariaLabel: 'SelectAsyncControl',
  value: [],
  dataEndpoint: datasetsOwnersEndpoint,
  multi: true,
  placeholder: 'Select ...',
  onChange: jest.fn(),
  mutator: jest.fn(),
});

beforeEach(() => {
  jest.resetAllMocks();
});

test('Should render', async () => {
  const props = createProps();
  render(<SelectAsyncControl {...props} />, { useRedux: true });
  expect(await screen.findByTestId('select-test')).toBeInTheDocument();
});

test('Should send correct props to Select component - value props', async () => {
  const props = createProps();
  render(<SelectAsyncControl {...props} />, { useRedux: true });

  expect(await screen.findByTestId('select-test')).toHaveAttribute(
    'data-value',
    JSON.stringify(props.value),
  );
  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-placeholder',
    props.placeholder,
  );
  expect(screen.getByTestId('select-test')).toHaveAttribute(
    'data-multi',
    'multiple',
  );
});

test('Should send correct props to Select component - function onChange multi:true', async () => {
  const props = createProps();
  render(<SelectAsyncControl {...props} />, { useRedux: true });
  expect(props.onChange).toBeCalledTimes(0);
  userEvent.click(await screen.findByText('onChange'));
  expect(props.onChange).toBeCalledTimes(1);
});

test('Should send correct props to Select component - function onChange multi:false', async () => {
  const props = createProps();
  render(<SelectAsyncControl {...{ ...props, multi: false }} />, {
    useRedux: true,
  });
  expect(props.onChange).toBeCalledTimes(0);
  userEvent.click(await screen.findByText('onChange'));
  expect(props.onChange).toBeCalledTimes(1);
});
