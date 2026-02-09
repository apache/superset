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
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import DeferredInput from '.';

test('does not call onChange on every keystroke', () => {
  const onChange = jest.fn();
  render(<DeferredInput onChange={onChange} />);
  userEvent.type(screen.getByRole('textbox'), 'hello');
  expect(onChange).not.toHaveBeenCalled();
});

test('calls onChange on blur with current value', () => {
  const onChange = jest.fn();
  render(<DeferredInput onChange={onChange} />);
  const input = screen.getByRole('textbox');
  userEvent.type(input, 'hello');
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('hello');
});

test('calls onChange after debounce timeout', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  render(<DeferredInput onChange={onChange} debounceMs={200} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'hello' },
  });
  expect(onChange).not.toHaveBeenCalled();
  jest.advanceTimersByTime(200);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('hello');
  jest.useRealTimers();
});

test('blur flushes pending debounce immediately', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  render(<DeferredInput onChange={onChange} debounceMs={500} />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'hello' } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('hello');
  jest.useRealTimers();
});

test('syncs internal state when value prop changes externally', () => {
  const { rerender } = render(<DeferredInput value="A" />);
  expect(screen.getByRole('textbox')).toHaveValue('A');
  rerender(<DeferredInput value="B" />);
  expect(screen.getByRole('textbox')).toHaveValue('B');
});

test('typing after external value sync appends correctly', () => {
  const onChange = jest.fn();
  render(<DeferredInput value="A" onChange={onChange} />);
  const input = screen.getByRole('textbox');
  userEvent.type(input, 'BC');
  expect(input).toHaveValue('ABC');
  expect(onChange).not.toHaveBeenCalled();
});

test('flushes pending value on unmount', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { unmount } = render(
    <DeferredInput onChange={onChange} debounceMs={500} />,
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'hello' },
  });
  expect(onChange).not.toHaveBeenCalled();
  unmount();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('hello');
  jest.useRealTimers();
});

test('does not reset local state on echo of propagated value', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { rerender } = render(
    <DeferredInput value="" onChange={onChange} debounceMs={100} />,
  );
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'hello' } });
  jest.advanceTimersByTime(100);
  expect(onChange).toHaveBeenCalledWith('hello');
  // Parent echoes propagated value back via props
  rerender(
    <DeferredInput value="hello" onChange={onChange} debounceMs={100} />,
  );
  expect(input).toHaveValue('hello');
  // Further typing works without reset
  fireEvent.change(input, { target: { value: 'hello!' } });
  expect(input).toHaveValue('hello!');
  jest.useRealTimers();
});

test('forwards standard Input props', () => {
  render(
    <DeferredInput
      placeholder="Type here"
      disabled
      data-test="my-input"
    />,
  );
  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('placeholder', 'Type here');
  expect(input).toBeDisabled();
});

test('external value change overrides local state mid-typing', () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <DeferredInput value="Hallo" onChange={onChange} />,
  );
  const input = screen.getByRole('textbox');
  userEvent.type(input, ' Welt');
  expect(input).toHaveValue('Hallo Welt');
  // Locale switch: parent sets completely different value
  rerender(<DeferredInput value="Bonjour" onChange={onChange} />);
  expect(input).toHaveValue('Bonjour');
});
