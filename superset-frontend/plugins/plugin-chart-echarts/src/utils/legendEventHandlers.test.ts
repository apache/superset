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
import { LegendState } from '@superset-ui/core';
import { act, renderHook } from '@testing-library/react';
import {
  LEGEND_DOUBLE_CLICK_INTERVAL,
  isolateLegendSeries,
  useLegendEventHandlers,
} from './legendEventHandlers';

const ALL_VISIBLE: LegendState = { a: true, b: true, c: true };

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function setup() {
  const onLegendStateChanged = jest.fn();
  const onLegendScroll = jest.fn();
  const { result, unmount } = renderHook(() =>
    useLegendEventHandlers(onLegendStateChanged, onLegendScroll),
  );
  return {
    onLegendStateChanged,
    onLegendScroll,
    unmount,
    handlers: result.current,
  };
}

/** Lets the pending single click time out. */
function waitForSingleClick() {
  act(() => {
    jest.advanceTimersByTime(LEGEND_DOUBLE_CLICK_INTERVAL);
  });
}

/** Advances less than the double click window, so a pending click survives. */
function waitBetweenClicks() {
  act(() => {
    jest.advanceTimersByTime(LEGEND_DOUBLE_CLICK_INTERVAL / 2);
  });
}

test('isolateLegendSeries hides every series but the given one', () => {
  expect(isolateLegendSeries(ALL_VISIBLE, 'b')).toEqual({
    a: false,
    b: true,
    c: false,
  });
});

test('isolateLegendSeries restores every series when already isolated', () => {
  expect(isolateLegendSeries({ a: false, b: true, c: false }, 'b')).toEqual(
    ALL_VISIBLE,
  );
});

test('isolateLegendSeries ignores previously hidden series', () => {
  expect(isolateLegendSeries({ a: true, b: true, c: false }, 'a')).toEqual({
    a: true,
    b: false,
    c: false,
  });
});

test('a single legend click is not reported until the double click window closes', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });

  // Reporting here would re-render the chart mid gesture
  expect(onLegendStateChanged).not.toHaveBeenCalled();

  waitForSingleClick();

  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
  expect(onLegendStateChanged).toHaveBeenCalledWith({
    a: true,
    b: false,
    c: true,
  });
});

test('double clicking a legend item isolates it without an intermediate update', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });
  waitBetweenClicks();
  // The second click flips the item back, so ECharts reports the selection
  // as it was before the double click started
  handlers.legendselectchanged({ name: 'b', selected: ALL_VISIBLE });

  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
  expect(onLegendStateChanged).toHaveBeenCalledWith({
    a: false,
    b: true,
    c: false,
  });

  // The superseded single click must not fire once the window elapses
  waitForSingleClick();
  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
});

test('double clicking an isolated legend item restores every series', () => {
  const { onLegendStateChanged, handlers } = setup();
  const isolated: LegendState = { a: false, b: true, c: false };

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: false, b: false, c: false },
  });
  waitBetweenClicks();
  handlers.legendselectchanged({ name: 'b', selected: isolated });

  expect(onLegendStateChanged).toHaveBeenCalledWith(ALL_VISIBLE);
});

test('two slow clicks on the same legend item stay two single clicks', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });
  waitForSingleClick();
  handlers.legendselectchanged({ name: 'b', selected: ALL_VISIBLE });
  waitForSingleClick();

  expect(onLegendStateChanged).toHaveBeenCalledTimes(2);
  expect(onLegendStateChanged).toHaveBeenLastCalledWith(ALL_VISIBLE);
});

test('quick clicks on different legend items report only the newer selection', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'a',
    selected: { a: false, b: true, c: true },
  });
  waitBetweenClicks();
  handlers.legendselectchanged({
    name: 'b',
    selected: { a: false, b: false, c: true },
  });
  waitForSingleClick();

  // ECharts reports the cumulative selection, so one update covers both clicks
  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
  expect(onLegendStateChanged).toHaveBeenCalledWith({
    a: false,
    b: false,
    c: true,
  });
});

test('a third quick click on an isolated item toggles it off', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });
  waitBetweenClicks();
  handlers.legendselectchanged({ name: 'b', selected: ALL_VISIBLE });
  waitBetweenClicks();
  handlers.legendselectchanged({
    name: 'b',
    selected: { a: false, b: false, c: false },
  });
  waitForSingleClick();

  expect(onLegendStateChanged).toHaveBeenLastCalledWith({
    a: false,
    b: false,
    c: false,
  });
});

test('the legend selector buttons are reported immediately', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectall({ selected: ALL_VISIBLE });
  expect(onLegendStateChanged).toHaveBeenLastCalledWith(ALL_VISIBLE);

  handlers.legendinverseselect({
    selected: { a: false, b: false, c: false },
  });
  expect(onLegendStateChanged).toHaveBeenLastCalledWith({
    a: false,
    b: false,
    c: false,
  });
});

test('a legend selector click discards a pending legend item click', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });
  handlers.legendselectall({ selected: ALL_VISIBLE });
  waitForSingleClick();

  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
  expect(onLegendStateChanged).toHaveBeenCalledWith(ALL_VISIBLE);
});

test('paging a scrolling legend reports the new scroll position', () => {
  const { onLegendScroll, handlers } = setup();

  handlers.legendscroll({ scrollDataIndex: 12 });

  expect(onLegendScroll).toHaveBeenCalledWith(12);
});

test('double clicking still isolates after the legend has been paged', () => {
  const { onLegendStateChanged, handlers } = setup();

  handlers.legendscroll({ scrollDataIndex: 2 });
  handlers.legendselectchanged({
    name: 'c',
    selected: { a: true, b: true, c: false },
  });
  waitBetweenClicks();
  handlers.legendselectchanged({ name: 'c', selected: ALL_VISIBLE });

  expect(onLegendStateChanged).toHaveBeenCalledTimes(1);
  expect(onLegendStateChanged).toHaveBeenCalledWith({
    a: false,
    b: false,
    c: true,
  });
});

test('a pending click is dropped when the chart unmounts', () => {
  const { onLegendStateChanged, handlers, unmount } = setup();

  handlers.legendselectchanged({
    name: 'b',
    selected: { a: true, b: false, c: true },
  });
  unmount();
  waitForSingleClick();

  expect(onLegendStateChanged).not.toHaveBeenCalled();
});
