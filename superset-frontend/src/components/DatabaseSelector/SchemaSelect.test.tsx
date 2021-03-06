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
import { OptionTypeBase } from 'react-select';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { SchemaSelect } from './SchemaSelect';

interface SelectProps {
  name: string;
  placeholder: string;
  value: { value: string };
  isLoading: boolean;
  autosize: boolean;
  isDisabled: boolean;
  options: { value: string }[];
  valueRenderer: (option: OptionTypeBase) => React.ReactNode;
  onChange: (schema: OptionTypeBase) => void;
}
jest.mock('src/components/Select', () => ({
  Select: (props: SelectProps) => (
    <div
      data-test="select"
      data-name={props.name}
      data-placeholder={props.placeholder}
      data-value={JSON.stringify(props.value)}
      data-loading={props.isLoading}
      data-autosize={props.autosize ? 'true' : 'false'}
      data-disabled={props.isDisabled ? 'true' : 'false'}
    >
      <div data-test="value-renderer">
        {props.valueRenderer({ label: 'test-option' })}
      </div>
      <button type="button" onClick={() => props.onChange({ schema: 'test' })}>
        btn-test
      </button>
    </div>
  ),
}));

test('Should send props correctly - loading:false and readOnly:false', () => {
  const props = {
    hasRefresh: false,
    schemaOptions: [{ value: 'currentSchema' }, { value: 'otherSchema' }],
    currentSchema: 'currentSchema',
    loading: false,
    readOnly: false,
    onChange: jest.fn(),
    refresh: jest.fn(),
  };
  render(<SchemaSelect {...props} />);

  expect(screen.getByTestId('select')).toBeInTheDocument();
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-name',
    'select-schema',
  );
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-placeholder',
    'Select a schema (2)',
  );
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-value',
    '[{"value":"currentSchema"}]',
  );
  expect(screen.getByTestId('select')).toHaveAttribute('data-loading', 'false');
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-autosize',
    'false',
  );
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-disabled',
    'false',
  );
  expect(screen.getByTestId('value-renderer')?.textContent).toBe(
    'Schema: test-option',
  );
});

test('Should send props correctly - loading:true and readOnly:true', () => {
  const props = {
    hasRefresh: false,
    schemaOptions: [
      { value: 'currentSchema' },
      { value: 'otherSchema' },
      { value: 'newSchema' },
    ],
    currentSchema: 'otherSchema',
    loading: true,
    readOnly: true,
    onChange: jest.fn(),
    refresh: jest.fn(),
  };
  render(<SchemaSelect {...props} />);

  expect(screen.getByTestId('select')).toBeInTheDocument();
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-name',
    'select-schema',
  );
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-placeholder',
    'Select a schema (3)',
  );
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-value',
    '[{"value":"otherSchema"}]',
  );
  expect(screen.getByTestId('select')).toHaveAttribute('data-loading', 'true');
  expect(screen.getByTestId('select')).toHaveAttribute(
    'data-autosize',
    'false',
  );
  expect(screen.getByTestId('select')).toHaveAttribute('data-disabled', 'true');
  expect(screen.getByTestId('value-renderer')?.textContent).toBe(
    'Schema: test-option',
  );
});

test('Should call refresh when you click the button', () => {
  const props = {
    hasRefresh: true,
    schemaOptions: [{ value: 'currentSchema' }, { value: 'otherSchema' }],
    currentSchema: 'currentSchema',
    loading: false,
    readOnly: false,
    onChange: jest.fn(),
    refresh: jest.fn(),
  };

  render(<SchemaSelect {...props} />);

  expect(screen.getByRole('button', { name: 'Icon' })).toBeInTheDocument();
  expect(props.refresh).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Icon' }));
  expect(props.refresh).toBeCalledTimes(1);
});
