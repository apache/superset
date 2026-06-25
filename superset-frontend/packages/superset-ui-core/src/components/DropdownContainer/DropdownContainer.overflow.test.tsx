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

/**
 * Overflow-engine regression tests for DropdownContainer.
 *
 * jsdom has no real layout, so these tests drive the component's real overflow
 * recalculation by mocking the two measurement sources it reads:
 *   1. `useResizeDetector` — supplies the container width.
 *   2. `getBoundingClientRect` — supplies per-element geometry. The inner
 *      `data-test="container"` spans [0, containerRight]; every child is
 *      ITEM_W wide and laid out left-to-right by its DOM index, so children
 *      whose right edge exceeds `containerRight` overflow.
 *
 * This exercises the production code path in DropdownContainer.tsx
 * (useLayoutEffect → overflowingIndex → notOverflowedItems/overflowedItems →
 * showDropdownButton) rather than mocking the result.
 */
import { screen, render, waitFor, act } from '@superset-ui/core/spec';
import * as resizeDetector from 'react-resize-detector';
import { DropdownContainer } from '..';

const ITEM_W = 100;
// 350px container ⇒ at most 3 items (rights 100/200/300) fit before overflow.
const BAR_WIDTH = 350;

// Mutable so a test can simulate the transient layout window where a freshly
// enlarged item set is momentarily measured as fitting before reflow settles.
let containerRight = BAR_WIDTH;
// Mutable width fed to the component through the mocked resize detector.
let mockWidth = 0;
// Stable ref object React attaches the outer node to (mirrors useResizeDetector).
const fakeRef: { current: HTMLDivElement | null } = { current: null };

const buildRect = (left: number, right: number): DOMRect =>
  ({
    left,
    right,
    width: right - left,
    top: 0,
    bottom: 0,
    height: 0,
    x: left,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect;

const installLayoutMock = () => {
  HTMLElement.prototype.getBoundingClientRect = function mockRect(
    this: HTMLElement,
  ) {
    const dataTest = this.getAttribute?.('data-test');
    if (dataTest === 'container') {
      return buildRect(0, containerRight);
    }
    const parent = this.parentElement;
    if (parent?.getAttribute?.('data-test') === 'container') {
      const index = Array.prototype.indexOf.call(parent.children, this);
      return buildRect(index * ITEM_W, index * ITEM_W + ITEM_W);
    }
    // Outer wrapper div (its first child is the inner container).
    if (
      (this.children[0] as HTMLElement | undefined)?.getAttribute?.(
        'data-test',
      ) === 'container'
    ) {
      return buildRect(0, containerRight);
    }
    return buildRect(0, 0);
  };
};

let resizeSpy: jest.SpyInstance;
let rafSpy: jest.SpyInstance;
let cancelRafSpy: jest.SpyInstance;

// Deterministic requestAnimationFrame: the component schedules a one-shot
// confirmation frame to re-measure after an item-set change. Rather than sleep
// and hope jsdom's timer-backed rAF fires inside the window, we capture the
// callbacks and invoke them explicitly via flushRAF(). cancelAnimationFrame
// removes a queued frame, so the supersession path can be exercised directly.
let rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let rafSeq = 0;

// Run every currently-queued frame once (frames scheduled during the flush are
// left for the next flush, so a single call models a single browser frame).
const flushRAF = () => {
  const pending = rafQueue;
  rafQueue = [];
  pending.forEach(({ cb }) => cb(0));
};

beforeEach(() => {
  containerRight = BAR_WIDTH;
  mockWidth = 0;
  fakeRef.current = null;
  rafQueue = [];
  rafSeq = 0;
  installLayoutMock();
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof ResizeObserver;
  rafSpy = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      rafSeq += 1;
      rafQueue.push({ id: rafSeq, cb });
      return rafSeq;
    });
  cancelRafSpy = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id: number) => {
      rafQueue = rafQueue.filter(frame => frame.id !== id);
    });
  resizeSpy = jest
    .spyOn(resizeDetector, 'useResizeDetector')
    .mockImplementation(
      () =>
        ({ ref: fakeRef, width: mockWidth, height: 50 }) as ReturnType<
          typeof resizeDetector.useResizeDetector
        >,
    );
});

