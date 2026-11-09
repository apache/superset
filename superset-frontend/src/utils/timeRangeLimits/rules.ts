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
import { t, tn } from '@apache-superset/core/translation';
import type { Level, Policy, Rule, Source } from '@superset-ui/core';
import { Dayjs, extendedDayjs } from '@superset-ui/core/utils/dates';

/*
 * A copy of the server's time range limit checks
 * (superset/utils/time_range_limits.py): the same maths and messages, run on
 * the naive server-local values /api/v1/time_range/ returns, so the browser
 * clock and time zone never take part. Keep both in step.
 */

export type { Level, Policy, Rule, Source };

export type GrainUnit =
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'hour'
  | 'minute'
  | 'second';

export type GrainLength = { count: number; unit: GrainUnit };

export type Limit = { source: Source; quantity: number; time_grain: string };

export type Constraint = Limit & GrainLength & { subDay: boolean };

export type Bound = { value: Dayjs; limit: Constraint };

export type EffectiveLimits = {
  maxSpan: Constraint[];
  earliestStart: Bound | null;
  latestEnd: Bound | null;
};

export type LimitReason =
  | 'NO_VALID_RANGE'
  | 'UNBOUNDED_RANGE'
  | 'MAX_SPAN_EXCEEDED'
  | 'MAX_LOOK_BACK_EXCEEDED'
  | 'MAX_LOOK_FORWARD_EXCEEDED';

export type LimitField = 'range' | 'start' | 'end';

export type LimitFailure = {
  reason: LimitReason;
  rule: keyof Policy | null;
  field: LimitField;
  limit: Limit | null;
  // The earliest start the span or look-back allows, or the exclusive latest
  // end the look-forward allows.
  bound?: Dayjs;
  message: string;
};

export type DateRange = { since: Dayjs | null; until: Dayjs | null };

type LengthUnit = GrainUnit | 'quarter';

const ALIASES: Record<string, string> = { 'PT0.5H': 'PT30M', 'P0.25Y': 'P3M' };
const QUARTER = 'P3M';
const GRAIN = /^(?:P([1-9][0-9]*)([DWMY])|PT([1-9][0-9]*)([HMS]))$/;
const DAY_UNITS: Record<string, GrainUnit> = {
  D: 'day',
  W: 'week',
  M: 'month',
  Y: 'year',
};
const SUB_DAY_UNITS: Record<string, GrainUnit> = {
  H: 'hour',
  M: 'minute',
  S: 'second',
};
const SUB_DAY_MS: Partial<Record<LengthUnit, number>> = {
  hour: 3_600_000,
  minute: 60_000,
  second: 1_000,
};
const DAY_MS = 86_400_000;
const SLACK_MS = 1_000;
const RULES: (keyof Policy)[] = [
  'max_span',
  'max_look_back',
  'max_look_forward',
];

export const RULE_NAMES: (keyof Policy)[] = RULES;

const UNIT_NAMES: Record<LengthUnit, (num: number) => string> = {
  day: num => tn('%(num)s day', '%(num)s days', num, { num }),
  week: num => tn('%(num)s week', '%(num)s weeks', num, { num }),
  month: num => tn('%(num)s month', '%(num)s months', num, { num }),
  quarter: num => tn('%(num)s quarter', '%(num)s quarters', num, { num }),
  year: num => tn('%(num)s year', '%(num)s years', num, { num }),
  hour: num => tn('%(num)s hour', '%(num)s hours', num, { num }),
  minute: num => tn('%(num)s minute', '%(num)s minutes', num, { num }),
  second: num => tn('%(num)s second', '%(num)s seconds', num, { num }),
};

export function parseServerDate(value: string | null): Dayjs | null {
  return value ? extendedDayjs.utc(value) : null;
}

