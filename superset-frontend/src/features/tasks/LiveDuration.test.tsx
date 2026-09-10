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
import { render, act } from 'spec/helpers/testing-library';
import LiveDuration from './LiveDuration';
import { formatDuration } from './timeUtils';

afterEach(() => {
  jest.useRealTimers();
});

test('renders the server duration statically when not live', () => {
  const { container } = render(
    <LiveDuration durationSeconds={42} live={false} />,
  );

  expect(container).toHaveTextContent(formatDuration(42) as string);
});

test('renders a dash when there is no duration', () => {
  const { container } = render(
    <LiveDuration durationSeconds={null} live={false} />,
  );

  expect(container.textContent).toBe('-');
});

test('does not tick when live is false', () => {
  jest.useFakeTimers();
  jest.setSystemTime(0);

  const { container } = render(
    <LiveDuration durationSeconds={60} live={false} />,
  );

  act(() => {
    jest.advanceTimersByTime(5000);
  });

  // Still the static server value, unchanged by the passage of time.
  expect(container).toHaveTextContent(formatDuration(60) as string);
});

test('ticks the duration upward once per second when live', () => {
  jest.useFakeTimers();
  jest.setSystemTime(0);

  const { container } = render(
    <LiveDuration durationSeconds={60} live locale="en" />,
  );

  // Anchored on the server value at mount.
  expect(container).toHaveTextContent(formatDuration(60, 'en') as string);

  act(() => {
    jest.advanceTimersByTime(3000);
  });

  // Base (60s) + locally-measured elapsed (3s), no timestamp parsing involved.
  expect(container).toHaveTextContent(formatDuration(63, 'en') as string);
});

test('re-anchors on a fresh server duration instead of compounding drift', () => {
  jest.useFakeTimers();
  jest.setSystemTime(0);

  const { container, rerender } = render(
    <LiveDuration durationSeconds={60} live locale="en" />,
  );

  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(container).toHaveTextContent(formatDuration(63, 'en') as string);

  // A realtime nudge patches the row with a fresh server value: ticking resumes
  // from it, not from the previous anchor plus all elapsed time.
  rerender(<LiveDuration durationSeconds={100} live locale="en" />);
  expect(container).toHaveTextContent(formatDuration(100, 'en') as string);

  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(container).toHaveTextContent(formatDuration(101, 'en') as string);
});
