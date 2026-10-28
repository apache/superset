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
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { RunQueryButton, type RunQueryButtonProps } from './index';

import {
  pointerEvent,
  mouseClick,
  keyDown,
  keyUp,
} from 'spec/helpers/runStopButton';

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
  const startQuery = () =>
    utils.rerender(<RunQueryButton {...props} loading />);
  return { ...utils, ...props, finishQuery, startQuery };
};

test('held Enter on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  // Native buttons click on each Enter keydown, including auto-repeat.
  keyDown(button, 'Enter');
  expect(onStop).toHaveBeenCalledTimes(1);
  finishQuery();
  expect(screen.getByRole('button', { name: 'Update chart' })).toBe(button);
  for (let repeat = 0; repeat < 2; repeat += 1) {
    keyDown(button, 'Enter', true);
  }
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).toHaveBeenCalledTimes(1);

  keyDown(button, 'Enter');
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });
  expect(onQuery).toHaveBeenCalledTimes(1);
});

test('a pointer gesture on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  pointerEvent('pointerdown', button);
  fireEvent.mouseDown(button);
  finishQuery();
  expect(screen.getByRole('button', { name: 'Update chart' })).toBe(button);
  pointerEvent('pointerup', button);
  fireEvent.mouseUp(button);
  pointerEvent('click', button);

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();

  pointerEvent('pointerdown', button);
  pointerEvent('click', button);
  expect(onQuery).toHaveBeenCalledTimes(1);
});

test('held Space on Stop does not update the chart after completion', () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  keyDown(button, ' ');
  finishQuery();
  keyDown(button, ' ', true);
  keyUp(button, ' ');

  expect(onQuery).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
});

test('an assistive technology click still updates the chart after a cancelled pointer press', async () => {
  const { onQuery, onStop, finishQuery } = renderGestureButton();
  const button = screen.getByRole('button', { name: /Stop/ });

  pointerEvent('pointerdown', button);
  finishQuery();
  pointerEvent('pointerup', document.body);
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  fireEvent.click(button, { detail: 0 });

  expect(onQuery).toHaveBeenCalledTimes(1);
  expect(onStop).not.toHaveBeenCalled();
});

test.each(['mouse', 'touch', 'pen'])(
  'a delayed %s Stop click retains intent after release, capture loss and timers',
  async pointerType => {
    const {
      onQuery: run,
      onStop: stop,
      finishQuery: finish,
    } = renderGestureButton();
    const button = screen.getByRole('button');
    pointerEvent('pointerdown', button, 7, pointerType);
    finish();
    pointerEvent('pointerup', button, 7, pointerType);
    pointerEvent('lostpointercapture', button, 7, pointerType);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    pointerEvent('click', button, 7, pointerType);
    expect(run).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    // An unmatched activation must not inherit this (consumed) pointer intent.
    fireEvent.click(button, { detail: 0 });
    expect(run).toHaveBeenCalledTimes(1);
  },
);