export function grainLength(timeGrain: string): GrainLength | null {
  const match = GRAIN.exec(ALIASES[timeGrain] ?? timeGrain);
  if (!match) {
    return null;
  }
  if (match[1]) {
    return { count: Number(match[1]), unit: DAY_UNITS[match[2]] };
  }
  return { count: Number(match[3]), unit: SUB_DAY_UNITS[match[4]] };
}

const isQuarter = (timeGrain: string) =>
  (ALIASES[timeGrain] ?? timeGrain) === QUARTER;

const shift = (value: Dayjs, amount: number, unit: LengthUnit): Dayjs =>
  unit === 'quarter' ? value.add(3 * amount, 'month') : value.add(amount, unit);

const shiftBy = (limit: Constraint, value: Dayjs, sign: 1 | -1): Dayjs =>
  shift(value, sign * limit.count * limit.quantity, limit.unit);

const asLimit = ({
  source,
  quantity,
  time_grain: timeGrain,
}: Constraint): Limit => ({ source, quantity, time_grain: timeGrain });

const isUnset = (policy: Policy | null) =>
  !policy || RULES.every(rule => !policy[rule]);

/** Whether any level sets a rule, the opposite of `effectiveLimits` returning `null`. */
export function hasLimits(levels: Level[]): boolean {
  return levels.some(level => !isUnset(level.policy));
}

const lookBackBound = (limit: Constraint, today: Dayjs, now: Dayjs): Bound => ({
  value: shiftBy(limit, limit.subDay ? now.millisecond(0) : today, -1),
  limit,
});

const lookForwardBound = (
  limit: Constraint,
  today: Dayjs,
  now: Dayjs,
): Bound => ({
  value: limit.subDay
    ? shiftBy(limit, now.millisecond(0), 1)
    : shiftBy(limit, today, 1).add(1, 'day'),
  limit,
});

/**
 * Merge the limits of every level, as the server's
 * `get_effective_time_range_limits`. `today` and `now` come from the server.
 * Returns `null` when no level sets a rule, and `{ unavailable: true }` when a
 * rule has a time grain with no known length.
 */
export function effectiveLimits(
  levels: Level[],
  today: Dayjs,
  now: Dayjs,
): EffectiveLimits | { unavailable: true } | null {
  const setLevels = levels.filter(level => !isUnset(level.policy));
  if (!setLevels.length) {
    return null;
  }
  let unavailable = false;
  const constraints = (rule: keyof Policy): Constraint[] =>
    setLevels.flatMap(({ source, policy }) => {
      const value = policy?.[rule];
      if (!value) {
        return [];
      }
      const length = grainLength(value.time_grain);
      if (!length) {
        unavailable = true;
        return [];
      }
      return [
        {
          source,
          quantity: value.quantity,
          time_grain: value.time_grain,
          ...length,
          subDay: Object.values(SUB_DAY_UNITS).includes(length.unit),
        },
      ];
    });
  const maxSpan = constraints('max_span');
  const lookBack = constraints('max_look_back').map(limit =>
    lookBackBound(limit, today, now),
  );
  const lookForward = constraints('max_look_forward').map(limit =>
    lookForwardBound(limit, today, now),
  );
  if (unavailable) {
    return { unavailable: true };
  }
  // A tie keeps the first bound, which is the lower level.
  const earliestStart = lookBack.reduce<Bound | null>(
    (best, bound) =>
      best === null || bound.value.isAfter(best.value) ? bound : best,
    null,
  );
  const latestEnd = lookForward.reduce<Bound | null>(
    (best, bound) =>
      best === null || bound.value.isBefore(best.value) ? bound : best,
    null,
  );
  return { maxSpan, earliestStart, latestEnd };
}

const lengthUnit = (limit: Constraint): LengthUnit =>
  isQuarter(limit.time_grain) ? 'quarter' : limit.unit;

export function describeLimit(rule: {
  quantity: number;
  time_grain: string;
}): string {
  if (isQuarter(rule.time_grain)) {
    return UNIT_NAMES.quarter(rule.quantity);
  }
  const length = grainLength(rule.time_grain);
  if (!length) {
    return rule.time_grain;
  }
  return UNIT_NAMES[length.unit](length.count * rule.quantity);
}

