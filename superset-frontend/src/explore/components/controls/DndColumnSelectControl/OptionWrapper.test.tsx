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
import { render, screen } from 'spec/helpers/testing-library';
import { DndItemType } from 'src/explore/components/DndItemType';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';

test('renders with default props', async () => {
  const { container } = render(
    <OptionWrapper
      index={1}
      clickClose={jest.fn()}
      type={'Column' as DndItemType}
      onShiftOptions={jest.fn()}
      label="Option"
    />,
    { useDndKit: true },
  );
  expect(container).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: 'close' })).toBeInTheDocument();
});

test('renders label correctly', async () => {
  render(
    <OptionWrapper
      index={1}
      clickClose={jest.fn()}
      type={'Column' as DndItemType}
      onShiftOptions={jest.fn()}
      label="Test Label"
    />,
    { useDndKit: true },
  );

  expect(await screen.findByText('Test Label')).toBeInTheDocument();
});

test('renders multiple options', async () => {
  render(
    <>
      <OptionWrapper
        index={0}
        clickClose={jest.fn()}
        type={'Column' as DndItemType}
        onShiftOptions={jest.fn()}
        label="Option 1"
      />
      <OptionWrapper
        index={1}
        clickClose={jest.fn()}
        type={'Column' as DndItemType}
        onShiftOptions={jest.fn()}
        label="Option 2"
      />
    </>,
    { useDndKit: true },
  );

  expect(await screen.findByText('Option 1')).toBeInTheDocument();
  expect(await screen.findByText('Option 2')).toBeInTheDocument();
});

test('calls clickClose when close button is clicked', async () => {
  const clickClose = jest.fn();
  render(
    <OptionWrapper
      index={1}
      clickClose={clickClose}
      type={'Column' as DndItemType}
      onShiftOptions={jest.fn()}
      label="Option"
    />,
    { useDndKit: true },
  );

  const closeButton = await screen.findByRole('img', { name: 'close' });
  closeButton.click();
  expect(clickClose).toHaveBeenCalledWith(1);
});
