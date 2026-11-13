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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import {
  DashboardLimitsPayload,
  DatasetLimits,
  DatasetLimitsPayload,
  DraftPolicy,
  FieldErrors,
  NeedsReview,
  Policy,
  RULE_NAMES,
  RuleName,
  TimeGrain,
} from 'src/utils/timeRangeLimits';
import {
  dashboardSaveCheckEnabled,
  datasetSaveCheckEnabled,
  draftToPolicy,
  EXTRA_KEY,
  ExtraForResult,
  failureOf,
  fieldErrorsOf,
  isBlank,
  loadFailureText,
  MetadataKey,
  NO_POLICY,
  parseObject,
  policyPayload,
  ruleSaveChanged,
  sameDraft,
  TimeRangeLimitsFailure,
  TimeRangeLimitsState,
  toDraft,
  unitGoneText,
  validateTimeRangeLimits,
} from './policyDraft';
import useSaveCheck, { SaveCheck } from './useSaveCheck';

type CommonOptions = {
  id: number;
  show: boolean;
  /**
   * The `time_range_limits` the opener read: `undefined` until it has read
   * it (dashboard) or when it had none.
   */
  keyAsRead: unknown;
};

export type DashboardTimeRangeLimitsOptions = CommonOptions & {
  level: 'dashboard';
};

export type DatasetTimeRangeLimitsOptions = CommonOptions & {
  level: 'dataset';
  isSqla: boolean;
  noTimeColumn: boolean;
};

type CommonResult = {
  enabled: boolean;
  state: TimeRangeLimitsState;
  pending: boolean;
  failure?: TimeRangeLimitsFailure;
  global: Policy | null;
  needsReview: NeedsReview[];
  eligibleTimeGrains: TimeGrain[];
  timeGrainLabels?: Record<string, string>;
  stored: Policy;
  value: DraftPolicy;
  errors: FieldErrors;
  saveFailed: boolean;
  removing: boolean;
  onChange: (next: DraftPolicy) => void;
  retry: () => void;
  remove: () => void;
  setServerErrors: (errors: FieldErrors) => void;
  setSaveFailed: (failed: boolean) => void;
  validationErrors: () => string[];
  saveCheck: SaveCheck;
};

export type SaveResult = { ok: boolean; busy?: boolean; saved?: Policy };

export type DashboardTimeRangeLimits = CommonResult & {
  datasets: DatasetLimits[];
  save: () => Promise<SaveResult>;
  proposed: Policy | undefined;
  metadataKey: (saved?: Policy) => MetadataKey;
};

export type DatasetTimeRangeLimits = CommonResult & {
  loading: boolean;
  changed: boolean;
  extraFor: (text: string | undefined) => ExtraForResult;
};

type Payload = DashboardLimitsPayload | DatasetLimitsPayload;

type Loaded = {
  state: TimeRangeLimitsState;
  pending: boolean;
  payload?: Payload;
  failure?: TimeRangeLimitsFailure;
};

const LIMITS_REQUEST = { timeout: 10000, fetchRetryOptions: { retries: 0 } };

/**
 * Loads a dashboard's or a dataset's time range limits for its editor, and
 * holds the edited value. A dashboard's are saved with their own PUT
 * (`save`); a dataset's go inside the dataset PUT's `extra` (`extraFor`).
 */