const fits = (since: Dayjs, until: Dayjs, amount: number, unit: LengthUnit) =>
  !shift(until, -amount, unit).isBefore(since);

const MONTHS_PER_UNIT: Partial<Record<LengthUnit, number>> = {
  month: 1,
  quarter: 3,
  year: 12,
};

const REST_UNITS: Partial<Record<LengthUnit, LengthUnit>> = {
  week: 'day',
  day: 'hour',
  hour: 'minute',
  minute: 'second',
};

const unitMs = (unit: LengthUnit) =>
  SUB_DAY_MS[unit] ?? (unit === 'week' ? 7 * DAY_MS : DAY_MS);

const withRest = (units: string, ms: number, unit: LengthUnit) => {
  const rest = Math.ceil(ms / unitMs(unit));
  if (!rest) {
    return units;
  }
  // i18n: a length as whole units plus the remainder in a smaller unit, e.g.
  // "6 hours and 1 minute"; "rest" is the remainder, not a pause
  return t('%(units)s and %(rest)s', { units, rest: UNIT_NAMES[unit](rest) });
};

/**
 * `until - since` in `unit`, as the server's `_describe_length`: whole units,
 * then the rest in the next smaller unit (days for a week or longer). Units of
 * a week or longer count back from `until`. The calendar month difference is
 * an upper bound on that count, so it only steps down.
 */
function describeLength(since: Dayjs, until: Dayjs, unit: LengthUnit): string {
  const ms = until.valueOf() - since.valueOf();
  if (unit === 'second') {
    return UNIT_NAMES.second(Math.ceil(ms / unitMs(unit)));
  }
  const restUnit = REST_UNITS[unit];
  if (restUnit) {
    const step = unitMs(restUnit);
    const length = Math.ceil(ms / step) * step;
    const count = Math.floor(length / unitMs(unit));
    return withRest(
      UNIT_NAMES[unit](count),
      length - count * unitMs(unit),
      restUnit,
    );
  }
  const months =
    (until.year() - since.year()) * 12 + until.month() - since.month();
  let count = Math.floor(months / (MONTHS_PER_UNIT[unit] ?? 1));
  while (count > 0 && !fits(since, until, count, unit)) {
    count -= 1;
  }
  return withRest(
    UNIT_NAMES[unit](count),
    shift(until, -count, unit).valueOf() - since.valueOf(),
    'day',
  );
}

// Keep English dates to match the server messages and parity fixtures.
const formatDate = (value: Dayjs) =>
  `${value.locale('en').format('MMM')} ${value.date()}, ${value.year()}`;

const formatBound = (value: Dayjs, limit: Constraint) => {
  if (!limit.subDay) {
    return formatDate(value);
  }
  const timeFormat =
    limit.unit === 'second' || value.second() ? 'HH:mm:ss' : 'HH:mm';
  return `${formatDate(value)} ${value.format(timeFormat)}`;
};

const describeStart = ({ value, limit }: Bound) => {
  if (limit.quantity === 0) {
    return limit.subDay ? t('now') : t('today');
  }
  return t('%(date)s (%(duration)s ago)', {
    date: formatBound(value, limit),
    duration: describeLimit(limit),
  });
};

const describeEnd = ({ value, limit }: Bound) => {
  if (limit.quantity === 0) {
    return limit.subDay ? t('now') : t('today');
  }
  // A day-or-longer bound is the exclusive midnight, so show the last allowed day.
  const shown = limit.subDay ? value : value.subtract(1, 'day');
  return t('%(date)s (%(duration)s from now)', {
    date: formatBound(shown, limit),
    duration: describeLimit(limit),
  });
};

const unboundedMessage = (since: Dayjs | null, dashboardId?: number) => {
  if (dashboardId !== undefined) {
    return t(
      'This chart requires a bounded time range. Ask a dashboard editor to add or scope a time range filter.',
    );
  }
  if (since) {
    return t('An end date is required.');
  }
  return t('Choose a start and an end date. Time range limits are on.');
};

