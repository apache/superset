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
import React from 'react';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { DndItemType } from 'src/explore/components/DndItemType';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';

test('renders with default props', () => {
  const { container } = render(
    <OptionWrapper
      index={1}
      clickClose={jest.fn()}
      type={'Column' as DndItemType}
      onShiftOptions={jest.fn()}
    >
      Option
    </OptionWrapper>,
    { useDnd: true },
  );
  expect(container).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'x-small' })).toBeInTheDocument();
});

test('triggers onShiftOptions on drop', () => {
  const onShiftOptions = jest.fn();
  render(
    <>
      <OptionWrapper
        index={1}
        clickClose={jest.fn()}
        type={'Column' as DndItemType}
        onShiftOptions={onShiftOptions}
      >
        Option 1
      </OptionWrapper>
      <OptionWrapper
        index={2}
        clickClose={jest.fn()}
        type={'Column' as DndItemType}
        onShiftOptions={onShiftOptions}
      >
        Option 2
      </OptionWrapper>
    </>,
    { useDnd: true },
  );

  fireEvent.dragStart(screen.getByText('Option 1'));
  fireEvent.drop(screen.getByText('Option 2'));
  expect(onShiftOptions).toHaveBeenCalled();
});
