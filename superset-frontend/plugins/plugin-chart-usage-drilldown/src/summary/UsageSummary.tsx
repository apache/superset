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
import { useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { autoBucketSize, Bucket, DAY_MS, groupSlots, HOUR_MS } from './buckets';
import type { UsageSummaryProps } from './types';
import { notifyEmbedHost } from '../notifyEmbedHost';

// Slots are bucketed in UTC (like the SQL time grain), so dates are shown in
// UTC too; local time could shift a bar onto the neighbouring date.
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const dayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

const hourOfDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});
const timeOnly = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

const dayCount = (n: number) => (n === 1 ? t('1 day') : t('%s days', n));
const hourCount = (n: number) => (n === 1 ? t('1 hour') : t('%s hours', n));
const slotCount = (n: number, step: number) =>
  step === HOUR_MS ? hourCount(n) : dayCount(n);

// Hourly: "Oct 12, 2026, 5:00 AM – 6:00 AM". Daily: "Jan 28, 2026", or
// "Jan 28 – Feb 3, 2026" for buckets longer than a day.
function bucketLabel(bucket: Bucket, step: number) {
  if (step === HOUR_MS) {
    return `${hourOfDay.format(bucket.start)} – ${timeOnly.format(bucket.end)}`;
  }
  const lastDay = bucket.end - DAY_MS;
  if (lastDay === bucket.start) return dayWithYear.format(bucket.start);
  const sameYear =
    new Date(bucket.start).getUTCFullYear() ===
    new Date(lastDay).getUTCFullYear();
  const start = (sameYear ? shortDate : dayWithYear).format(bucket.start);
  return `${start} – ${dayWithYear.format(lastDay)}`;
}

const Wrapper = styled.div<{ height: number }>`
  ${({ theme, height }) => `
    box-sizing: border-box;
    display: flex;
    max-height: ${height}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: 12px;
    background: ${theme.colorBgContainer};
    color: ${theme.colorText};
    overflow: auto;

    .us-main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      padding: 24px 20px 20px;
      background: ${theme.colorBgLayout};
    }

    .us-status {
      display: flex;
      flex: 0 0 35%;
      flex-direction: column;
      min-width: 240px;
      padding: 20px 20px 20px;
      border-left: 1px solid ${theme.colorBorderSecondary};
    }

    .us-stats {
      display: flex;
      gap: 20px;
    }

    .us-stat + .us-stat {
      padding-left: 20px;
      border-left: 1px solid ${theme.colorBorderSecondary};
    }

    .us-stat .us-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 4px 0 8px;
    }

    .us-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .us-stat-value {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
    }

    .us-pill {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }

    .us-strip {
      display: flex;
      gap: 3px;
      height: 28px;
      margin-top: auto;
    }

    .us-strip span {
      flex: 1;
      border-radius: 2px;
      background: ${theme.colorFillSecondary};
    }

    .us-strip-caption {
      margin-top: 8px;
      color: ${theme.colorTextTertiary};
      font-size: 11px;
    }

    .us-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .us-title {
      margin: 4px 0 10px;
      color: ${theme.colorTextTertiary};
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .us-total {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }

    .us-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }

    .us-toggle {
      display: inline-flex;
      padding: 2px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: 6px;
    }

    .us-toggle button {
      padding: 2px 8px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: none;
      color: ${theme.colorTextTertiary};
      font: inherit;
      cursor: pointer;
    }

    .us-toggle button[aria-pressed='true'] {
      border-color: ${theme.colorBorderSecondary};
      background: ${theme.colorBgContainer};
      color: ${theme.colorText};
      font-weight: 600;
    }

    .us-range {
      padding: 3px 8px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: 6px;
      background: ${theme.colorBgContainer};
      font-weight: 500;
    }

    .us-meta {
      margin: 18px 0 6px;
      color: ${theme.colorTextTertiary};
      font-size: 11px;
    }

    .us-bars {
      position: relative;
      display: flex;
      gap: 4px;
      height: 56px;
    }

    .us-col {
      display: flex;
      flex: 1;
      align-items: flex-end;
      min-width: 1px;
    }

    .us-bar {
      width: 100%;
      border-radius: 2px;
    }

    .us-bar-active {
      filter: brightness(0.7) saturate(1.6);
    }

    /* A day without data: a flat line on the baseline. */
    .us-bar-empty {
      height: 2px;
      background: ${theme.colorBorder};
    }

    .us-bar-empty.us-bar-active {
      background: ${theme.colorTextTertiary};
      filter: none;
    }

    .us-tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      z-index: 1;
      padding: 8px 10px;
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: 6px;
      background: ${theme.colorBgElevated};
      box-shadow: ${theme.boxShadowSecondary};
      color: ${theme.colorTextSecondary};
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
    }

    .us-tooltip-value {
      margin: 3px 0 2px;
      color: ${theme.colorText};
      font-size: 12px;
      font-weight: 700;
    }

    .us-empty {
      display: flex;
      height: 56px;
      align-items: center;
      justify-content: center;
      color: ${theme.colorTextTertiary};
    }

    .us-axis {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      color: ${theme.colorTextTertiary};
      font-size: 11px;
    }

    .us-period {
      margin-top: 6px;
      color: ${theme.colorTextTertiary};
      font-size: 11px;
      text-align: center;
    }

    .us-period strong {
      margin: 0 4px;
      color: ${theme.colorText};
      font-weight: 600;
    }
  `}
`;