/** The span that binds a range to `until`: the one with the latest start. */
export function bindingSpan(
  until: Dayjs,
  maxSpan: Constraint[],
): { limit: Constraint; start: Dayjs } | null {
  return maxSpan.reduce<{ limit: Constraint; start: Dayjs } | null>(
    (binding, limit) => {
      const start = shiftBy(limit, until, -1);
      return binding === null || start.isAfter(binding.start)
        ? { limit, start }
        : binding;
    },
    null,
  );
}

function rangeFailures(
  since: Dayjs,
  until: Dayjs,
  limits: EffectiveLimits,
): LimitFailure[] {
  const failures: LimitFailure[] = [];
  const { earliestStart: start, latestEnd: end } = limits;
  const binding = bindingSpan(until, limits.maxSpan);
  if (binding && since.isBefore(binding.start)) {
    failures.push({
      reason: 'MAX_SPAN_EXCEEDED',
      rule: 'max_span',
      field: 'range',
      limit: asLimit(binding.limit),
      bound: binding.start,
      message: t(
        "Range can't be longer than %(limit)s. This one is %(length)s.",
        {
          limit: describeLimit(binding.limit),
          length: describeLength(since, until, lengthUnit(binding.limit)),
        },
      ),
    });
  }
  const slack = (bound: Bound) => (bound.limit.subDay ? SLACK_MS : 0);
  if (start && since.valueOf() < start.value.valueOf() - slack(start)) {
    failures.push({
      reason: 'MAX_LOOK_BACK_EXCEEDED',
      rule: 'max_look_back',
      field: 'start',
      limit: asLimit(start.limit),
      bound: start.value,
      message: t("Start can't be earlier than %(date)s.", {
        date: describeStart(start),
      }),
    });
  }
  if (end && until.valueOf() > end.value.valueOf() + slack(end)) {
    failures.push({
      reason: 'MAX_LOOK_FORWARD_EXCEEDED',
      rule: 'max_look_forward',
      field: 'end',
      limit: asLimit(end.limit),
      bound: end.value,
      message: t("End can't be later than %(date)s.", {
        date: describeEnd(end),
      }),
    });
  }
  return failures;
}

/**
 * Every rule a date range breaks, as the server's `validate_date_range` checks
 * them, but collected instead of stopping at the first: the range too long,
 * starting too early, ending too late. An impossible policy or an open range
 * is the only failure. Throws when `since` is after `until`.
 */
export function allFailures(
  range: DateRange,
  limits: EffectiveLimits,
  options: { timeOffset?: string; dashboardId?: number } = {},
): LimitFailure[] {
  const { since, until } = range;
  if (since && until && since.isAfter(until)) {
    throw new Error('since must not be later than until');
  }
  const { earliestStart: start, latestEnd: end } = limits;
  let failures: LimitFailure[];
  if (start && end && !start.value.isBefore(end.value)) {
    failures = [
      {
        reason: 'NO_VALID_RANGE',
        rule: null,
        field: 'range',
        limit: null,
        message: t(
          'No time range fits the limits: the earliest start (%(earliest)s) is not before the latest end (%(latest)s). Ask an editor or admin to fix the limits.',
          { earliest: describeStart(start), latest: describeEnd(end) },
        ),
      },
    ];
  } else if (!since || !until) {
    failures = [
      {
        reason: 'UNBOUNDED_RANGE',
        rule: null,
        field: since ? 'end' : 'range',
        limit: null,
        message: unboundedMessage(since, options.dashboardId),
      },
    ];
  } else {
    failures = rangeFailures(since, until, limits);
  }
  const { timeOffset } = options;
  if (timeOffset === undefined) {
    return failures;
  }
  return failures.map(failure => ({
    ...failure,
    message: t('Time comparison "%(offset)s": %(message)s', {
      offset: timeOffset,
      message: failure.message,
    }),
  }));
}

