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
import { isEqual } from 'lodash-es';
import { t, tn } from '@apache-superset/core/translation';
import {
  getBoundSeconds,
  getRefreshFrequencyOptions,
} from './RefreshFrequencySelect';

export type RefreshBoundUnit = 'seconds' | 'minutes' | 'hours';
export type RefreshBound = { value: number; unit: RefreshBoundUnit };
export type RefreshPolicyError = { code: string; message: string };

export const POLICY_KEY = 'auto_refresh_policy';
export const MINIMUM_KEY = 'minimum_refresh_interval';
export const MAXIMUM_KEY = 'maximum_refresh_interval';
export const ALLOWED_KEY = 'auto_refresh_allowed';
export type RefreshBoundKey = typeof MINIMUM_KEY | typeof MAXIMUM_KEY;

const SWITCH_KEYS = [ALLOWED_KEY];
const BOUND_KEYS: RefreshBoundKey[] = [MINIMUM_KEY, MAXIMUM_KEY];

/** Check whether a metadata value can hold named policy fields. */
export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Represent whole seconds in the largest exact supported unit. */
export const toBound = (seconds: number): RefreshBound => {
  if (seconds % 3600 === 0) {
    return { value: seconds / 3600, unit: 'hours' };
  }
  if (seconds % 60 === 0) {
    return { value: seconds / 60, unit: 'minutes' };
  }
  return { value: seconds, unit: 'seconds' };
};

/** Format a duration for policy messages. */
export const formatBound = ({ value, unit }: RefreshBound): string => {
  if (unit === 'seconds') {
    return tn('%s second', '%s seconds', value, value);
  }
  if (unit === 'minutes') {
    return tn('%s minute', '%s minutes', value, value);
  }
  return tn('%s hour', '%s hours', value, value);
};

/**
 * Read positive whole intervals with the frontend's lenient config reader.
 * The server is authoritative and accepts only numeric config entries.
 */
export const getStandardSeconds = (adminList?: unknown): number[] =>
  getRefreshFrequencyOptions(adminList)
    .map(({ value }) => value)
    .filter(value => value > 0 && Number.isInteger(value));

/** Validate policy fields and their effective default frequency. */
export const getRefreshPolicyErrors = (
  metadata: Record<string, unknown>,
  readPolicy: unknown,
  adminList?: unknown,
  readFrequency?: unknown,
): Record<string, RefreshPolicyError> => {
  if (
    readFrequency !== undefined &&
    isEqual(metadata[POLICY_KEY], readPolicy) &&
    isEqual(metadata.refresh_frequency ?? 0, readFrequency)
  ) {
    return {};
  }
  const policy = metadata[POLICY_KEY];
  if (policy === undefined || policy === null) {
    return {};
  }
  if (!isPlainObject(policy)) {
    return {
      [POLICY_KEY]: {
        code: 'invalid_policy',
        message: t(
          'Auto-refresh policy must be an object with auto_refresh_allowed, ' +
            'minimum_refresh_interval and ' +
            'maximum_refresh_interval.',
        ),
      },
    };
  }

  const errors: Record<string, RefreshPolicyError> = {};
  const add = (field: string, code: string, message: string) => {
    if (!Object.hasOwn(errors, field)) {
      errors[field] = { code, message };
    }
  };

  Object.keys(policy).forEach(key => {
    if (![...SWITCH_KEYS, ...BOUND_KEYS].includes(key)) {
      add(`${POLICY_KEY}.${key}`, 'invalid_policy', t('Unknown field.'));
    }
  });
  SWITCH_KEYS.forEach(key => {
    if (Object.hasOwn(policy, key) && typeof policy[key] !== 'boolean') {
      add(
        `${POLICY_KEY}.${key}`,
        'invalid_policy',
        t('Must be true or false.'),
      );
    }
  });
  const policyShapeOk = Object.keys(errors).length === 0;
  const allowed = policy[ALLOWED_KEY] !== false;
  const standard = getStandardSeconds(adminList);
  const checkList = allowed && !isEqual(readPolicy, policy);

  const valid: Partial<Record<RefreshBoundKey, number>> = {};
  const setBounds = BOUND_KEYS.filter(
    key => policy[key] !== undefined && policy[key] !== null,
  );
  setBounds.forEach(key => {
    const field = `${POLICY_KEY}.${key}`;
    const seconds = getBoundSeconds(policy[key]);
    if (seconds === null) {
      add(
        field,
        'invalid_boundary',
        t('Use a whole number of seconds, minutes or hours.'),
      );
    } else if (checkList && !standard.includes(seconds)) {
      add(
        field,
        'invalid_boundary',
        t("%(interval)s isn't a standard interval. Select one from the list.", {
          interval: formatBound(policy[key] as RefreshBound),
        }),
      );
    } else {
      valid[key] = seconds;
    }
  });

  const minimum = valid[MINIMUM_KEY];
  const maximum = valid[MAXIMUM_KEY];
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    BOUND_KEYS.forEach(key =>
      add(
        `${POLICY_KEY}.${key}`,
        'minimum_greater_than_maximum',
        t(
          'Shortest interval must be shorter than or equal to the longest interval.',
        ),
      ),
    );
  } else if (
    allowed &&
    Object.keys(valid).length === setBounds.length &&
    !standard.some(
      value =>
        (minimum === undefined || value >= minimum) &&
        (maximum === undefined || value <= maximum),
    )
  ) {
    const fields = setBounds.length
      ? setBounds.map(key => `${POLICY_KEY}.${key}`)
      : [POLICY_KEY];
    fields.forEach(field =>
      add(
        field,
        'no_standard_interval',
        t(
          'No standard interval fits between the shortest and longest interval. Widen the range.',
        ),
      ),
    );
  }

  if (!policyShapeOk) {
    return errors;
  }

  const frequency = Object.hasOwn(metadata, 'refresh_frequency')
    ? metadata.refresh_frequency
    : 0;
  const field = 'refresh_frequency';
  if (
    typeof frequency !== 'number' ||
    !Number.isInteger(frequency) ||
    frequency < 0
  ) {
    add(
      field,
      'invalid_refresh_frequency',
      t('Refresh frequency must be 0 or a whole number of seconds.'),
    );
  } else if (!allowed) {
    if (frequency !== 0) {
      add(
        field,
        'auto_refresh_prohibited',
        t(
          'Auto-refresh isn\'t allowed on this dashboard. Set refresh frequency to "Don\'t refresh".',
        ),
      );
    }
  } else if (frequency > 0) {
    if (!standard.includes(frequency)) {
      add(
        field,
        'custom_not_allowed',
        t('Refresh frequency must be one of the standard intervals.'),
      );
    } else if (minimum !== undefined && frequency < minimum) {
      add(
        field,
        'below_minimum',
        t('Refresh frequency must be %(minimum)s or greater.', {
          minimum: formatBound(policy[MINIMUM_KEY] as RefreshBound),
        }),
      );
    } else if (maximum !== undefined && frequency > maximum) {
      add(
        field,
        'above_maximum',
        t('Refresh frequency must be %(maximum)s or less.', {
          maximum: formatBound(policy[MAXIMUM_KEY] as RefreshBound),
        }),
      );
    }
  }
  return errors;
};
