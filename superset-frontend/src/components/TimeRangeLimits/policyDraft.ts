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
import { getClientErrorObject } from '@superset-ui/core';
import {
  completeRule,
  dashboardLimitLevels,
  DatasetLimits,
  DraftPolicy,
  DraftRule,
  FieldErrors,
  hasLimits,
  looserThanGlobal,
  Policy,
  Rule,
  RULE_NAMES,
  RuleName,
  ruleShapeErrors,
  Source,
  zeroWindowError,
} from 'src/utils/timeRangeLimits';

export type TimeRangeLimitsState = 'loading' | 'ready' | 'failed' | 'noUnits';

export type TimeRangeLimitsFailure = {
  attempt: number;
  unitValue?: string;
  source?: Source;
};

/** What the dashboard save puts in `json_metadata.time_range_limits`. */
export type MetadataKey = { remove: true } | { remove: false; value: unknown };

export const NO_POLICY: Policy = {
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
};

export function loadFailureText(): string {
  return t(
    'Time range limits could not be loaded. Queries are paused to protect the database.',
  );
}

export function unitGoneText(value: string): string {
  return t(
    'Configured time grain %(value)s is no longer available. Select a supported unit.',
    { value },
  );
}

export function toDraft(policy: Policy | null): DraftPolicy {
  const draft = (rule: Rule): DraftRule => ({
    quantity: rule?.quantity ?? null,
    time_grain: rule?.time_grain ?? null,
  });
  return {
    max_span: draft(policy?.max_span ?? null),
    max_look_back: draft(policy?.max_look_back ?? null),
    max_look_forward: draft(policy?.max_look_forward ?? null),
  };
}

/** The draft's complete rules; a half-filled rule counts as blank. */
export function draftToPolicy(draft: DraftPolicy): Policy {
  return {
    max_span: completeRule(draft.max_span),
    max_look_back: completeRule(draft.max_look_back),
    max_look_forward: completeRule(draft.max_look_forward),
  };
}

export function ruleChanged(draft: DraftRule, stored: Rule): boolean {
  return (
    draft.quantity !== (stored?.quantity ?? null) ||
    (draft.time_grain || null) !== (stored?.time_grain ?? null)
  );
}

/** Whether the rule a save would send differs from the stored one. */
export function ruleSaveChanged(draft: DraftRule, stored: Rule): boolean {
  const complete = completeRule(draft);
  return (
    (complete?.quantity ?? null) !== (stored?.quantity ?? null) ||
    (complete?.time_grain ?? null) !== (stored?.time_grain ?? null)
  );
}

export const sameDraft = (a: DraftRule, b: DraftRule) =>
  a.quantity === b.quantity &&
  (a.time_grain || null) === (b.time_grain || null);

export const isBlank = (policy: Policy) =>
  RULE_NAMES.every(rule => !policy[rule]);

export type PolicyPayload = Policy & { schema_version: 1 };

/** The `policy` a save or the save check sends: `null` when every rule is blank. */
export function policyPayload(draft: DraftPolicy): PolicyPayload | null {
  const policy = draftToPolicy(draft);
  return isBlank(policy) ? null : { schema_version: 1, ...policy };
}

/**
 * The client errors of an edited policy, by `<rule>.<field>`, as the server's
 * shape and `check_stricter_than_global` checks. Only changed rules are
 * checked, so an untouched stale value never blocks a save.
 */
export function validateTimeRangeLimits({
  global,
  value,
  stored,
}: {
  global: Policy | null;
  value: DraftPolicy;
  stored: Policy | null;
}): FieldErrors {
  const errors: FieldErrors = {};
  const changed = RULE_NAMES.filter(rule =>
    ruleChanged(value[rule], stored?.[rule] ?? null),
  );
  changed.forEach(rule => {
    const shape = ruleShapeErrors(rule, value[rule]);
    Object.entries(shape).forEach(([field, message]) => {
      errors[`${rule}.${field}`] = message;
    });
    const complete = completeRule(value[rule]);
    if (!Object.keys(shape).length && complete) {
      const looser = looserThanGlobal(rule, complete, global?.[rule] ?? null);
      if (looser) {
        errors[`${rule}.${looser.field}`] = looser.message;
      }
    }
  });
  if (changed.some(rule => rule !== 'max_span')) {
    const zero = zeroWindowError(global, draftToPolicy(value));
    if (zero && !errors['max_look_forward.quantity']) {
      errors['max_look_forward.quantity'] = zero;
    }
  }
  return errors;
}

