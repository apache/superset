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
import { fireEvent, render, screen } from '@superset-ui/core/spec';
import UsageSummary from '../../src/summary/UsageSummary';
import { DAY_MS, HOUR_MS } from '../../src/summary/buckets';

const SEP_21 = Date.UTC(2026, 8, 21);
const days = [100, 200, 300, 400, 500, 600, 700].map((value, i) => ({
  start: SEP_21 + i * DAY_MS,
  value,
}));

function renderSummary(extra = {}) {
  return render(
    <UsageSummary
      height={240}
      width={800}
      slots={days}
      step={DAY_MS}
      title="Consumed API calls"
      bucketSizes={[1, 3]}
      barColor="rgb(157, 184, 168)"
      valueUnit="calls"
      {...extra}
    />,
  );
}

test('shows the title, total, dates and one bar per day', () => {
  const { container } = renderSummary();
  expect(screen.getByText('Consumed API calls')).toBeInTheDocument();
  expect(screen.getByText('2,800')).toBeInTheDocument();
  expect(screen.getByText('7 days selected')).toBeInTheDocument();
  expect(screen.getByText('7 bars · 1 day each')).toBeInTheDocument();
  expect(screen.getByText('Sep 21')).toBeInTheDocument();
  expect(screen.getByText('Sep 27')).toBeInTheDocument();
  expect(screen.getByText('Sep 21, 2026, 12:00:00 AM')).toBeInTheDocument();
  expect(screen.getByText('Sep 27, 2026, 11:59:59 PM')).toBeInTheDocument();
  expect(container.querySelectorAll('.us-bar')).toHaveLength(7);
});

test('the range label and From/To use the time filter bounds', () => {
  renderSummary({
    period: { from: SEP_21 + 2 * DAY_MS, to: SEP_21 + 9 * DAY_MS },
  });
  expect(screen.getByText('7 days selected')).toBeInTheDocument();
  expect(screen.getByText('Sep 23, 2026, 12:00:00 AM')).toBeInTheDocument();
  expect(screen.getByText('Sep 30, 2026, 12:00:00 AM')).toBeInTheDocument();
});

test('a short time range shows hourly bars and its exact bounds', () => {
  const from = SEP_21 + 5 * HOUR_MS + 20 * 60 * 1000; // 05:20
  const to = from + 3 * HOUR_MS; // 08:20
  const hours = [5, 6, 7, 8].map((h, i) => ({
    start: SEP_21 + h * HOUR_MS,
    value: i * 10,
  }));
  const { container } = renderSummary({
    slots: hours,
    step: HOUR_MS,
    period: { from, to },
  });
  expect(screen.getByText('3 hours selected')).toBeInTheDocument();
  expect(screen.getByText('4 bars · 1 hour each')).toBeInTheDocument();
  expect(screen.getByText('Sep 21, 2026, 5:20:00 AM')).toBeInTheDocument();
  expect(screen.getByText('Sep 21, 2026, 8:20:00 AM')).toBeInTheDocument();
  expect(screen.getByText('5:00 AM')).toBeInTheDocument();
  expect(screen.getByText('8:00 AM')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '3d' })).not.toBeInTheDocument();
  expect(container.querySelectorAll('.us-bar')).toHaveLength(4);

  fireEvent.mouseEnter(container.querySelectorAll('.us-col')[1]);
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Sep 21, 2026, 6:00 AM – 7:00 AM',
  );
});

test('a time range ending now reads as "Last …"', () => {
  const to = Date.now();
  renderSummary({
    slots: [{ start: Math.floor(to / HOUR_MS) * HOUR_MS, value: 1 }],
    step: HOUR_MS,
    period: { from: to - 3 * HOUR_MS, to },
  });
  expect(screen.getByText('Last 3 hours')).toBeInTheDocument();
});

