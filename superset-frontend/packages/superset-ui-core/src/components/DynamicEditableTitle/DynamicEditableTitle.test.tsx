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
  waitFor,
} from '@superset-ui/core/spec';
import { useState } from 'react';
import { DynamicEditableTitle } from '.';
import type { DynamicEditableTitleProps } from './types';

const createProps = (
  overrides: Partial<DynamicEditableTitleProps> = {},
): DynamicEditableTitleProps => ({
  title: 'Chart title',
  placeholder: 'Add the name of the chart',
  canEdit: true,
  onSave: jest.fn(),
  label: 'Chart title',
  ...overrides,
});

const makeRect = (width: number): DOMRect => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: width,
  top: 0,
  width,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});

const Harness = ({ initialTitle = 'Original' }: { initialTitle?: string }) => {
  const [title, setTitle] = useState(initialTitle);
  return (
    <DynamicEditableTitle
      title={title}
      placeholder="placeholder"
      canEdit
      label="Title"
      onSave={setTitle}
    />
  );
};

test('renders chart title', () => {
  const props = createProps();
  render(<DynamicEditableTitle {...props} />);
  expect(screen.getByText('Chart title')).toBeVisible();
});

test('renders placeholder', () => {
  const props = createProps({
    title: '',
  });
  render(<DynamicEditableTitle {...props} />);
  expect(screen.getByText('Add the name of the chart')).toBeVisible();
});

test('click, edit and save title', async () => {
  const props = createProps();
  render(<DynamicEditableTitle {...props} />);
  const textboxElement = screen.getByRole('textbox');
  await userEvent.click(textboxElement);
  await userEvent.type(textboxElement, ' edited');
  expect(screen.getByText('Chart title edited')).toBeVisible();
  await userEvent.type(textboxElement, '{enter}');
  expect(props.onSave).toHaveBeenCalled();
});

test('renders in non-editable mode', async () => {
  const props = createProps({ canEdit: false });
  render(<DynamicEditableTitle {...props} />);
  const titleElement = screen.getByLabelText('Chart title');
  const inputElement = screen.getByRole('textbox');
  expect(inputElement).toBeDisabled();
  expect(titleElement).toBeVisible();
  await userEvent.click(titleElement);
  await userEvent.type(titleElement, ' edited{enter}');
  expect(props.onSave).not.toHaveBeenCalled();
});

test('rapid typing then backspacing keeps every keystroke', async () => {
  render(<Harness />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  await userEvent.type(input, 'abc', { delay: 1 });
  expect(input.value).toBe('Originalabc');
  await userEvent.type(input, '{backspace}{backspace}{backspace}', {
    delay: 1,
  });
  expect(input.value).toBe('Original');
});

test('a change event that arrives before edit mode is committed is not dropped', () => {
  const onSave = jest.fn();
  render(
    <DynamicEditableTitle
      title="Foo"
      placeholder="placeholder"
      canEdit
      label="Title"
      onSave={onSave}
    />,
  );
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'FooX' } });
  expect(input.value).toBe('FooX');
});

test('prop changes mid-edit do not clobber unsaved typing', async () => {
  const onSave = jest.fn();
  const props = {
    placeholder: 'placeholder',
    canEdit: true,
    label: 'Title',
    onSave,
  };
  const { rerender } = render(<DynamicEditableTitle {...props} title="Foo" />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  await userEvent.type(input, 'X', { delay: 1 });
  expect(input.value).toBe('FooX');
  rerender(<DynamicEditableTitle {...props} title="Bar" />);
  expect(input.value).toBe('FooX');
  fireEvent.blur(input);
  expect(onSave).toHaveBeenCalledWith('FooX');
});

test('passive focus then parent-driven title change then blur does not revert', async () => {
  const onSave = jest.fn();
  const props = {
    placeholder: 'placeholder',
    canEdit: true,
    label: 'Title',
    onSave,
  };
  const { rerender } = render(<DynamicEditableTitle {...props} title="Foo" />);
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  rerender(<DynamicEditableTitle {...props} title="Bar" />);
  fireEvent.blur(input);
  expect(onSave).not.toHaveBeenCalled();
});

test('rounds fractional title measurements up when sizing the input', async () => {
  const getBoundingClientRect = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function getRect(this: HTMLElement) {
      return this.classList.contains('input-sizer')
        ? makeRect(280.31)
        : makeRect(0);
    });

  try {
    render(<DynamicEditableTitle {...createProps({ title: 'Trends' })} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveStyle({ width: '281px' });
    });
  } finally {
    getBoundingClientRect.mockRestore();
  }
});
