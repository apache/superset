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
import { t } from '@apache-superset/core/translation';
import type { Policy, Rule, Source } from '@superset-ui/core';
import {
  type DatasetLimits,
  describeLimit,
  type GrainUnit,
  grainLength,
  type Limit,
} from './rules';

/*
 * The write-side rule of the server (`_never_longer`, `_looser_than`,
 * `effective_rule`, `check_stricter_than_global`), used by the editors of the
 * dashboard and dataset limits.
 */

export type RuleValue = NonNullable<Rule>;

export type RuleName = keyof Policy;

export type RuleField = 'quantity' | 'time_grain';

export type TimeGrain = { value: string; label: string };

export type EditorLevel = 'dashboard' | 'dataset';

export type NeedsReview = { rule: RuleName; reason: string };

/** What every `…/time_range_limits/` GET of an editor returns. */
export type LimitsPayloadBase = {
  global: Policy | null;
  needs_review: NeedsReview[];
  eligible_time_grains: TimeGrain[];
  time_grain_labels?: Record<string, string>;
};

/** The current user's editor notice about the global limits. */
export type EditorNotice = { kind: 'turned_on' | 'tightened' };

/** `GET /api/v1/dashboard/{id}/time_range_limits/` */
export type DashboardLimitsPayload = LimitsPayloadBase & {
  dashboard: Policy;
  datasets: DatasetLimits[];
  timezone?: string;
  editor_notice?: EditorNotice | null;
};

/** `GET /api/v1/dataset/{id}/time_range_limits/` */
export type DatasetLimitsPayload = LimitsPayloadBase & {
  dataset: Policy;
};

/** A chart the save check names, with its Explore URL. */
export type SaveCheckItem = { id: number; slice_name: string; url: string };

/** A saved chart the proposed policy would refuse. */
export type SaveCheckChart = SaveCheckItem & {
  range: string | null;
  time_offset: string | null;
  reason_code: string;
  rule: RuleName | null;
  source: Source | null;
  message: string;
};

/** A time range filter default the proposed policy would refuse. */
export type SaveCheckFilter = {
  id: string;
  name: string;
  range: string | null;
  no_default: boolean;
  reason_code: string | null;
  rule: RuleName | null;
  source: Source | null;
  message: string | null;
};

/** `GET /api/v1/{dashboard|dataset}/{id}/time_range_limits/charts/` */
export type SaveCheckResult = {
  charts: SaveCheckChart[];
  filters: SaveCheckFilter[];
  unlimited: SaveCheckItem[];
  unchecked: SaveCheckItem[];
  /** Dataset check only: the dataset has more charts than the ones checked. */
  truncated?: boolean;
};

/** A rule as an editor holds it: either part can still be blank. */
export type DraftRule = { quantity: number | null; time_grain: string | null };

export type DraftPolicy = Record<RuleName, DraftRule>;

export type FieldErrors = Record<string, string>;

const MAX_QUANTITY = 9999;
const SECONDS: Partial<Record<GrainUnit, number>> = {
  second: 1,
  minute: 60,
  hour: 3600,
};
const DAYS: Partial<Record<GrainUnit, number>> = { day: 1, week: 7 };
const MONTHS: Partial<Record<GrainUnit, number>> = { month: 1, year: 12 };
// Shortest and longest number of days in 0..11 consecutive months, over any
// start date; a run of years counts 365 days each for the shortest and 366 for
// the longest.
const MIN_R = [0, 28, 59, 89, 120, 150, 181, 212, 242, 273, 303, 334];
const MAX_R = [0, 31, 62, 92, 123, 153, 184, 215, 245, 276, 306, 337];

const minDays = (months: number) =>
  365 * Math.floor(months / 12) + MIN_R[months % 12];

const maxDays = (months: number) =>
  366 * Math.floor(months / 12) + MAX_R[months % 12];

type Measure = { kind: 'seconds' | 'days' | 'months'; amount: number };