test('Space on Stop followed by Escape and release never runs after completion', () => {
  const {
    onQuery: run,
    onStop: stop,
    finishQuery: finish,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  keyDown(button, ' ');
  finish();
  keyDown(button, 'Escape');
  keyUp(button, 'Escape');
  keyUp(button, ' ');
  expect(run).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
  fireEvent.click(button, { detail: 0 });
  expect(run).toHaveBeenCalledTimes(1);
});

test.each(['second pointer', 'unrelated key'])(
  'a held Stop pointer ignores release of a %s',
  async unrelated => {
    const {
      onQuery: run,
      onStop: stop,
      finishQuery: finish,
    } = renderGestureButton();
    const button = screen.getByRole('button');
    pointerEvent('pointerdown', button, 7, 'touch');
    finish();
    if (unrelated === 'second pointer') {
      pointerEvent('pointerup', document.body, 8, 'touch');
      pointerEvent('lostpointercapture', document.body, 8, 'touch');
      pointerEvent('pointercancel', document.body, 8, 'touch');
    } else {
      fireEvent.keyUp(document.body, { key: 'Enter' });
      fireEvent.keyUp(document.body, { key: ' ' });
    }
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    pointerEvent('pointerup', button, 7, 'touch');
    pointerEvent('click', button, 7, 'touch');
    expect(run).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  },
);

test('held Enter on Run does not run again after completion until a fresh press', () => {
  const {
    onQuery: run,
    onStop: stop,
    finishQuery: finish,
    startQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  finish();
  keyDown(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(1);
  startQuery();
  finish();
  keyDown(button, 'Enter', true);
  keyDown(button, 'Enter', true);
  keyUp(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
  keyDown(button, 'Enter');
  keyUp(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(2);
});

test.each(['pointer', 'keyboard'])(
  'an independent click during a pending %s press uses the displayed action',
  async source => {
    const {
      onQuery: run,
      onStop: stop,
      finishQuery: finish,
    } = renderGestureButton();
    const button = screen.getByRole('button');
    if (source === 'pointer') pointerEvent('pointerdown', button, 7, 'touch');
    else keyDown(button, ' ');
    finish();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    fireEvent.click(button, { detail: 0 });
    expect(run).toHaveBeenCalledTimes(1);
    if (source === 'pointer') {
      pointerEvent('pointerup', button, 7, 'touch');
      pointerEvent('click', button, 7, 'touch');
    } else keyUp(button, ' ');
    expect(run).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  },
);

test('a held Space press ignores a different key or target releasing', async () => {
  const {
    onQuery: run,
    onStop: stop,
    finishQuery: finish,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  keyDown(button, ' ');
  finish();
  fireEvent.keyUp(button, { key: 'Enter' });
  fireEvent.keyUp(document.body, { key: ' ' });
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  keyUp(button, ' ');
  expect(run).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
});

test.each(['mouse', 'touch'])(
  'a %s Stop press cannot run after completion via a plain MouseEvent click',
  async pointerType => {
    const {
      onQuery: runQuery,
      onStop: stopQuery,
      finishQuery,
    } = renderGestureButton();
    const button = screen.getByRole('button');
    pointerEvent('pointerdown', button, 7, pointerType);
    finishQuery();
    pointerEvent('pointerup', button, 7, pointerType);
    pointerEvent('lostpointercapture', button, 7, pointerType);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    mouseClick(button);

    expect(runQuery).not.toHaveBeenCalled();
    expect(stopQuery).not.toHaveBeenCalled();
    // The MouseEvent must consume the pointer entry, not poison a later click.
    pointerEvent('click', button, 7, pointerType);
    expect(runQuery).toHaveBeenCalledTimes(1);
    fireEvent.click(button, { detail: 0 });
    expect(runQuery).toHaveBeenCalledTimes(2);
  },
);

test('a plain MouseEvent click consumes matching Stop intent', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  pointerEvent('pointerdown', button, 7, 'touch');
  pointerEvent('pointerup', button, 7, 'touch');
  mouseClick(button);
  expect(stopQuery).toHaveBeenCalledTimes(1);

  finishQuery();
  pointerEvent('click', button, 7, 'touch');
  expect(runQuery).toHaveBeenCalledTimes(1);
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(2);
});

test('a plain MouseEvent click matches the released pointer, not another held press', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  pointerEvent('pointerdown', button, 7, 'touch');
  finishQuery();
  // A second pointer may press Run while the Stop pointer remains held.
  pointerEvent('pointerdown', button, 8, 'touch');
  pointerEvent('pointerup', button, 8, 'touch');
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);

  pointerEvent('pointerup', button, 7, 'touch');
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('plain clicks consume multiple touch releases in release order', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  pointerEvent('pointerdown', button, 7, 'touch');
  finishQuery();
  pointerEvent('pointerdown', button, 8, 'touch');
  pointerEvent('pointerup', button, 7, 'touch');
  pointerEvent('pointerup', button, 8, 'touch');
  mouseClick(button);
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a plain Run click without a preceding press runs once', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  finishQuery();
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('three Run press and plain click cycles run three times', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  finishQuery();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    pointerEvent('pointerdown', button, 7, 'touch');
    pointerEvent('pointerup', button, 7, 'touch');
    mouseClick(button);
  }
  expect(runQuery).toHaveBeenCalledTimes(3);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('detail-zero clicks bypass the queue of released Stop presses', () => {
  const {
    onQuery: runQuery,
    onStop: stopQuery,
    finishQuery,
  } = renderGestureButton();
  const button = screen.getByRole('button');
  pointerEvent('pointerdown', button, 7, 'touch');
  finishQuery();
  pointerEvent('pointerup', button, 7, 'touch');
  fireEvent.click(button, { detail: 0 });
  expect(runQuery).toHaveBeenCalledTimes(1);
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});
