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
import '@testing-library/jest-dom';
import { render, screen, userEvent } from '@superset-ui/core/spec';
import SearchInput from './index';

test('renders search label and input', () => {
  const onChange = jest.fn();
  render(
    <SearchInput
      count={100}
      value=""
      onChange={onChange}
      onBlur={jest.fn()}
      inputRef={{ current: null }}
    />,
  );

  screen.getByText('Search');

  const input = screen.getByPlaceholderText('100 records...');
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('aria-label', 'Search 100 records');
});

test('displays singular form for single record', () => {
  const onChange = jest.fn();
  render(
    <SearchInput
      count={1}
      value=""
      onChange={onChange}
      onBlur={jest.fn()}
      inputRef={{ current: null }}
    />,
  );

  const input = screen.getByPlaceholderText('1 record');
  expect(input).toHaveAttribute('aria-label', 'Search 1 records');
  expect(input).toHaveAttribute('type', 'text');
});

test('has proper aria-label for accessibility', () => {
  const onChange = jest.fn();
  render(
    <SearchInput
      count={50}
      value=""
      onChange={onChange}
      onBlur={jest.fn()}
      inputRef={{ current: null }}
    />,
  );

  const input = screen.getByLabelText('Search 50 records');
  expect(input).toHaveAttribute('aria-label', 'Search 50 records');
  expect(input).toHaveAttribute('placeholder', '50 records...');
});

test('calls onChange when user types', () => {
  const onChange = jest.fn();

  render(
    <SearchInput
      count={100}
      value=""
      onChange={onChange}
      onBlur={jest.fn()}
      inputRef={{ current: null }}
    />,
  );

  const input = screen.getByRole('textbox');
  userEvent.type(input, 'test');

  expect(onChange).toHaveBeenCalled();
});

test('displays current value in input', () => {
  const onChange = jest.fn();
  render(
    <SearchInput
      count={100}
      value="current search"
      onChange={onChange}
      onBlur={jest.fn()}
      inputRef={{ current: null }}
    />,
  );

  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(input).toHaveValue('current search');
});

test('calls onBlur when input loses focus', () => {
  const onBlur = jest.fn();

  render(
    <SearchInput
      count={100}
      value=""
      onChange={jest.fn()}
      onBlur={onBlur}
      inputRef={{ current: null }}
    />,
  );

  const input = screen.getByRole('textbox');
  userEvent.click(input);
  userEvent.tab();

  expect(onBlur).toHaveBeenCalled();
});