const STRIP_BARS = 50;

const percentOf = (value: number, total: number) =>
  total ? ((value / total) * 100).toFixed(1) : '0.0';

// "rgb(74, 124, 94)" -> "rgba(74, 124, 94, 0.12)", for the pill background.
const tint = (color: string) =>
  color.replace('rgb(', 'rgba(').replace(')', ', 0.12)');

// Success bars first, failed bars at the end, anything left over neutral.
function stripColors(
  status: NonNullable<UsageSummaryProps['status']>,
  total: number,
): (string | undefined)[] {
  const share = (value: number) =>
    total ? Math.round((value / total) * STRIP_BARS) : 0;
  const failed = Math.min(share(status.failed), STRIP_BARS);
  const success = Math.min(share(status.success), STRIP_BARS - failed);
  return Array.from({ length: STRIP_BARS }, (_, i) => {
    if (i < success) return status.successColor;
    if (i >= STRIP_BARS - failed) return status.failedColor;
    return undefined;
  });
}

export default function UsageSummary({
  height,
  slots,
  step,
  period,
  title,
  bucketSizes,
  barColor,
  valueUnit,
  status,
}: UsageSummaryProps) {
  const hourly = step === HOUR_MS;
  useEffect(() => notifyEmbedHost('usage_summary'), [slots]);
  // Unset until the viewer picks a size; until then it follows the range.
  // Hourly ranges are short enough to always show one bar per hour.
  const [selectedSize, setSelectedSize] = useState<number>();
  const [hovered, setHovered] = useState<number | null>(null);
  // A size is only offered when the range is longer than it, so "7d" appears
  // for ranges over 7 days; the smallest size is always kept.
  const smallest = Math.min(...bucketSizes);
  const sizes = bucketSizes.filter(
    option => option === smallest || option < slots.length,
  );
  const size = hourly
    ? 1
    : selectedSize && sizes.includes(selectedSize)
      ? selectedSize
      : autoBucketSize(slots.length, sizes);

  const buckets = useMemo(
    () => groupSlots(slots, size, step),
    [slots, size, step],
  );
  const total = slots.reduce((sum, slot) => sum + slot.value, 0);
  const max = Math.max(0, ...buckets.map(bucket => bucket.value));
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  // The time filter's own bounds when there is one, so "Last 3 hours" reads
  // as 3 hours rather than the whole hours or days its bars cover.
  const start = period?.from ?? first?.start;
  const end = period?.to ?? last?.end;
  const span =
    start !== undefined && end !== undefined
      ? Math.max(1, Math.round((end - start) / step))
      : 0;
  // A range that runs up to now reads as "Last 7 days".
  const isRecent = end !== undefined && end >= Date.now() - step;
  const active = hovered === null ? undefined : buckets[hovered];
  // Keep the tooltip inside the card for bars near either edge.
  const activeAt =
    hovered === null ? 0 : (hovered + 0.5) / Math.max(buckets.length, 1);
  const tooltipShift = activeAt < 0.15 ? 0 : activeAt > 0.85 ? -100 : -50;
  const activeShare =
    active && total ? ((active.value / total) * 100).toFixed(1) : '0.0';

  return (
    <Wrapper height={height}>
      <div className="us-main">
        <div className="us-top">
          <div>
            <div className="us-title">{title}</div>
            <div className="us-total">{total.toLocaleString('en-US')}</div>
          </div>
          <div className="us-controls">
            {!hourly && sizes.length > 1 && (
              <div
                className="us-toggle"
                role="group"
                aria-label={t('Bucket size')}
              >
                {sizes.map(option => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === size}
                    onClick={() => setSelectedSize(option)}
                  >
                    {t('%sd', option)}
                  </button>
                ))}
              </div>
            )}
            {span > 0 && (
              <span className="us-range">
                {isRecent
                  ? t('Last %s', slotCount(span, step))
                  : t('%s selected', slotCount(span, step))}
              </span>
            )}
          </div>
        </div>

        <div className="us-meta">
          {buckets.length === 1
            ? t('1 bar · %s each', slotCount(size, step))
            : t('%s bars · %s each', buckets.length, slotCount(size, step))}
        </div>

        {buckets.length ? (
          <div className="us-bars" onMouseLeave={() => setHovered(null)}>
            {buckets.map((bucket, i) => (
              <div
                key={bucket.start}
                className="us-col"
                onMouseEnter={() => setHovered(i)}
              >
                <div
                  className={[
                    'us-bar',
                    bucket.value ? '' : 'us-bar-empty',
                    i === hovered ? 'us-bar-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    bucket.value
                      ? {
                          height: `${(bucket.value / max) * 100}%`,
                          minHeight: 2,
                          background: barColor,
                        }
                      : undefined
                  }
                />
              </div>
            ))}
            {active && (
              <div
                className="us-tooltip"
                role="tooltip"
                style={{
                  left: `${activeAt * 100}%`,
                  transform: `translateX(${tooltipShift}%)`,
                }}
              >
                <div>{bucketLabel(active, step)}</div>
                <div className="us-tooltip-value">
                  {active.value.toLocaleString('en-US')}
                  {valueUnit && ` ${valueUnit}`}
                </div>
                <div>
                  {active.value
                    ? t('%s%% of period', activeShare)
                    : t('No %s consumed', valueUnit || t('data'))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="us-empty">
            {valueUnit ? t('No %s in this period', valueUnit) : t('No data')}
          </div>
        )}

        {first && last && start !== undefined && end !== undefined && (
          <>
            <div className="us-axis">
              <span>{(hourly ? timeOnly : shortDate).format(first.start)}</span>
              <span>{(hourly ? timeOnly : shortDate).format(last.start)}</span>
            </div>
            <div className="us-period">
              {t('From')}
              <strong>{fullDate.format(start)}</strong>
              {t('to')}
              {/* The filter's end is exclusive, like Superset's own "<" bound;
                  without a filter, show the last second of the last bar. */}
              <strong>{fullDate.format(period ? end : end - 1000)}</strong>
            </div>
          </>
        )}
      </div>
      {status && (
        <div className="us-status">
          <div className="us-stats">
            {[
              {
                label: t('Success'),
                value: status.success,
                color: status.successColor,
              },
              {
                label: t('Failed'),
                value: status.failed,
                color: status.failedColor,
              },
            ].map(stat => (
              <div key={stat.label} className="us-stat">
                <div className="us-title">
                  <span className="us-dot" style={{ background: stat.color }} />
                  {stat.label}
                </div>
                <div className="us-stat-value">
                  {stat.value.toLocaleString('en-US')}
                  <span
                    className="us-pill"
                    style={{ color: stat.color, background: tint(stat.color) }}
                  >
                    {percentOf(stat.value, total)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="us-strip" aria-hidden="true">
            {stripColors(status, total).map((color, i) => (
              <span key={i} style={color ? { background: color } : undefined} />
            ))}
          </div>
          <div className="us-strip-caption">
            {t(
              'Each bar = %s%% of consumed %s',
              100 / STRIP_BARS,
              valueUnit || t('total'),
            )}
          </div>
        </div>
      )}
    </Wrapper>
  );
}