afterEach(() => {
  resizeSpy?.mockRestore();
  rafSpy?.mockRestore();
  cancelRafSpy?.mockRestore();
});

const makeItem = (id: string, label: string) => ({
  id,
  element: <div data-test={`item-${id}`}>{label}</div>,
});

const nativeFilters = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    makeItem(`native-filter-${i + 1}`, `Filter ${i + 1}`),
  );

const barItemCount = () => screen.getByTestId('container').children.length;

// Render, then apply a measured width so the overflow layout effect runs with
// the outer node attached (mirrors the first real resize-detector callback).
const renderOverflowing = async (
  items: ReturnType<typeof nativeFilters>,
): Promise<{ rerender: (ui: JSX.Element) => void }> => {
  const { rerender } = render(<DropdownContainer items={items} />);
  await act(async () => {
    mockWidth = BAR_WIDTH;
    rerender(<DropdownContainer items={items} />);
  });
  await waitFor(() => expect(screen.getByText('More')).toBeInTheDocument());
  return { rerender };
};

test('control: a clean re-measurement keeps overflowed items reachable after a chip is prepended', async () => {
  const filters = nativeFilters(8);
  const { rerender } = await renderOverflowing(filters);

  // 3 of 8 fit in the bar, the rest are reachable via the More button.
  expect(barItemCount()).toBe(3);

  // Prepend a cross-filter chip, shifting every native-filter index by one.
  const withCrossFilterChip = [
    makeItem('cross-filter-chip', 'Region'),
    ...filters,
  ];
  await act(async () => {
    rerender(<DropdownContainer items={withCrossFilterChip} />);
  });
  await act(async () => {
    flushRAF();
  });
  await waitFor(() => expect(barItemCount()).toBe(3));

  // With faithful measurement the engine recovers to the exact split: 3 fit,
  // the rest stay accessible behind the trigger.
  expect(screen.queryByText('More')).toBeInTheDocument();
  expect(barItemCount()).toBe(3);
});

test('overflowed-to-true-fit: when items genuinely fit after a set change, all are in the bar and the trigger is gone', async () => {
  // Start from an overflowed steady state: 8 items, 3 in bar, More visible.
  const filters = nativeFilters(8);
  const { rerender } = await renderOverflowing(filters);
  expect(barItemCount()).toBe(3);
  expect(screen.queryByText('More')).toBeInTheDocument();

  // Reduce to 3 items — they all fit inside the 350 px bar without overflow.
  const fewFilters = nativeFilters(3);
  await act(async () => {
    rerender(<DropdownContainer items={fewFilters} />);
  });
  await act(async () => {
    flushRAF();
  });

  // After measurement (and confirmation pass if any), the trigger is gone and
  // all 3 items are in the bar. This guards the fix against over-correction:
  // if the confirmation logic erroneously kept the trigger visible when items
  // genuinely fit, this assertion would catch it.
  await waitFor(() => {
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });
  expect(barItemCount()).toBe(3);
});

test('prepending a cross-filter chip must not strand overflowed native filters or hide the More button', async () => {
  const filters = nativeFilters(8);
  const { rerender } = await renderOverflowing(filters);
  expect(barItemCount()).toBe(3);

  // Simulate the production race: as the cross-filter chip is added the item
  // set grows, overflowingIndex is reset to -1 (all items dumped into the bar)
  // and the re-measurement runs against a transient layout that momentarily
  // reports everything fits. (More filters ⇒ larger reflow ⇒ wider window,
  // matching the report's "depends on filter count".)
  containerRight = Number.MAX_SAFE_INTEGER;
  const withCrossFilterChip = [
    makeItem('cross-filter-chip', 'Region'),
    ...filters,
  ];
  await act(async () => {
    rerender(<DropdownContainer items={withCrossFilterChip} />);
  });

  // The window closes — the filters genuinely overflow the bar again — but no
  // resize/width change occurs, so only the scheduled confirmation frame can
  // rescue the verdict. Fire it.
  containerRight = BAR_WIDTH;
  await act(async () => {
    flushRAF();
  });

  // Invariant: overflowed items must remain accessible AND the split must be
  // CORRECT. Asserting the exact count (3 fit, the rest behind the trigger),
  // not merely `< total`, so an under-detecting confirmation that strands too
  // many items in the clipped bar also fails this guard.
  expect(barItemCount()).toBe(3);
  expect(screen.queryByText('More')).toBeInTheDocument();
});