test('switching to 3d groups the days into fewer bars', () => {
  const { container } = renderSummary();
  fireEvent.click(screen.getByRole('button', { name: '3d' }));
  expect(screen.getByRole('button', { name: '3d' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByText('3 bars · 3 days each')).toBeInTheDocument();
  expect(container.querySelectorAll('.us-bar')).toHaveLength(3);
});

test('hovering a bar shows its dates, value and share of the period', () => {
  const { container } = renderSummary();
  fireEvent.click(screen.getByRole('button', { name: '3d' }));
  fireEvent.mouseEnter(container.querySelectorAll('.us-col')[1]);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Sep 24 – Sep 26, 2026');
  expect(tooltip).toHaveTextContent('1,500 calls');
  expect(tooltip).toHaveTextContent('53.6% of period');
  expect(container.querySelectorAll('.us-bar')[1]).toHaveClass('us-bar-active');

  fireEvent.mouseLeave(container.querySelector('.us-bars')!);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('shows success and failed totals with their share when configured', () => {
  const { container } = renderSummary({
    status: {
      success: 2683,
      failed: 117,
      successColor: 'rgb(74, 124, 94)',
      failedColor: 'rgb(200, 40, 40)',
    },
  });
  expect(screen.getByText('2,683')).toBeInTheDocument();
  expect(screen.getByText('95.8%')).toBeInTheDocument();
  expect(screen.getByText('117')).toBeInTheDocument();
  expect(screen.getByText('4.2%')).toBeInTheDocument();
  expect(
    screen.getByText('Each bar = 2% of consumed calls'),
  ).toBeInTheDocument();
  const strip = [...container.querySelectorAll('.us-strip span')].map(
    bar => (bar as HTMLElement).style.background,
  );
  expect(strip).toHaveLength(50);
  expect(strip.filter(color => color === 'rgb(74, 124, 94)')).toHaveLength(48);
  expect(strip.slice(-3)).toEqual([
    'rgb(74, 124, 94)',
    'rgb(200, 40, 40)',
    'rgb(200, 40, 40)',
  ]);
});

test('has no status panel without success and failed metrics', () => {
  const { container } = renderSummary();
  expect(container.querySelector('.us-status')).not.toBeInTheDocument();
});

test('a range without calls still draws one flat bar per day', () => {
  const { container } = renderSummary({
    slots: days.map(day => ({ ...day, value: 0 })),
  });
  expect(container.querySelectorAll('.us-bar')).toHaveLength(7);
  expect(container.querySelectorAll('.us-bar-empty')).toHaveLength(7);
});

test('a day without data shows a flat bar and a "no calls" tooltip', () => {
  const { container } = renderSummary({
    slots: days.map((day, i) => (i === 3 ? { ...day, value: 0 } : day)),
  });
  const bars = container.querySelectorAll('.us-bar');
  expect(bars).toHaveLength(7);
  expect(bars[3]).toHaveClass('us-bar-empty');
  expect(container.querySelectorAll('.us-bar-empty')).toHaveLength(1);

  fireEvent.mouseEnter(container.querySelectorAll('.us-col')[3]);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('Sep 24, 2026');
  expect(tooltip).toHaveTextContent('0 calls');
  expect(tooltip).toHaveTextContent('No calls consumed');
});

test('only offers bucket sizes shorter than the range', () => {
  renderSummary({ bucketSizes: [1, 3, 7] });
  // 7 days: "7d" would be a single bar, so only 1d and 3d are offered.
  expect(screen.getByRole('button', { name: '1d' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '3d' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '7d' })).not.toBeInTheDocument();
});

test('a range of the smallest sizes only has no bucket toggle', () => {
  renderSummary({ slots: days.slice(0, 3), bucketSizes: [1, 3, 7] });
  expect(screen.queryByRole('group', { name: 'Bucket size' })).toBeNull();
});

test('offers 7d once the range is longer than 7 days', () => {
  const twoWeeks = Array.from({ length: 14 }, (_, i) => ({
    start: SEP_21 + i * DAY_MS,
    value: i,
  }));
  renderSummary({ slots: twoWeeks, bucketSizes: [1, 3, 7] });
  expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
});
