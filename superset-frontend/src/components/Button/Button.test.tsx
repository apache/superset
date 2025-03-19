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
import { fireEvent, render } from 'spec/helpers/testing-library';
import Button from '.';
import {
  ButtonGallery,
  SIZES as buttonSizes,
  STYLES as buttonStyles,
} from './Button.stories';

test('works with an onClick handler', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalled();
});

test('does not handle onClicks when disabled', () => {
  const mockAction = jest.fn();
  const { getByRole } = render(<Button onClick={mockAction} disabled />);
  fireEvent.click(getByRole('button'));
  expect(mockAction).toHaveBeenCalledTimes(0);
});

// test stories from the storybook!
test('All the sorybook gallery variants mount', () => {
  const { getAllByRole } = render(<ButtonGallery />);

  const permutationCount =
    Object.values(buttonStyles.options).filter(o => o).length *
    Object.values(buttonSizes.options).length;

  expect(getAllByRole('button')).toHaveLength(permutationCount);
});