function useTimeRangeLimits(
  options: DashboardTimeRangeLimitsOptions,
): DashboardTimeRangeLimits;
function useTimeRangeLimits(
  options: DatasetTimeRangeLimitsOptions,
): DatasetTimeRangeLimits;
function useTimeRangeLimits(
  options: DashboardTimeRangeLimitsOptions | DatasetTimeRangeLimitsOptions,
): DashboardTimeRangeLimits | DatasetTimeRangeLimits {
  const { level, id, show, keyAsRead } = options;
  const isSqla = options.level === 'dataset' ? options.isSqla : true;
  const noTimeColumn =
    options.level === 'dataset' ? options.noTimeColumn : false;
  const flag = isFeatureEnabled(FeatureFlag.TimeRangeLimits);
  const enabled = flag && isSqla;
  const [loaded, setLoaded] = useState<Loaded>({
    state: 'loading',
    pending: level === 'dashboard' || enabled,
  });
  const [stored, setStored] = useState<Policy | null>(null);
  const [value, setValue] = useState<DraftPolicy>(toDraft(null));
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const [removeClicked, setRemoveClicked] = useState(false);
  const saving = useRef(false);
  const loadRequest = useRef(0);
  const mounted = useRef(true);
  const endpoint = `/api/v1/${level}/${id}/time_range_limits/`;

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const applyPayload = useCallback(
    (payload: Payload) => {
      const policy =
        level === 'dashboard'
          ? (payload as DashboardLimitsPayload).dashboard
          : (payload as DatasetLimitsPayload).dataset;
      setLoaded({
        state: payload.eligible_time_grains.length ? 'ready' : 'noUnits',
        pending: false,
        payload,
      });
      setStored(policy);
      setValue(toDraft(policy));
      setServerErrors({});
    },
    [level],
  );

  const request = useCallback(() => {
    loadRequest.current += 1;
    const requestId = loadRequest.current;
    const isCurrent = () =>
      mounted.current && requestId === loadRequest.current;
    SupersetClient.get({ endpoint, ...LIMITS_REQUEST })
      .then(({ json }) => {
        if (isCurrent()) {
          applyPayload((json as { result: Payload }).result);
        }
      })
      .catch(async response => {
        const failure = await failureOf(response);
        if (!isCurrent()) {
          return;
        }
        setLoaded(previous => ({
          state: 'failed',
          pending: false,
          failure: {
            attempt: (previous.failure?.attempt ?? 0) + 1,
            ...failure,
          },
        }));
      });
  }, [endpoint, applyPayload]);

  const retry = useCallback(() => {
    setLoaded(previous => ({ ...previous, pending: true }));
    request();
  }, [request]);

  useEffect(() => {
    if (show && enabled) {
      setLoaded({ state: 'loading', pending: true });
      setRemoveClicked(false);
      setSaveFailed(false);
      request();
    }
  }, [show, enabled, request]);

  const { state, pending, payload, failure } = loaded;
  const global = payload?.global ?? null;
  const levelFailure = state === 'failed' && failure?.source === level;
  // The dashboard header opener applied a removal the page hasn't saved yet.
  const removing =
    levelFailure &&
    (removeClicked || (level === 'dashboard' && keyAsRead === null));

  const changed = RULE_NAMES.some(rule =>
    ruleSaveChanged(value[rule], stored?.[rule] ?? null),
  );

  const errors = useMemo(
    () =>
      state === 'ready' && !noTimeColumn
        ? {
            ...serverErrors,
            ...validateTimeRangeLimits({
              global,
              value,
              stored,
            }),
          }
        : {},
    [state, noTimeColumn, serverErrors, global, value, stored],
  );

  const datasets =
    (payload as DashboardLimitsPayload | undefined)?.datasets ?? [];
  const saveCheck = useSaveCheck({
    endpoint: `${endpoint}charts/`,
    policy: policyPayload(value),
    enabled:
      level === 'dashboard'
        ? dashboardSaveCheckEnabled({
            flag,
            state,
            errors,
            global,
            value,
            datasets,
          })
        : datasetSaveCheckEnabled({
            flag,
            isSqla,
            state,
            noTimeColumn,
            errors,
            global,
            value,
          }),
  });

  const onChange = useCallback(
    (next: DraftPolicy) => {
      setServerErrors(previous =>
        Object.fromEntries(
          Object.entries(previous).filter(([field]) => {
            const rule = field.split('.')[0] as RuleName;
            return sameDraft(next[rule], value[rule]);
          }),
        ),
      );
      setSaveFailed(false);
      setValue(next);
    },
    [value],
  );

  const unitValue = failure?.unitValue;
  // Only the dataset editor pauses its save when no level is named.
  const noSourceFailure =
    level === 'dataset' && state === 'failed' && !failure?.source;
  /** The section's errors for the editor's Save button. */
  const validationErrors = useCallback((): string[] => {
    if (!enabled) {
      return [];
    }
    if (levelFailure && !removing) {
      return [unitValue ? unitGoneText(unitValue) : loadFailureText()];
    }
    if (noSourceFailure) {
      return [loadFailureText()];
    }
    return [...new Set(Object.values(errors))];
  }, [enabled, levelFailure, removing, unitValue, noSourceFailure, errors]);

  const common: CommonResult = {
    enabled,
    state,
    pending,
    failure,
    global,
    needsReview: payload?.needs_review ?? [],
    eligibleTimeGrains: payload?.eligible_time_grains ?? [],
    timeGrainLabels: payload?.time_grain_labels,
    stored: stored ?? NO_POLICY,
    value,
    errors,
    saveFailed,
    removing,
    onChange,
    retry,
    remove: () => setRemoveClicked(true),
    setServerErrors,
    setSaveFailed,
    validationErrors,
    saveCheck,
  };

  if (level === 'dashboard') {
    /**
     * PUTs the edited limits when the section changed. Resolves to `ok:
     * false` when the save failed or one is already running (`busy`), with
     * the saved dashboard policy when a PUT succeeded.
     */
    const save = async (): Promise<SaveResult> => {
      if (state !== 'ready' || removing || !changed) {
        return { ok: true };
      }
      if (saving.current) {
        return { ok: false, busy: true };
      }
      saving.current = true;
      try {
        const { json } = await SupersetClient.put({
          endpoint,
          jsonPayload: { policy: policyPayload(value) },
          ...LIMITS_REQUEST,
        });
        const { result } = json as { result: DashboardLimitsPayload };
        applyPayload(result);
        setSaveFailed(false);
        return { ok: true, saved: result.dashboard };
      } catch (response) {
        const status = (response as Response | undefined)?.status;
        const fields =
          status === 400 || status === 422
            ? fieldErrorsOf(
                (await getClientErrorObject(response as Response)).message,
                'policy.',
              )
            : {};
        if (Object.keys(fields).length) {
          setServerErrors(fields);
        } else {
          setSaveFailed(true);
        }
        return { ok: false };
      } finally {
        saving.current = false;
      }
    };

    /**
     * The `time_range_limits` a dashboard save must carry: none when
     * removing, the saved or loaded dashboard policy when known, else the
     * key as read.
     */
    const metadataKey = (saved?: Policy): MetadataKey => {
      if (removing) {
        return { remove: true };
      }
      const policy =
        saved ??
        (state === 'ready' || state === 'noUnits' ? stored : undefined);
      if (policy !== undefined) {
        return policy === null || isBlank(policy)
          ? { remove: true }
          : { remove: false, value: { schema_version: 1, ...policy } };
      }
      return keyAsRead === null || keyAsRead === undefined
        ? { remove: true }
        : { remove: false, value: keyAsRead };
    };

    return {
      ...common,
      datasets,
      save,
      /** The edited limits a save would store, when the section changed. */
      proposed:
        state === 'ready' && !removing && changed
          ? draftToPolicy(value)
          : undefined,
      metadataKey,
    };
  }

  /**
   * The key the dataset save must carry: `null` for none, `undefined` when
   * the save must wait (loading, or a load failure that isn't the global's).
   */
  const currentKey = (): unknown => {
    if (removing) {
      return null;
    }
    if (pending || state === 'loading') {
      return undefined;
    }
    if (state === 'failed') {
      if (failure?.source === 'global') {
        return keyAsRead ?? null;
      }
      return undefined;
    }
    return policyPayload(changed && !noTimeColumn ? value : toDraft(stored));
  };

  /** The dataset PUT's `extra`: the "Extra" text with the current key. */
  const extraFor = (text: string | undefined): ExtraForResult => {
    if (!enabled) {
      return { ok: true, extra: text };
    }
    const key = currentKey();
    if (key === undefined) {
      return { ok: false, error: validationErrors()[0] ?? null };
    }
    const parsed = text?.trim() ? parseObject(text) : {};
    if (key === null) {
      if (!parsed || !(EXTRA_KEY in parsed)) {
        return { ok: true, extra: text };
      }
      const rest = { ...parsed };
      delete rest[EXTRA_KEY];
      return { ok: true, extra: JSON.stringify(rest) };
    }
    if (!parsed) {
      return {
        ok: false,
        error: t('Extra must be a JSON object to keep the time range limits.'),
      };
    }
    return { ok: true, extra: JSON.stringify({ ...parsed, [EXTRA_KEY]: key }) };
  };

  return {
    ...common,
    loading: enabled && pending,
    changed,
    extraFor,
  };
}

export default useTimeRangeLimits;
