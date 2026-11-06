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
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import type { RefSelectProps } from '@superset-ui/core/components';
import { RootState } from 'src/dashboard/types';
import {
  ALLOWED_KEY,
  formatBound,
  getRefreshFrequencyOptions,
  getRefreshPolicyErrors,
  isPlainObject,
  MAXIMUM_KEY,
  MINIMUM_KEY,
  POLICY_KEY,
  RefreshBoundKey,
  toBound,
} from '../../RefreshFrequency';

export const FREQUENCY_FIELD = 'refresh_frequency';
export const ALLOWED_FIELD = `${POLICY_KEY}.${ALLOWED_KEY}`;
export const MINIMUM_FIELD = `${POLICY_KEY}.${MINIMUM_KEY}`;
export const MAXIMUM_FIELD = `${POLICY_KEY}.${MAXIMUM_KEY}`;

export type RefreshPolicyValues = { policy: unknown; refreshFrequency: number };

type ParsedRefreshKeys = { policy: unknown; refreshFrequency: unknown };

/** Check whether dashboard metadata contains an explicit policy. */
export const isPolicyOn = (policy: unknown) =>
  policy !== undefined && policy !== null;

/** Read the allow switch from an object policy. */
export const isRefreshPolicyAllowed = (policy: unknown) =>
  isPlainObject(policy) && policy[ALLOWED_KEY] !== false;

/**
 * Refresh-section fields in focus order. Fields not listed here have no
 * control in the section and are shown in Advanced settings.
 */
export const getRefreshSectionFields = (policy: unknown): string[] => {
  if (!isPolicyOn(policy)) {
    return [FREQUENCY_FIELD];
  }
  if (!isPlainObject(policy)) {
    return [];
  }
  return [ALLOWED_FIELD, MINIMUM_FIELD, MAXIMUM_FIELD, FREQUENCY_FIELD];
};

/** Read interval configuration for dashboard and list modal openers. */
export const selectAdminRefreshIntervals = (state: RootState) =>
  state.dashboardInfo?.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS ??
  state.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;