test('fit-to-overflow: an item-set change that tips a fitting bar into overflow during a transient must not strand items', async () => {
  // Start with a bar that FITS: 3 items, no overflow, no trigger. The overflow
  // engine settles overflowingIndex === -1 here.
  const fewFilters = nativeFilters(3);
  const { rerender } = render(<DropdownContainer items={fewFilters} />);
  await act(async () => {
    mockWidth = BAR_WIDTH;
    rerender(<DropdownContainer items={fewFilters} />);
  });
  await waitFor(() => expect(barItemCount()).toBe(3));
  expect(screen.queryByText('More')).not.toBeInTheDocument();

  // Grow the set so it now genuinely overflows, but measure it during a
  // transient window where the bar momentarily appears to still fit. Because
  // the bar was previously fitting, this takes the "measure" path, not the
  // reset path — the case the original fix armed NO confirmation for, so a
  // transient "-1" would latch (all items crammed, trigger gone) with no
  // rescue. The hardened engine arms a confirmation on every item-set change.
  containerRight = Number.MAX_SAFE_INTEGER;
  const manyFilters = nativeFilters(8);
  await act(async () => {
    rerender(<DropdownContainer items={manyFilters} />);
  });

  // Window closes; the scheduled confirmation frame re-measures and corrects.
  containerRight = BAR_WIDTH;
  await act(async () => {
    flushRAF();
  });

  expect(barItemCount()).toBe(3);
  expect(screen.queryByText('More')).toBeInTheDocument();
});

test('a second item-set change before the confirmation frame fires still settles the correct split (re-entrancy regression)', async () => {
  // Regression guard for rapid successive changes: prepend two chips in quick
  // succession (each during a transient), then let the frame(s) fire. The
  // hardened engine supersedes the stale frame and arms a fresh confirmation
  // for the latest set; this locks in the correct end state under re-entrancy.
  const filters = nativeFilters(8);
  const { rerender } = await renderOverflowing(filters);
  expect(barItemCount()).toBe(3);

  containerRight = Number.MAX_SAFE_INTEGER;
  const withOneChip = [makeItem('cross-filter-chip', 'Region'), ...filters];
  await act(async () => {
    rerender(<DropdownContainer items={withOneChip} />);
  });
  const withTwoChips = [
    makeItem('cross-filter-chip-2', 'Segment'),
    ...withOneChip,
  ];
  await act(async () => {
    rerender(<DropdownContainer items={withTwoChips} />);
  });

  containerRight = BAR_WIDTH;
  await act(async () => {
    flushRAF();
  });

  expect(barItemCount()).toBe(3);
  expect(screen.queryByText('More')).toBeInTheDocument();
});

test('a stale confirmation frame cannot undo a normal overflow settle before it fires', async () => {
  const filters = nativeFilters(8);
  const { rerender } = await renderOverflowing(filters);
  expect(barItemCount()).toBe(3);

  // Keep the frame in the queue even when the component cancels it, so this
  // test exercises the callback-level stale guard as well as cancellation.
  cancelRafSpy.mockImplementation(() => {});
  rafSpy.mockImplementationOnce((cb: FrameRequestCallback) => {
    rafSeq += 1;
    rafQueue.push({ id: rafSeq, cb });
    // Model a transient "fits" measurement that closes immediately after the
    // confirmation is queued. The setItemsWidth render then re-runs the layout
    // effect before the frame fires and settles the correct overflow split.
    containerRight = BAR_WIDTH;
    return rafSeq;
  });

  containerRight = Number.MAX_SAFE_INTEGER;
  const withCrossFilterChip = [
    makeItem('cross-filter-chip', 'Region'),
    ...filters,
  ];
  await act(async () => {
    rerender(<DropdownContainer items={withCrossFilterChip} />);
  });

  await waitFor(() => expect(barItemCount()).toBe(3));
  expect(screen.queryByText('More')).toBeInTheDocument();

  await act(async () => {
    flushRAF();
  });

  expect(barItemCount()).toBe(3);
  expect(screen.queryByText('More')).toBeInTheDocument();
});