/**
 * A failure's message as the picker shows it. On a dashboard, a missing end
 * reads as a field error; the server text stays in `message`.
 */
export function describeFailure(
  failure: LimitFailure,
  onDashboard = false,
): string {
  if (
    onDashboard &&
    failure.reason === 'UNBOUNDED_RANGE' &&
    failure.field === 'end'
  ) {
    return t('End is required on this dashboard');
  }
  return failure.message;
}

/** The length of `since` to `until` in the unit of a span `limit`, e.g. "365 days". */
export function describeSpanLength(
  limit: Limit,
  since: Dayjs,
  until: Dayjs,
): string {
  const unit: LengthUnit = isQuarter(limit.time_grain)
    ? 'quarter'
    : (grainLength(limit.time_grain)?.unit ?? 'day');
  return describeLength(since, until, unit);
}

/**
 * The one reason a range breaks the limits: its first failure. On a dashboard
 * a span failure reads as the dashboard's span text, with the range's length when
 * `range` is given.
 */
export function describeFirstFailure(
  failures: LimitFailure[],
  onDashboard = false,
  range?: { since: Dayjs; until: Dayjs },
): string | undefined {
  const [failure] = failures;
  if (!failure) {
    return undefined;
  }
  if (
    !onDashboard ||
    failure.reason !== 'MAX_SPAN_EXCEEDED' ||
    !failure.limit
  ) {
    return describeFailure(failure, onDashboard);
  }
  const limit = describeLimit(failure.limit);
  if (!range) {
    return t('Longer than this dashboard allows (%(limit)s)', { limit });
  }
  return t('%(length)s, longer than this dashboard allows (%(limit)s)', {
    length: describeSpanLength(failure.limit, range.since, range.until),
    limit,
  });
}

const LIMIT_SENTENCES: Record<Source, (limits: string) => string> = {
  dashboard: limits => t('Limit on this dashboard: %(limits)s.', { limits }),
  dataset: limits => t('Limit on this dataset: %(limits)s.', { limits }),
  global: limits => t('Admin limit: %(limits)s.', { limits }),
};

const lookBackPart = ({ limit }: Bound) => {
  if (limit.quantity === 0) {
    return limit.subDay ? t('from now') : t('from today');
  }
  return t('within the last %(limit)s', { limit: describeLimit(limit) });
};

const lookForwardPart = ({ limit }: Bound) => {
  if (limit.quantity === 0) {
    return limit.subDay ? t('up to now') : t('no future dates');
  }
  return t('up to %(limit)s ahead', { limit: describeLimit(limit) });
};

const limitParts = (
  limits: EffectiveLimits,
  until: Dayjs | null,
  today: Dayjs,
): { source: Source; text: string }[] => {
  const parts: { source: Source; text: string }[] = [];
  const span = bindingSpan(until ?? today, limits.maxSpan);
  if (span) {
    parts.push({
      source: span.limit.source,
      text: t('up to %(limit)s', { limit: describeLimit(span.limit) }),
    });
  }
  if (limits.earliestStart) {
    parts.push({
      source: limits.earliestStart.limit.source,
      text: lookBackPart(limits.earliestStart),
    });
  }
  if (limits.latestEnd) {
    parts.push({
      source: limits.latestEnd.limit.source,
      text: lookForwardPart(limits.latestEnd),
    });
  }
  return parts;
};

/**
 * The limits' words without a prefix, e.g. "up to 90 days, within the last
 * 13 months, no future dates"; empty when no rule is set. The span is the one
 * that binds a range to `until`, or to `today` when the range has no end.
 */
export function describeLimitParts(
  limits: EffectiveLimits,
  until: Dayjs | null,
  today: Dayjs,
): string {
  return limitParts(limits, until, today)
    .map(part => part.text)
    .join(', ');
}