function measure(rule: RuleValue): Measure | null {
  const length = grainLength(rule.time_grain);
  if (!length) {
    return null;
  }
  const amount = length.count * rule.quantity;
  const { unit } = length;
  if (SECONDS[unit] !== undefined) {
    return { kind: 'seconds', amount: amount * SECONDS[unit]! };
  }
  if (DAYS[unit] !== undefined) {
    return { kind: 'days', amount: amount * DAYS[unit]! };
  }
  return { kind: 'months', amount: amount * MONTHS[unit]! };
}

export const isSubDay = (timeGrain: string) => {
  const length = grainLength(timeGrain);
  return length !== null && SECONDS[length.unit] !== undefined;
};

/** Whether both grains are sub-day, or both a day or longer. */
export function sameFamily(a: string, b: string): boolean {
  return isSubDay(a) === isSubDay(b);
}

/**
 * Whether `value` is never longer than `limit`, whatever the calendar. A
 * sub-day rule and a day-or-longer one never compare.
 */
export function neverLonger(value: RuleValue, limit: RuleValue): boolean {
  const valueMeasure = measure(value);
  const limitMeasure = measure(limit);
  if (!valueMeasure || !limitMeasure) {
    return false;
  }
  if (valueMeasure.kind === limitMeasure.kind) {
    return valueMeasure.amount <= limitMeasure.amount;
  }
  if (valueMeasure.kind === 'seconds' || limitMeasure.kind === 'seconds') {
    return false;
  }
  const longest =
    valueMeasure.kind === 'months'
      ? maxDays(valueMeasure.amount)
      : valueMeasure.amount;
  const shortest =
    limitMeasure.kind === 'months'
      ? minDays(limitMeasure.amount)
      : limitMeasure.amount;
  return longest <= shortest;
}

/**
 * The units a rule may use: those of the global unit's family when the global
 * level sets the rule, else every eligible one. A `stored` unit missing from
 * the list is added, so a stored value still reads right.
 */
export function allowedUnits(
  globalRule: Rule,
  eligible: TimeGrain[],
  stored?: string | null,
  labels?: Record<string, string>,
): TimeGrain[] {
  const units = globalRule
    ? eligible.filter(grain => sameFamily(grain.value, globalRule.time_grain))
    : eligible;
  if (!stored || units.some(grain => grain.value === stored)) {
    return units;
  }
  const known = eligible.find(grain => grain.value === stored);
  return [
    ...units,
    known ?? { value: stored, label: labels?.[stored] ?? stored },
  ];
}

export const ruleLabels = (): Record<RuleName, string> => ({
  max_span: t('Longest range'),
  max_look_back: t('Earliest start'),
  max_look_forward: t('Latest end'),
});

export const ruleDescriptions = (): Record<RuleName, string> => ({
  max_span: t('Start-to-end duration.'),
  max_look_back: t('Earliest start from now.'),
  max_look_forward: t('Latest end from now.'),
});

/**
 * A rule value in words: "1 year", "2 years ago",
 * "1 week from now", or "Today" / "Now" for a zero look-back or look-forward.
 * `duration` is the length text, e.g. the server's display label.
 */
export function describeRuleValue(
  rule: RuleName,
  limit: RuleValue,
  duration: string = describeLimit(limit),
): string {
  if (rule === 'max_span') {
    return duration;
  }
  if (limit.quantity === 0) {
    return isSubDay(limit.time_grain) ? t('Now') : t('Today');
  }
  return rule === 'max_look_back'
    ? t('%(duration)s ago', { duration })
    : t('%(duration)s from now', { duration });
}

const looserMessage = (rule: RuleName, limit: string) => {
  if (rule === 'max_span') {
    return t("Can't be longer than the admin limit (%(limit)s)", { limit });
  }
  if (rule === 'max_look_back') {
    return t("Can't be earlier than the admin limit (%(limit)s)", { limit });
  }
  return t("Can't be later than the admin limit (%(limit)s)", { limit });
};

/**
 * The server's `_looser_than`: the error of a value that can be longer than
 * the global one, in the editor's words (the server's 422 text differs).
 */