export async function failureOf(
  response: unknown,
): Promise<Omit<TimeRangeLimitsFailure, 'attempt'>> {
  const { errors } = await getClientErrorObject(
    response as Parameters<typeof getClientErrorObject>[0],
  );
  const extra = errors?.[0]?.extra;
  return {
    unitValue:
      typeof extra?.field === 'string' &&
      extra.field.endsWith('.time_grain') &&
      extra.value !== undefined
        ? String(extra.value)
        : undefined,
    source:
      typeof extra?.source === 'string' ? (extra.source as Source) : undefined,
  };
}

/** Field messages keyed `<prefix><rule>.<field>`, with the prefix stripped. */
export function fieldErrorsOf(message: unknown, prefix: string): FieldErrors {
  const errors: FieldErrors = {};
  if (message && typeof message === 'object') {
    Object.entries(message).forEach(([key, messages]) => {
      const field = key.startsWith(prefix) ? key.slice(prefix.length) : '';
      const [rule] = field.split('.');
      if (RULE_NAMES.includes(rule as RuleName)) {
        errors[field] = String(
          Array.isArray(messages) ? messages[0] : messages,
        );
      }
    });
  }
  return errors;
}

/** Whether the dashboard save check runs: never without a limit to check. */
export function dashboardSaveCheckEnabled({
  flag,
  state,
  errors,
  global,
  value,
  datasets,
}: {
  flag: boolean;
  state: TimeRangeLimitsState;
  errors: FieldErrors;
  global: Policy | null;
  value: DraftPolicy;
  datasets: DatasetLimits[];
}): boolean {
  return (
    flag &&
    state === 'ready' &&
    !Object.keys(errors).length &&
    hasLimits(
      dashboardLimitLevels({
        global,
        dashboard: draftToPolicy(value),
        datasets,
      }),
    )
  );
}

/** Whether the dataset save check runs: never without a limit to check. */
export function datasetSaveCheckEnabled({
  flag,
  isSqla,
  state,
  noTimeColumn,
  errors,
  global,
  value,
}: {
  flag: boolean;
  isSqla: boolean;
  state: TimeRangeLimitsState;
  noTimeColumn: boolean;
  errors: FieldErrors;
  global: Policy | null;
  value: DraftPolicy;
}): boolean {
  return (
    flag &&
    isSqla &&
    state === 'ready' &&
    !noTimeColumn &&
    !Object.keys(errors).length &&
    hasLimits([
      { source: 'global', policy: global },
      { source: 'dataset', policy: draftToPolicy(value) },
    ])
  );
}

export const EXTRA_KEY = 'time_range_limits';

type JsonObject = Record<string, unknown>;

export const parseObject = (text: string): JsonObject | undefined => {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The "Extra" text the editor shows, without `time_range_limits`, and the
 * key as the opener read it (`undefined` when absent). Text that isn't a JSON
 * object, or has no key, is returned unchanged.
 */
export function splitExtra(extra: string | undefined): {
  extra: string | undefined;
  keyAsRead: unknown;
} {
  const parsed = extra ? parseObject(extra) : undefined;
  if (!parsed || !(EXTRA_KEY in parsed)) {
    return { extra, keyAsRead: undefined };
  }
  const { [EXTRA_KEY]: keyAsRead, ...rest } = parsed;
  return { extra: JSON.stringify(rest), keyAsRead };
}

export type ExtraForResult =
  | { ok: true; extra: string | undefined }
  | { ok: false; error: string | null };
