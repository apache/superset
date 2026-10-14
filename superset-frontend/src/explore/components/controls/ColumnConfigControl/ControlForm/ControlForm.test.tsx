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
import { fireEvent, render, screen, act } from 'spec/helpers/testing-library';
import ControlForm, { ControlFormItem, ControlFormRow } from './index';

test('commits displayed default when clicking default option without initial value', () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const { rerender } = render(
    <ControlForm onChange={onChange}>
      <ControlFormRow>
        <ControlFormItem
          name="horizontalAlign"
          controlType="RadioButtonControl"
          label="Text align"
          description=""
          defaultValue="right"
          debounceDelay={50}
          options={[
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
          ]}
        />
      </ControlFormRow>
    </ControlForm>,
  );

  const rightOption = screen.getByText('Right');
  fireEvent.click(rightOption);

  act(() => {
    jest.advanceTimersByTime(100);
  });

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ horizontalAlign: 'right' });

  // Re-render with committed value
  rerender(
    <ControlForm onChange={onChange} value={{ horizontalAlign: 'right' }}>
      <ControlFormRow>
        <ControlFormItem
          name="horizontalAlign"
          controlType="RadioButtonControl"
          label="Text align"
          description=""
          defaultValue="right"
          debounceDelay={50}
          options={[
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
          ]}
        />
      </ControlFormRow>
    </ControlForm>,
  );

  fireEvent.click(rightOption);

  act(() => {
    jest.advanceTimersByTime(100);
  });

  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenLastCalledWith({ horizontalAlign: 'right' });

  jest.useRealTimers();
});
