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
import SliderControl from './SliderControl';

const setup = (overrides = {}) => {
  const onChange = jest.fn();
  render(
    <SliderControl
      name="opacity"
      label="Opacity"
      value={5}
      min={0}
      max={10}
      step={1}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
};

test('renders the label and a slider reflecting the value', () => {
  setup();
  expect(screen.getByText('Opacity')).toBeInTheDocument();
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '5');
});

test('calls onChange with the new value on keyboard interaction', () => {
  const { onChange } = setup();
  fireEvent.keyDown(screen.getByRole('slider'), {
    key: 'ArrowRight',
    keyCode: 39,
  });
  expect(onChange).toHaveBeenCalledWith(6);
});

test('a decrease key at the max bound emits max minus one', () => {
  const { onChange } = setup({ value: 10 });
  fireEvent.keyDown(screen.getByRole('slider'), {
    key: 'ArrowLeft',
    keyCode: 37,
  });
  expect(onChange).toHaveBeenCalledWith(9);
});

test('an increase key at the max bound does not emit a value above max', () => {
  const { onChange } = setup({ value: 10 });
  const slider = screen.getByRole('slider');

  fireEvent.keyDown(slider, { key: 'ArrowRight', keyCode: 39 });

  expect(onChange).not.toHaveBeenCalled();
  expect(slider).toHaveAttribute('aria-valuenow', '10');
});
