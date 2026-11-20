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
import { Constants } from '@superset-ui/core/components';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import TextControl from '.';

// Lets a test hold `useDeferredValue` at a fixed value to reproduce the
// deferred render lagging behind the raw input.
const mockDeferred: { held: boolean; value: unknown } = {
  held: false,
  value: null,
};
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useDeferredValue: (value: unknown) =>
    mockDeferred.held ? mockDeferred.value : value,
}));

afterEach(() => {
  mockDeferred.held = false;
  mockDeferred.value = null;
});

const mockedProps = {
  disabled: false,
  isFloat: false,
  isInt: false,
  placeholder: 'Placeholder',
  value: 'Sample value',
};

test('should render', () => {
  const { container } = render(<TextControl {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render a textbox', () => {
  render(<TextControl {...mockedProps} />);
  expect(screen.getByRole('textbox')).toBeInTheDocument();
});

test('should render with initial value', () => {
  render(<TextControl {...mockedProps} />);
  expect(screen.getByDisplayValue('Sample value')).toBeInTheDocument();
});

test('should render with placeholder', () => {
  render(<TextControl {...mockedProps} />);
  expect(screen.getByPlaceholderText('Placeholder')).toBeInTheDocument();
});

test('should render as disabled', () => {
  const disabledProps = {
    ...mockedProps,
    disabled: true,
  };
  render(<TextControl {...disabledProps} />);
  expect(screen.getByPlaceholderText('Placeholder')).toBeDisabled();
});

test('should focus', () => {
  const focusProps = {
    ...mockedProps,
    onFocus: jest.fn(),
  };
  render(<TextControl {...focusProps} />);
  const input = screen.getByPlaceholderText('Placeholder');
  fireEvent.focus(input);
  expect(focusProps.onFocus).toHaveBeenCalledTimes(1);
});

test('should return errors when not a float', async () => {
  const changeProps = {
    ...mockedProps,
    isFloat: true,
    value: null,
    onChange: jest.fn(),
  };
  render(<TextControl {...changeProps} />);
  const input = screen.getByPlaceholderText('Placeholder');
  await userEvent.type(input, '!num', { delay: 500 });
  expect(changeProps.onChange).toHaveBeenCalled();
  expect(changeProps.onChange).toHaveBeenCalledWith('!', [
    'is expected to be a number',
  ]);
});

test('should return errors when not an int', async () => {
  const changeProps = {
    ...mockedProps,
    isInt: true,
    value: null,
    onChange: jest.fn(),
  };
  render(<TextControl {...changeProps} />);
  const input = screen.getByPlaceholderText('Placeholder');
  await userEvent.type(input, '!int', { delay: 500 });
  expect(changeProps.onChange).toHaveBeenCalled();
  expect(changeProps.onChange).toHaveBeenCalledWith('!', [
    'is expected to be an integer',
  ]);
});

test('should keep showing an externally updated value across later re-renders', () => {
  const { rerender } = render(<TextControl {...mockedProps} value="100" />);
  expect(screen.getByDisplayValue('100')).toBeInTheDocument();

  // the value is changed from outside the control, e.g. by an undo or by a
  // programmatic reset of the form data
  rerender(<TextControl {...mockedProps} value="200" />);
  expect(screen.getByDisplayValue('200')).toBeInTheDocument();

  // any later re-render that leaves the value untouched must not resurrect
  // the stale local value
  rerender(<TextControl {...mockedProps} value="200" label="Row limit" />);
  expect(screen.getByDisplayValue('200')).toBeInTheDocument();
});

test('should not call onChange on mount', () => {
  const onChange = jest.fn();
  render(<TextControl {...mockedProps} onChange={onChange} />);
  expect(onChange).not.toHaveBeenCalled();
});

test('should not call onChange again when a parent re-render hands down a new onChange identity', async () => {
  const onChangeA = jest.fn();
  const onChangeB = jest.fn();
  const { rerender } = render(
    <TextControl {...mockedProps} value="1" onChange={onChangeA} />,
  );
  await userEvent.type(screen.getByRole('textbox'), '2');
  await waitFor(() => expect(onChangeA).toHaveBeenCalledTimes(1));

  // a parent re-rendering with a fresh inline callback (common in control
  // panels) must not, by itself, re-fire the deferred-value effect
  rerender(<TextControl {...mockedProps} value="1" onChange={onChangeB} />);
  expect(onChangeA).toHaveBeenCalledTimes(1);
  expect(onChangeB).not.toHaveBeenCalled();

  // the next edit must reach the latest handler, not the stale one
  await userEvent.type(screen.getByRole('textbox'), '3');
  await waitFor(() => expect(onChangeB).toHaveBeenCalledWith('123', []));
  expect(onChangeA).toHaveBeenCalledTimes(1);
});

test('should report a repeated identical edit after an external reset', async () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <TextControl {...mockedProps} value="75" onChange={onChange} />,
  );
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  rerender(<TextControl {...mockedProps} value="" onChange={onChange} />);
  rerender(<TextControl {...mockedProps} value="75" onChange={onChange} />);
  await userEvent.clear(input);
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  expect(onChange).toHaveBeenLastCalledWith('', []);
});

test('should coalesce a burst of keystrokes into one onChange with the settled value', async () => {
  const onChange = jest.fn();
  render(<TextControl {...mockedProps} value="" onChange={onChange} />);
  await userEvent.type(screen.getByRole('textbox'), '120');
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('120', []);
});

test('should flush the latest typed value on blur while the deferred value lags', () => {
  jest.useFakeTimers();
  try {
    const onChange = jest.fn();
    // the deferred value never catches up with the raw input
    mockDeferred.held = true;
    mockDeferred.value = null;
    render(<TextControl {...mockedProps} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('abc', []);
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('should not emit a superseded value when a newer keystroke lands before the timer fires', () => {
  jest.useFakeTimers();
  try {
    const onChange = jest.fn();
    const { rerender } = render(
      <TextControl {...mockedProps} value="" onChange={onChange} />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1' } });
    // the deferred render for '12' has not committed when the timer fires
    mockDeferred.held = true;
    mockDeferred.value = '1';
    fireEvent.change(input, { target: { value: '12' } });
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    // the superseded '1' is never emitted; the newest value is re-queued
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('12', []);
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();

    mockDeferred.held = false;
    rerender(<TextControl {...mockedProps} value="" onChange={onChange} />);
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('12', []);
  } finally {
    jest.useRealTimers();
  }
});

test('should drop a pending edit when the value is reset externally', () => {
  jest.useFakeTimers();
  try {
    const onChange = jest.fn();
    const { rerender } = render(
      <TextControl {...mockedProps} value="1" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });
    rerender(<TextControl {...mockedProps} value="9" onChange={onChange} />);
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('9')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('should not flush a stale edit on blur after an external reset', () => {
  jest.useFakeTimers();
  try {
    const onChange = jest.fn();
    const { rerender } = render(
      <TextControl {...mockedProps} value="1" onChange={onChange} />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '12' } });
    // hold the deferred value at '12' across the reset so the deferred-null
    // effect cannot cancel the queued edit; only blur/the emit guard can
    mockDeferred.held = true;
    mockDeferred.value = '12';
    rerender(<TextControl {...mockedProps} value="9" onChange={onChange} />);
    fireEvent.blur(input);
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('9')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('should drop a pending edit on unmount', () => {
  jest.useFakeTimers();
  try {
    const onChange = jest.fn();
    const { unmount } = render(
      <TextControl {...mockedProps} value="1" onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });
    unmount();
    act(() => {
      jest.advanceTimersByTime(Constants.FAST_DEBOUNCE * 2);
    });
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
