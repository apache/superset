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
import TranslationInput from '.';

test('calls onChange immediately on every keystroke', () => {
  const onChange = jest.fn();
  render(<TranslationInput onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'h' },
  });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('h');
});

test('displays value from props', () => {
  render(<TranslationInput value="Hello" />);
  expect(screen.getByRole('textbox')).toHaveValue('Hello');
});

test('updates display when value prop changes', () => {
  const { rerender } = render(<TranslationInput value="Hallo" />);
  expect(screen.getByRole('textbox')).toHaveValue('Hallo');
  rerender(<TranslationInput value="Bonjour" />);
  expect(screen.getByRole('textbox')).toHaveValue('Bonjour');
});

test('forwards standard Input props', () => {
  render(
    <TranslationInput
      placeholder="Type here"
      disabled
      aria-label="my input"
    />,
  );
  const input = screen.getByRole('textbox', { name: 'my input' });
  expect(input).toHaveAttribute('placeholder', 'Type here');
  expect(input).toBeDisabled();
});

test('passes string value to onChange, not event', () => {
  const onChange = jest.fn();
  render(<TranslationInput onChange={onChange} />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'test value' },
  });
  expect(onChange).toHaveBeenCalledWith('test value');
  expect(typeof onChange.mock.calls[0][0]).toBe('string');
});

test('handles empty value', () => {
  render(<TranslationInput value="" />);
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('handles undefined value', () => {
  render(<TranslationInput value={undefined} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
});
