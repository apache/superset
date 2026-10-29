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
  waitFor,
} from 'spec/helpers/testing-library';
import ContourPopoverTrigger from './ContourPopoverTrigger';
import { ContourPopoverTriggerProps, ContourType } from './types';

const contour: ContourType = {
  lowerThreshold: 4,
  color: { r: 10, g: 20, b: 30, a: 100 },
  strokeWidth: 3,
  zIndex: 10,
};

const renderTrigger = (props: Partial<ContourPopoverTriggerProps> = {}) => {
  const saveContour = jest.fn();
  render(
    <ContourPopoverTrigger saveContour={saveContour} value={contour} {...props}>
      <span>Open contour</span>
    </ContourPopoverTrigger>,
  );
  return { saveContour };
};

const expectClosed = () =>
  waitFor(() =>
    expect(
      screen.queryByRole('tab', { name: 'Isoline' }),
    ).not.toBeInTheDocument(),
  );

test('renders its children and keeps the popover closed initially', () => {
  renderTrigger();
  expect(screen.getByText('Open contour')).toBeInTheDocument();
  expect(
    screen.queryByRole('tab', { name: 'Isoline' }),
  ).not.toBeInTheDocument();
});

test('opens the popover on click when uncontrolled', async () => {
  renderTrigger();

  await userEvent.click(screen.getByText('Open contour'));

  expect(
    await screen.findByRole('tab', { name: 'Isoline' }),
  ).toBeInTheDocument();
});

test('closes the uncontrolled popover after saving and forwards the contour', async () => {
  const { saveContour } = renderTrigger();

  await userEvent.click(screen.getByText('Open contour'));
  await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

  expect(saveContour).toHaveBeenCalledWith(
    expect.objectContaining({ lowerThreshold: 4, strokeWidth: 3 }),
  );
  await expectClosed();
});

test('closes the uncontrolled popover with the Close button without saving', async () => {
  const { saveContour } = renderTrigger();

  await userEvent.click(screen.getByText('Open contour'));
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

  expect(saveContour).not.toHaveBeenCalled();
  await expectClosed();
});

test('follows the visible prop when controlled', async () => {
  renderTrigger({
    isControlled: true,
    visible: true,
    toggleVisibility: jest.fn(),
  });

  expect(
    await screen.findByRole('tab', { name: 'Isoline' }),
  ).toBeInTheDocument();
});

test('delegates visibility changes to the controller instead of its own state', async () => {
  const toggleVisibility = jest.fn();
  const { saveContour } = renderTrigger({
    isControlled: true,
    visible: false,
    toggleVisibility,
  });

  await userEvent.click(screen.getByText('Open contour'));

  expect(toggleVisibility).toHaveBeenCalledWith(true);
  expect(saveContour).not.toHaveBeenCalled();
});

test('asks the controller to hide the popover on Close', async () => {
  const toggleVisibility = jest.fn();
  renderTrigger({ isControlled: true, visible: true, toggleVisibility });

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

  expect(toggleVisibility).toHaveBeenCalledWith(false);
});

test('opens empty when no contour value is provided', async () => {
  renderTrigger({ value: undefined });

  await userEvent.click(screen.getByText('Open contour'));

  expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
});
