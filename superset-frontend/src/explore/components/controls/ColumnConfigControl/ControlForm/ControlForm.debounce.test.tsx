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
import { useState } from 'react';
import { JsonObject } from '@superset-ui/core';
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import ControlForm, { ControlFormItem, ControlFormRow } from '.';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const setup = (secondDelay = 250) => {
  const onChange = jest.fn();
  const Harness = () => {
    const [value, setValue] = useState<JsonObject>({});
    return (
      <ControlForm
        value={value}
        onChange={next => {
          setValue(next);
          onChange(next);
        }}
      >
        <ControlFormRow>
          <ControlFormItem
            name="title"
            controlType="Input"
            label="Title"
            description={null}
            debounceDelay={250}
          />
          <ControlFormItem
            name="note"
            controlType="Input"
            label="Note"
            description={null}
            debounceDelay={secondDelay}
          />
        </ControlFormRow>
      </ControlForm>
    );
  };
  const view = render(<Harness />);
  const inputs = screen.getAllByRole('textbox');
  return { ...view, onChange, inputs };
};

test.each([0, 100, 250, 500])(
  'keeps both field edits with a %d ms second delay',
  delay => {
    const { inputs, onChange } = setup(delay);
    fireEvent.change(inputs[0], { target: { value: 'New title' } });
    fireEvent.change(inputs[1], { target: { value: 'New note' } });
    act(() => jest.advanceTimersByTime(1000));
    expect(onChange).toHaveBeenLastCalledWith({
      title: 'New title',
      note: 'New note',
    });
    for (const [value] of onChange.mock.calls) {
      expect(value).toEqual({ title: 'New title', note: 'New note' });
    }
  },
);

test('does not notify after the form unmounts', () => {
  const { inputs, onChange, unmount } = setup();
  fireEvent.change(inputs[0], { target: { value: 'Unsaved title' } });
  unmount();
  act(() => jest.runOnlyPendingTimers());
  expect(onChange).not.toHaveBeenCalled();
});

const form = (onChange: (value: JsonObject) => void, value: JsonObject) => (
  <ControlForm value={value} onChange={onChange}>
    <ControlFormRow>
      <ControlFormItem
        name="title"
        controlType="Input"
        label="Title"
        description={null}
      />
    </ControlFormRow>
  </ControlForm>
);

test('uses the latest callback without dropping a pending edit', () => {
  const original = jest.fn();
  const updated = jest.fn();
  const value = {};
  const { rerender } = render(form(original, value));
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Pending' },
  });
  rerender(form(updated, value));
  act(() => jest.runOnlyPendingTimers());
  expect(original).not.toHaveBeenCalled();
  expect(updated).toHaveBeenCalledWith({ title: 'Pending' });
});

test('does not restore pending edits after the parent replaces the form value', () => {
  const onChange = jest.fn();
  const { rerender } = render(form(onChange, {}));
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Old column' },
  });
  rerender(form(onChange, { title: 'New column' }));
  act(() => jest.runOnlyPendingTimers());
  expect(onChange).not.toHaveBeenCalled();
});
