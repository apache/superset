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
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';

import DashboardWrapper from './DashboardWrapper';

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

test('should render children', () => {
  const { getByTestId } = render(
    <DashboardWrapper>
      <div data-test="mock-children" />
    </DashboardWrapper>,
    { useRedux: true, useDnd: true },
  );
  expect(getByTestId('mock-children')).toBeInTheDocument();
});

test('should update the style on dragging state', async () => {
  const defaultProps = {
    label: <span>Test label</span>,
    tooltipTitle: 'This is a tooltip title',
    onRemove: jest.fn(),
    onMoveLabel: jest.fn(),
    onDropLabel: jest.fn(),
    type: 'test',
    index: 0,
  };
  const { container, getByText } = render(
    <DashboardWrapper>
      <OptionControlLabel
        {...defaultProps}
        index={1}
        label={<span>Label 1</span>}
      />
      <OptionControlLabel
        {...defaultProps}
        index={2}
        label={<span>Label 2</span>}
      />
    </DashboardWrapper>,
    {
      useRedux: true,
      useDnd: true,
      initialState: {
        dashboardState: {
          editMode: true,
        },
      },
    },
  );
  expect(
    container.getElementsByClassName('dragdroppable--dragging'),
  ).toHaveLength(0);
  fireEvent.dragStart(getByText('Label 1'));
  jest.runAllTimers();
  expect(
    container.getElementsByClassName('dragdroppable--dragging'),
  ).toHaveLength(1);
  fireEvent.dragEnd(getByText('Label 1'));
  // immediately discards dragging state after dragEnd
  expect(
    container.getElementsByClassName('dragdroppable--dragging'),
  ).toHaveLength(0);
});