/** Parse Advanced metadata without replacing incomplete edits. */
export const parseJsonObject = (
  text: string,
): Record<string, unknown> | undefined => {
  if (!text?.length) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const readParsedKeys = (
  metadata: Record<string, unknown> | undefined,
): ParsedRefreshKeys => ({
  policy: metadata?.[POLICY_KEY],
  refreshFrequency: metadata?.[FREQUENCY_FIELD],
});

const getFrequencyLabel = (value: number, adminList: unknown) =>
  getRefreshFrequencyOptions(adminList).find(option => option.value === value)
    ?.label ?? formatBound(toBound(value));

const getDefaultFrequencyMessage = (
  code: string,
  value: number,
  adminList: unknown,
): string | undefined => {
  switch (code) {
    case 'below_minimum':
      return t(
        'The saved default (%s) is shorter than the shortest interval. Pick another.',
        getFrequencyLabel(value, adminList),
      );
    case 'above_maximum':
      return t(
        'The saved default (%s) is longer than the longest interval. Pick another.',
        getFrequencyLabel(value, adminList),
      );
    case 'custom_not_allowed':
      return t(
        "The saved default (%s) isn't one of the standard intervals. Pick another.",
        getFrequencyLabel(value, adminList),
      );
    case 'auto_refresh_prohibited':
      return t(
        'A default of %s is set, but auto-refresh is off. Pick "Don\'t refresh".',
        getFrequencyLabel(value, adminList),
      );
    default:
      return undefined;
  }
};

interface UseRefreshPolicyProps {
  enabled?: boolean;
  refreshFrequency: number;
  setRefreshFrequency: (value: number) => void;
}

/** Manage policy edits, validation errors and accessible field focus. */
export function useRefreshPolicy({
  enabled = true,
  refreshFrequency,
  setRefreshFrequency,
}: UseRefreshPolicyProps) {
  const adminList = useSelector(selectAdminRefreshIntervals);
  const [policy, setPolicy] = useState<unknown>(undefined);
  const [readFrequency, setReadFrequency] = useState<unknown>(undefined);
  const [readPolicy, setReadPolicy] = useState<unknown>(undefined);
  const [serverErrors, setServerErrorsState] = useState<Record<string, string>>(
    {},
  );
  const [jsonFrequency, setJsonFrequency] = useState<unknown>(undefined);
  const lastParsed = useRef<ParsedRefreshKeys>({
    policy: undefined,
    refreshFrequency: undefined,
  });
  const changeCount = useRef(0);

  const allowedRef = useRef<HTMLDivElement>(null);
  const frequencyRef = useRef<HTMLDivElement>(null);
  const minimumRef = useRef<RefSelectProps>(null);
  const maximumRef = useRef<RefSelectProps>(null);

  const rememberJson = useCallback(
    (metadata: Record<string, unknown> | undefined) => {
      lastParsed.current = readParsedKeys(metadata);
      const value = metadata?.[FREQUENCY_FIELD];
      setJsonFrequency(
        value !== undefined && typeof value !== 'number' ? value : undefined,
      );
    },
    [],
  );

  const clearServerErrors = useCallback(() => {
    changeCount.current += 1;
    setServerErrorsState(previous =>
      Object.keys(previous).length ? {} : previous,
    );
  }, []);

  const apply = (next: RefreshPolicyValues): RefreshPolicyValues => {
    setPolicy(next.policy);
    if (next.refreshFrequency !== refreshFrequency) {
      setRefreshFrequency(next.refreshFrequency);
    }
    clearServerErrors();
    return next;
  };

  const load = useCallback(
    (metadata: Record<string, unknown> | undefined) => {
      const loaded = metadata?.[POLICY_KEY];
      setPolicy(loaded);
      setReadPolicy(loaded);
      setReadFrequency(metadata?.[FREQUENCY_FIELD] ?? 0);
      setServerErrorsState({});
      rememberJson(metadata);
    },
    [rememberJson],
  );

  const setPolicyOn = (on: boolean) => {
    if (on) {
      return apply({
        policy: isPlainObject(readPolicy)
          ? readPolicy
          : { [ALLOWED_KEY]: true },
        refreshFrequency:
          typeof lastParsed.current.refreshFrequency === 'number'
            ? lastParsed.current.refreshFrequency
            : refreshFrequency,
      });
    }
    return apply({
      policy: readPolicy === undefined ? undefined : null,
      refreshFrequency,
    });
  };

  const setAllowed = (on: boolean) => {
    if (!isPlainObject(policy)) {
      return { policy, refreshFrequency };
    }
    return apply({
      policy: { ...policy, [ALLOWED_KEY]: on },
      refreshFrequency,
    });
  };

  const setBound = (key: RefreshBoundKey, seconds: number | null) => {
    if (!isPlainObject(policy)) {
      return { policy, refreshFrequency };
    }
    const next: Record<string, unknown> = { ...policy };
    if (seconds === null) {
      delete next[key];
    } else {
      next[key] = toBound(seconds);
    }
    return apply({ policy: next, refreshFrequency });
  };

  const setFrequency = (value: number): RefreshPolicyValues => {
    setRefreshFrequency(value);
    clearServerErrors();
    return { policy, refreshFrequency: value };
  };

  const setFromJson = (parsed: Record<string, unknown>) => {
    const last = lastParsed.current;
    const next = readParsedKeys(parsed);
    rememberJson(parsed);
    let changed = false;
    let nextPolicy = policy;
    // The policy is copied first: whether refresh_frequency is copied depends
    // on the policy this same edit sets.
    if (
      Object.hasOwn(parsed, POLICY_KEY) &&
      !isEqual(next.policy, last.policy)
    ) {
      nextPolicy = next.policy;
      setPolicy(nextPolicy);
      changed = true;
    }
    if (
      isPolicyOn(nextPolicy) &&
      typeof next.refreshFrequency === 'number' &&
      !isEqual(next.refreshFrequency, last.refreshFrequency)
    ) {
      setRefreshFrequency(next.refreshFrequency);
      changed = true;
    }
    if (changed) {
      clearServerErrors();
    }
  };

  const setServerErrors = useCallback((map: Record<string, string>) => {
    setServerErrorsState(map);
  }, []);

  const errors = useMemo(() => {
    if (!enabled) return {};
    const result: Record<string, string> = {};
    Object.entries(
      getRefreshPolicyErrors(
        { [FREQUENCY_FIELD]: refreshFrequency, [POLICY_KEY]: policy },
        readPolicy,
        adminList,
        readFrequency,
      ),
    ).forEach(([field, { code, message }]) => {
      result[field] =
        (field === FREQUENCY_FIELD &&
          getDefaultFrequencyMessage(code, refreshFrequency, adminList)) ||
        message;
    });
    return { ...result, ...serverErrors };
  }, [
    enabled,
    adminList,
    policy,
    readPolicy,
    readFrequency,
    refreshFrequency,
    serverErrors,
  ]);

  const warnings = useMemo(() => {
    if (
      !enabled ||
      !isEqual(policy, readPolicy) ||
      refreshFrequency !== readFrequency
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(
        getRefreshPolicyErrors(
          { [FREQUENCY_FIELD]: refreshFrequency, [POLICY_KEY]: policy },
          readPolicy,
          adminList,
        ),
      ).map(([field, { code, message }]) => [
        field,
        (field === FREQUENCY_FIELD &&
          getDefaultFrequencyMessage(code, refreshFrequency, adminList)) ||
          message,
      ]),
    );
  }, [enabled, policy, readPolicy, refreshFrequency, readFrequency, adminList]);

  const sectionFields = useMemo(
    () => getRefreshSectionFields(policy),
    [policy],
  );

  const sectionErrors = useMemo(
    () =>
      sectionFields.flatMap(field => (errors[field] ? [errors[field]] : [])),
    [errors, sectionFields],
  );

  const advancedErrors = useMemo(() => {
    if (!enabled) return [];
    const lines = Object.entries(errors)
      .filter(([field]) => !sectionFields.includes(field))
      .map(([field, message]) => `${field}: ${message}`);
    if (isPolicyOn(policy) && jsonFrequency !== undefined) {
      const jsonError = getRefreshPolicyErrors(
        { [FREQUENCY_FIELD]: jsonFrequency, [POLICY_KEY]: policy },
        readPolicy,
        adminList,
      )[FREQUENCY_FIELD];
      if (jsonError?.code === 'invalid_refresh_frequency') {
        lines.push(`${FREQUENCY_FIELD}: ${jsonError.message}`);
      }
    }
    return lines;
  }, [
    enabled,
    adminList,
    errors,
    jsonFrequency,
    policy,
    readPolicy,
    sectionFields,
  ]);

  const focusField = useCallback((field: string): boolean => {
    let target: HTMLElement | null | undefined;
    if (field === ALLOWED_FIELD) {
      target =
        allowedRef.current?.querySelector<HTMLElement>('[role="switch"]');
    } else if (field === MINIMUM_FIELD || field === MAXIMUM_FIELD) {
      const select =
        field === MINIMUM_FIELD ? minimumRef.current : maximumRef.current;
      if (select) {
        select.focus();
        return Boolean(select.nativeElement.contains(document.activeElement));
      }
      return false;
    } else if (field === FREQUENCY_FIELD) {
      target =
        frequencyRef.current?.querySelector<HTMLElement>(
          'input[type="radio"]:checked',
        ) ??
        frequencyRef.current?.querySelector<HTMLElement>('input[type="radio"]');
    }
    if (!target) {
      return false;
    }
    target.focus();
    return document.activeElement === target;
  }, []);

  return {
    adminList,
    policy,
    errors,
    sectionErrors,
    warnings,
    advancedErrors,
    changeCount,
    refs: { allowedRef, frequencyRef, minimumRef, maximumRef },
    load,
    setPolicyOn,
    setAllowed,
    setBound,
    setFrequency,
    setFromJson,
    rememberJson,
    setServerErrors,
    clearServerErrors,
    focusField,
  };
}