export function looserThanGlobal(
  rule: RuleName,
  value: RuleValue,
  globalRule: Rule,
): { field: RuleField; message: string } | null {
  if (!globalRule || neverLonger(value, globalRule)) {
    return null;
  }
  return {
    field: sameFamily(value.time_grain, globalRule.time_grain)
      ? 'quantity'
      : 'time_grain',
    message: looserMessage(rule, describeRuleValue(rule, globalRule)),
  };
}

/**
 * What a global and a level rule enforce together, as the server's
 * `effective_rule`: only one when it is never longer than the other (a tie
 * keeps the global one), else both.
 */
export function effectiveConstraints(
  globalRule: Rule,
  levelRule: Rule,
  source: Source = 'dashboard',
): Limit[] {
  const constraints: Limit[] = [];
  if (globalRule) {
    constraints.push({ source: 'global', ...globalRule });
  }
  if (levelRule) {
    constraints.push({ source, ...levelRule });
  }
  if (globalRule && levelRule) {
    if (neverLonger(globalRule, levelRule)) {
      return constraints.slice(0, 1);
    }
    if (neverLonger(levelRule, globalRule)) {
      return constraints.slice(1);
    }
  }
  return constraints;
}

/** The server's `effective_rule` display label, in the editor's value style. */
export function effectiveRuleLabel(
  rule: RuleName,
  globalRule: Rule,
  levelRule: Rule,
): string {
  const constraints = effectiveConstraints(globalRule, levelRule);
  if (!constraints.length) {
    return t('No limit');
  }
  if (constraints.length === 1) {
    return describeRuleValue(rule, constraints[0]);
  }
  return t('%(global)s and %(dashboard)s; both enforced', {
    global: describeRuleValue(rule, constraints[0]),
    dashboard: describeRuleValue(rule, constraints[1]),
  });
}

/**
 * Whether `a` is stricter than `b`: `true` when `b` is unset or `a` always
 * fits inside `b` and not the other way, `false` when `b` always fits inside
 * `a`, `null` when they can't be compared.
 */
export function stricterThan(a: RuleValue, b: Rule): boolean | null {
  if (!b) {
    return true;
  }
  if (neverLonger(b, a)) {
    return false;
  }
  if (neverLonger(a, b)) {
    return true;
  }
  return null;
}

/** A draft rule with both parts set, else `null`. */
export function completeRule(draft: DraftRule): Rule {
  return draft.quantity !== null && draft.time_grain
    ? { quantity: draft.quantity, time_grain: draft.time_grain }
    : null;
}

/** The shape errors of a draft rule, by field, as the server's `_parse_rule`. */
export function ruleShapeErrors(
  rule: RuleName,
  draft: DraftRule,
): Partial<Record<RuleField, string>> {
  const low = rule === 'max_span' ? 1 : 0;
  const { quantity, time_grain: timeGrain } = draft;
  if (quantity === null) {
    return {};
  }
  if (
    !Number.isInteger(quantity) ||
    quantity < low ||
    quantity > MAX_QUANTITY
  ) {
    return {
      quantity: t('Enter a whole number from %(low)s to %(high)s.', {
        low,
        high: MAX_QUANTITY,
      }),
    };
  }
  return timeGrain ? {} : { time_grain: t('Select a unit.') };
}

const isZero = (...rules: Rule[]) => rules.some(rule => rule?.quantity === 0);

/**
 * The server's zero-window check: a zero look-back and a zero look-forward, at
 * any level, leave no date range.
 */
export function zeroWindowError(
  globalPolicy: Policy | null,
  value: Pick<Policy, 'max_look_back' | 'max_look_forward'>,
): string | null {
  return isZero(globalPolicy?.max_look_back ?? null, value.max_look_back) &&
    isZero(globalPolicy?.max_look_forward ?? null, value.max_look_forward)
    ? t("Look-back and look-forward can't both be 0: no time range would fit.")
    : null;
}

export const DATASET_SAVE_CHECK_MAX_CHARTS = 50;
