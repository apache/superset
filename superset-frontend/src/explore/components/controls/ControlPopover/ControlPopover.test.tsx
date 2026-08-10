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
  fireEvent,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

// Reaching into antd's internals pins the overflow behaviour ControlPopover
// relies on, so an upgrade that changes it fails here.
import { getOverflowOptions } from 'antd/lib/_util/placements';

import { TooltipPlacement } from '@superset-ui/core/components/Tooltip/types';

import ControlPopover, {
  SHIFT_INTO_VIEWPORT,
  getAutoAdjustOverflow,
  PopoverProps,
} from './ControlPopover';

// Records what the underlying popover is handed, so dropping the prop that wires
// the overflow options through fails instead of going unnoticed.
const mockPopoverProps: PopoverProps[] = [];
jest.mock('@superset-ui/core/components', () => {
  const actual = jest.requireActual('@superset-ui/core/components');
  const Probe = (props: PopoverProps) => {
    mockPopoverProps.push(props);
    return <actual.Popover {...props} />;
  };
  // The module exports lazy getters and is mid-load here, so read through to it
  // rather than spreading it, which would resolve them all too early.
  return new Proxy(actual, {
    get: (target, name) => (name === 'Popover' ? Probe : target[name]),
  });
});

const createProps = (): Partial<PopoverProps> => ({
  trigger: 'click',
  title: 'Control Popover Test',
  content: <span data-test="control-popover-content">Information</span>,
});

const TestComponent: globalThis.React.FC<PopoverProps> = props => (
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
    .spyOn(global.React, 'useState')
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
    getVisibilityRatio: () => ({ yRatio: 0.2, xRatio: 0.3 }),
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
    getVisibilityRatio: () => ({ yRatio: 0.5, xRatio: 0.7 }),
  });

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('control-popover'));

  await waitFor(() => {
    expect(setStateMock).toHaveBeenCalledWith('left');
  });
});

test('Should place popover at the bottom', async () => {
  const { setStateMock } = setupTest({
    ...createProps(),
    getVisibilityRatio: () => ({ yRatio: 0.9, xRatio: 0.2 }),
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
    destroyOnHidden: true,
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
    destroyOnHidden: true,
    open: false,
  };

  const { rerender } = setupTest(baseProps);

  expect(screen.getByTestId('control-popover')).toBeInTheDocument();
  expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();

  rerender(<TestComponent {...baseProps} open />);
  expect(await screen.findByText('Control Popover Test')).toBeInTheDocument();

  rerender(<TestComponent {...baseProps} />);
  await waitFor(() => {
    expect(screen.queryByText('Control Popover Test')).not.toBeInTheDocument();
  });
});

test('Keeps an oversized popover reachable inside the viewport', () => {
  const arrowOffset = { arrowOffsetHorizontal: 12, arrowOffsetVertical: 12 };
  const overflowFor = (placement: TooltipPlacement) =>
    getOverflowOptions(
      placement,
      arrowOffset,
      16,
      getAutoAdjustOverflow(placement),
    );

  for (const placement of [
    'rightTop',
    'rightBottom',
    'leftTop',
    'leftBottom',
    'topLeft',
    'topRight',
    'bottomLeft',
    'bottomRight',
  ] as TooltipPlacement[]) {
    // antd ships these with no shift at all, so they have to ask for it.
    expect(
      getOverflowOptions(placement, arrowOffset, 16, true),
    ).not.toMatchObject({ shiftX: expect.anything() });
    expect(overflowFor(placement)).toMatchObject({
      adjustX: 1,
      adjustY: 1,
      shiftX: true,
      shiftY: true,
    });
  }

  // The base placements already shift, capped to the span the arrow needs to stay
  // on its trigger. Asking for more would trade one broken popover for four.
  expect(overflowFor('right')).toMatchObject({ shiftX: true, shiftY: 40 });
  expect(overflowFor('left')).toMatchObject({ shiftX: true, shiftY: 40 });
  expect(overflowFor('top')).toMatchObject({ shiftY: true, shiftX: 40 });
  expect(overflowFor('bottom')).toMatchObject({ shiftY: true, shiftX: 40 });
});

test('Hands the overflow options for its placement to the popover', async () => {
  // The placement is only computed once the popover opens, so each case has to
  // open it and wait for that placement to arrive before reading the options.
  const openAt = async (
    placement: string,
    props: Partial<PopoverProps> = {},
  ) => {
    mockPopoverProps.length = 0;
    const { unmount } = render(<TestComponent {...createProps()} {...props} />);
    userEvent.click(screen.getByTestId('control-popover'));
    await waitFor(() =>
      expect(mockPopoverProps[mockPopoverProps.length - 1].placement).toBe(
        placement,
      ),
    );
    const seen = mockPopoverProps[mockPopoverProps.length - 1];
    unmount();
    return seen.autoAdjustOverflow;
  };

  // A corner placement, which antd would otherwise leave stranded off screen.
  expect(
    await openAt('rightBottom', {
      getVisibilityRatio: () => ({ yRatio: 0.9, xRatio: 0.2 }),
    }),
  ).toBe(SHIFT_INTO_VIEWPORT);

  // A base placement keeps antd's own capped shifting.
  expect(
    await openAt('left', {
      getVisibilityRatio: () => ({ yRatio: 0.5, xRatio: 0.7 }),
    }),
  ).toBe(true);

  // Callers stay in control.
  expect(await openAt('rightTop', { autoAdjustOverflow: false })).toBe(false);
});