/**
 * The limits in one line, e.g. "Limit on this dashboard: up to 90 days,
 * within the last 13 months, no future dates." The span is the one that binds
 * a range to `until`, or to `today` when the range has no end. On a
 * dashboard the prefix is always the dashboard's and the line has no full
 * stop. `timezone` is its own sentence, empty without a time zone.
 */
export function describeLimits(
  limits: EffectiveLimits,
  until: Dayjs | null,
  today: Dayjs,
  timezone?: string,
  onDashboard = false,
): { line: string; timezone: string } {
  const parts = limitParts(limits, until, today);
  if (!parts.length) {
    return { line: '', timezone: '' };
  }
  const text = describeLimitParts(limits, until, today);
  const sources = new Set(parts.map(part => part.source));
  let line: string;
  if (onDashboard) {
    line = t('Limit on this dashboard: %(limits)s', { limits: text });
  } else {
    line =
      sources.size === 1
        ? LIMIT_SENTENCES[parts[0].source](text)
        : t('Time range limit: %(limits)s.', { limits: text });
  }
  return {
    line,
    timezone: timezone ? t('Times in %(timezone)s.', { timezone }) : '',
  };
}

// A calendar cell is a browser-local day; compare its date as a naive
// server-local midnight, as the limits are.
const cellDay = (current: Dayjs) =>
  extendedDayjs.utc(current.format('YYYY-MM-DD'));

const wholeDayBefore = (day: Dayjs, bound: Dayjs) =>
  !day.add(1, 'day').isAfter(bound);

/** Start days outside the absolute limits, accounting for partial days. */
export function isStartDayDisabled(
  current: Dayjs,
  limits: EffectiveLimits,
): boolean {
  const day = cellDay(current);
  const { earliestStart, latestEnd } = limits;
  return (
    (earliestStart !== null && wholeDayBefore(day, earliestStart.value)) ||
    (latestEnd !== null && !day.isBefore(latestEnd.value))
  );
}

/** End days outside the absolute limits, accounting for partial days. */
export function isEndDayDisabled(
  current: Dayjs,
  limits: EffectiveLimits,
): boolean {
  const day = cellDay(current);
  const { earliestStart, latestEnd } = limits;
  return (
    (earliestStart !== null && wholeDayBefore(day, earliestStart.value)) ||
    (latestEnd !== null && day.isAfter(latestEnd.value))
  );
}

export type DatasetLimits = {
  id: number;
  name: string;
  policy: Policy | null;
  error?: {
    message: string;
    error_type: string;
    extra?: Record<string, unknown>;
  };
};

export const NO_LIMITS: EffectiveLimits = {
  maxSpan: [],
  earliestStart: null,
  latestEnd: null,
};

export function limitsFor(
  levels: Level[],
  today: Dayjs | null,
  now: Dayjs | null,
) {
  return today && now
    ? effectiveLimits(levels, today, now)
    : { unavailable: true as const };
}

/**
 * The levels of `GET /api/v1/dashboard/{id}/time_range_limits/`: the
 * global policy, one level per chart dataset that sets its own, then the
 * dashboard policy. The server's order, so a tie keeps the dataset.
 */
export function dashboardLimitLevels(payload: {
  global: Policy | null;
  dashboard: Policy | null;
  datasets?: DatasetLimits[];
  timezone?: string;
}): Level[] {
  return [
    { source: 'global', policy: payload.global },
    ...(payload.datasets ?? []).map((dataset): Level => ({
      source: 'dataset',
      policy: dataset.policy,
    })),
    { source: 'dashboard', policy: payload.dashboard },
  ];
}

/**
 * The levels of the Explore payload's `time_range_limits`: the global
 * policy, then the policy of the dataset Explore opened. The server's order.
 */
export function exploreLimitLevels(payload: {
  global?: Policy | null;
  dataset?: Policy | null;
}): Level[] {
  return [
    { source: 'global', policy: payload.global ?? null },
    { source: 'dataset', policy: payload.dataset ?? null },
  ];
}
