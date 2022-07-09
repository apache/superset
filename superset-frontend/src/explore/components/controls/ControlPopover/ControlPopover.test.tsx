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
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';

import ControlPopover, { PopoverProps } from './ControlPopover';

const createProps = (): Partial<PopoverProps> => ({
  trigger: 'click',
  title: 'Control Popover Test',
  content: <span data-test="control-popover-content">Information</span>,
});

const TestComponent: React.FC<PopoverProps> = props => (
  <div id="controlSections">
    <div data-test="outer-container">
      <ControlPopover {...props}>
        <span data-test="control-popover">Click me</span>
      </ControlPopover>
    </div>
  </div>
);

const setupTest = (props: Partial<PopoverProps> = createProps()) => {
  const setStateMock = jest.fn();
  jest
    .spyOn(React, 'useState')
    .mockImplementation(((state: any) => [
      state,
      state === 'right' ? setStateMock : jest.fn(),
    ]) as any);

  const { container, rerender } = render(<TestComponent {...props} />);

  return {
    props,
    container,
    rerender,
    setStateMock,
  };
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('Should render', () => {
  setupTest();
  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));
  expect(screen.getByText('Control Popover Test')).toBeInTheDocument();
  expect(screen.getByTestId('control-popover-content')).toBeInTheDocument();
});

test('Should lock the vertical scroll when the popover is visible', () => {
  setupTest();
  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  expect(screen.getByTestId('outer-container')).not.toHaveStyle(
    'overflowY: hidden',
  );
  userEvent.click(screen.getByTestId('control-popover'));
  expect(screen.getByTestId('outer-container')).toHaveStyle(
    'overflowY: hidden',
  );
  userEvent.click(document.body);
  expect(screen.getByTestId('outer-container')).not.toHaveStyle(
    'overflowY: hidden',
  );
});

test('Should place popover at the top', async () => {
  const { setStateMock } = setupTest({
    ...createProps(),
    getVisibilityRatio: () => 0.2,
  });

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));

  await waitFor(() => {
    expect(setStateMock).toHaveBeenCalledWith('rightTop');
  });
});

test('Should place popover at the center', async () => {
  const { setStateMock } = setupTest({
    ...createProps(),
    getVisibilityRatio: () => 0.5,
  });

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));

  await waitFor(() => {
    expect(setStateMock).toHaveBeenCalledWith('right');
  });
});

test('Should place popover at the bottom', async () => {
  const { setStateMock } = setupTest({
    ...createProps(),
    getVisibilityRatio: () => 0.7,
  });

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));

  await waitFor(() => {
    expect(setStateMock).toHaveBeenCalledWith('rightBottom');
  });
});

test('Should close popover on escape press', async () => {
  setupTest({
    ...createProps(),
    destroyTooltipOnHide: true,
  });

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));
  expect(await screen.findByText('Control Popover Test')).toBeInTheDocument();

  // Ensure that pressing any other key than escape does nothing
  fireEvent.keyDown(screen.getByTestId('control-popover'), {
    key: 'Enter',
    code: 13,
    charCode: 13,
  });
  expect(await screen.findByText('Control Popover Test')).toBeInTheDocument();

  // Escape should close the popover
  fireEvent.keyDown(screen.getByTestId('control-popover'), {
    key: 'Escape',
    code: 27,
    charCode: 0,
  });

  await waitFor(() => {
    expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();
  });
});

test('Controlled mode', async () => {
  const baseProps = {
    ...createProps(),
    destroyTooltipOnHide: true,
    visible: false,
  };

  const { rerender } = setupTest(baseProps);

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();

  rerender(<TestComponent {...baseProps} visible />);
  expect(await screen.findByText('Control Popover Test')).toBeInTheDocument();

  rerender(<TestComponent {...baseProps} />);
  await waitFor(() => {
    expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();
  });
});
