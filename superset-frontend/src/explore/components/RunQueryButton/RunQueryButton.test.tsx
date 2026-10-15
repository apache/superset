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
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { RunQueryButton, type RunQueryButtonProps } from './index';

const createProps = (overrides: Partial<RunQueryButtonProps> = {}) => ({
  loading: false,
  onQuery: jest.fn(),
  onStop: jest.fn(),
  errorMessage: null,
  isNewChart: false,
  canStopQuery: true,
  chartIsStale: true,
  ...overrides,
});

test('renders update chart button', async () => {
  const props = createProps();
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Update chart')).toBeVisible();
  await userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).toHaveBeenCalled();
});

test('renders create chart button', async () => {
  const props = createProps({ isNewChart: true });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Create chart')).toBeVisible();
  await userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).toHaveBeenCalled();
});

test('renders disabled button', async () => {
  const props = createProps({ errorMessage: 'error' });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Update chart')).toBeVisible();
  expect(screen.getByRole('button')).toBeDisabled();
  await userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).not.toHaveBeenCalled();
});

test('renders query running button', async () => {
  const props = createProps({ loading: true });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Stop')).toBeVisible();
  await userEvent.click(screen.getByRole('button'));
  expect(props.onStop).toHaveBeenCalled();
});

test('renders query running button disabled', async () => {
  const props = createProps({ loading: true, canStopQuery: false });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Stop')).toBeVisible();
  expect(screen.getByRole('button')).toBeDisabled();
  await userEvent.click(screen.getByRole('button'));
  expect(props.onStop).not.toHaveBeenCalled();
});

const renderGestureButton = () => {
  const props = createProps({ loading: true });
  const utils = render(<RunQueryButton {...props} />);
  const finishQuery = () =>
    utils.rerender(<RunQueryButton {...props} loading={false} />);
  return { ...utils, ...props, finishQuery };
};

test('held Enter on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  // Native buttons click on each Enter keydown, including auto-repeat.
  fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  fireEvent.click(button, { detail: 0 });
  expect(onStop).toHaveBeenCalledTimes(1);
  finishQuery();
  expect(screen.getByRole('button', { name: 'Update chart' })).toBe(button);
  for (let repeat = 0; repeat < 2; repeat += 1) {
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter', repeat: true });
    fireEvent.click(button, { detail: 0 });
  }
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  fireEvent.click(button, { detail: 0 });
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });
  expect(onQuery).toHaveBeenCalledTimes(1);
});

test('a pointer gesture on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  fireEvent.pointerDown(button);
  fireEvent.mouseDown(button);
  finishQuery();
  expect(screen.getByRole('button', { name: 'Update chart' })).toBe(button);
  fireEvent.pointerUp(button);
  fireEvent.mouseUp(button);
  fireEvent.click(button);

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();

  fireEvent.pointerDown(button);
  fireEvent.click(button);
  expect(onQuery).toHaveBeenCalledTimes(1);
});

test('held Space on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  finishQuery();
  fireEvent.keyDown(button, { key: ' ', code: 'Space', repeat: true });
  fireEvent.keyUp(button, { key: ' ', code: 'Space' });
  fireEvent.click(button, { detail: 0 });

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
});
