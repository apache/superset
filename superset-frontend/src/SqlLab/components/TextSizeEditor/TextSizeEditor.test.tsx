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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import {
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
} from 'src/SqlLab/constants';
import TextSizeEditor from '.';

const setup = (fontSize = 14) => {
  const onIncreaseFontSize = jest.fn();
  const onDecreaseFontSize = jest.fn();
  const onResetFontSize = jest.fn();
  render(
    <TextSizeEditor
      fontSize={fontSize}
      onIncreaseFontSize={onIncreaseFontSize}
      onDecreaseFontSize={onDecreaseFontSize}
      onResetFontSize={onResetFontSize}
    />,
  );
  return { onIncreaseFontSize, onDecreaseFontSize, onResetFontSize };
};

test('renders the current font size', () => {
  setup();
  expect(screen.getByTestId('text-size-value')).toHaveTextContent('14');
});

test('calls the matching callback when each button is clicked', () => {
  const { onIncreaseFontSize, onDecreaseFontSize, onResetFontSize } = setup();

  fireEvent.click(screen.getByLabelText('Increase text size'));
  expect(onIncreaseFontSize).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByLabelText('Decrease text size'));
  expect(onDecreaseFontSize).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(onResetFontSize).toHaveBeenCalledTimes(1);
});

test('disables the decrease button at the minimum size', () => {
  const { onDecreaseFontSize } = setup(MIN_EDITOR_FONT_SIZE);

  const decrease = screen.getByLabelText('Decrease text size');
  expect(decrease).toBeDisabled();
  fireEvent.click(decrease);
  expect(onDecreaseFontSize).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Increase text size')).toBeEnabled();
});

test('disables the increase button at the maximum size', () => {
  const { onIncreaseFontSize } = setup(MAX_EDITOR_FONT_SIZE);

  const increase = screen.getByLabelText('Increase text size');
  expect(increase).toBeDisabled();
  fireEvent.click(increase);
  expect(onIncreaseFontSize).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Decrease text size')).toBeEnabled();
});
