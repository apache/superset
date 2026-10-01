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
  render,
  screen,
  userEvent,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import ControlForm, { ControlFormItem, ControlFormRow } from '.';

const noDigits = (value: unknown) =>
  /\d/.test(String(value)) ? 'Digits are not allowed' : false;

const renderForm = (
  props: {
    value?: Record<string, string>;
    validators?: ((value: unknown) => string | false)[];
    debounceDelay?: number;
  } = {},
) => {
  const onChange = jest.fn();
  render(
    <ControlForm onChange={onChange} value={props.value}>
      <ControlFormRow>
        <ControlFormItem
          name="title"
          controlType="Input"
          label="Title"
          description="Title description"
          validators={props.validators}
          debounceDelay={props.debounceDelay}
        />
        <ControlFormItem
          name="note"
          controlType="Input"
          label="Note"
          description="Note description"
        />
      </ControlFormRow>
    </ControlForm>,
  );
  return { onChange };
};

test('seeds each field from the matching key of the form value', () => {
  renderForm({ value: { title: 'Hello', note: 'World' } });
  expect(
    screen
      .getAllByRole('textbox')
      .map(input => (input as HTMLInputElement).value),
  ).toEqual(['Hello', 'World']);
});

test('propagates an edit to the form merged with the existing value', async () => {
  const { onChange } = renderForm({ value: { note: 'World' } });
  await userEvent.type(screen.getAllByRole('textbox')[0], 'Hi');

  await waitFor(() =>
    expect(onChange).toHaveBeenLastCalledWith({ note: 'World', title: 'Hi' }),
  );
});

test('debounces rapid keystrokes into a single form change', async () => {
  const { onChange } = renderForm();
  await userEvent.type(screen.getAllByRole('textbox')[0], 'abc');

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(onChange).toHaveBeenCalledWith({ title: 'abc' });
});

test('does not propagate a value that fails validation and shows the error', async () => {
  const { onChange } = renderForm({ validators: [noDigits] });
  await userEvent.type(screen.getAllByRole('textbox')[0], '1');

  const errorBadge = await screen.findByTestId('error-tooltip');
  await userEvent.hover(within(errorBadge).getByRole('img'));
  expect(await screen.findByText('Digits are not allowed')).toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, 400));
  expect(onChange).not.toHaveBeenCalled();
});

test('skips validation for an emptied field and propagates the empty value', async () => {
  const { onChange } = renderForm({
    value: { title: 'x' },
    validators: [() => 'always invalid'],
  });
  await userEvent.clear(screen.getAllByRole('textbox')[0]);

  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ title: '' }));
  expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
});
