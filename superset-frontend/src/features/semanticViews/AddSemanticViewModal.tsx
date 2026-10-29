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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { styled } from '@apache-superset/core/theme';
import {
  ErrorTypeEnum,
  getClientErrorObject,
  SupersetClient,
  SupersetError,
} from '@superset-ui/core';
import { OAuth2RedirectMessage } from 'src/components/ErrorMessage';
import { List, Select } from '@superset-ui/core/components';
import { Alert } from '@apache-superset/core/components';
import { Spin } from '@superset-ui/core/components/Spin';
import { Icons } from '@superset-ui/core/components/Icons';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';
import { cellRegistryEntries } from '@great-expectations/jsonforms-antd-renderers';
import type { ErrorObject } from 'ajv';
import {
  StandardModal,
  ModalFormField,
  MODAL_STANDARD_WIDTH,
} from 'src/components/Modal';
import {
  renderers,
  sanitizeSchema,
  buildUiSchema,
  getDynamicDependencies,
  areDependenciesSatisfied,
  serializeDependencyValues,
  stableSerialize,
  SCHEMA_REFRESH_DEBOUNCE_MS,
} from 'src/features/semanticLayers/jsonFormsHelpers';
import {
  creationErrorMessage,
  isRecord,
  parseCreationResult,
} from './creationResult';

interface SemanticLayerOption {
  uuid: string;
  name: string;
}

interface AvailableView {
  name: string;
  already_added: boolean;
}

/** Keep manual text when discovery has no choices; drop invalid enum selections. */
export function reconcileDynamicFieldValues(
  previous: Record<string, unknown>,
  previousSchema: JsonSchema | null,
  rawSchema: JsonSchema,
): Record<string, unknown> {
  const invalidFields = Object.entries(rawSchema.properties ?? {})
    .filter(
      ([key, field]) =>
        (field as Record<string, unknown>)['x-dynamic'] === true &&
        Array.isArray(field.enum) &&
        (field.enum.length > 0 ||
          (previousSchema?.properties?.[key]?.enum?.length ?? 0) > 0) &&
        key in previous &&
        !field.enum.includes(previous[key]),
    )
    .map(([key]) => key);
  if (invalidFields.length === 0) return previous;
  const next = { ...previous };
  invalidFields.forEach(key => {
    delete next[key];
  });
  return next;
}

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const FailureDetails = styled.section`
  max-height: ${({ theme }) => theme.sizeUnit * 60}px;
  overflow-y: auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const SectionLabel = styled.div`
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSize}px;
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const VerticalFormFields = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;

  /* The antd renderer's VerticalLayout creates its own <Form> —
     force flex-column so gap controls spacing between fields */
  && form {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.sizeUnit * 4}px;
  }

  /* Reset antd default margins so gap controls all spacing */
  && .ant-form-item {
    margin-bottom: 0;
  }

  /* Override ant-form-item-horizontal: stack label above control */
  && .ant-form-item-row {
    flex-direction: column;
    align-items: stretch;
  }

  && .ant-form-item-label {
    text-align: left;
    max-width: 100%;
    flex: none;
    padding-bottom: ${({ theme }) => theme.sizeUnit}px;
  }

  && .ant-form-item-control {
    max-width: 100%;
    flex: auto;
  }

  && .ant-form-item-label > label {
    color: ${({ theme }) => theme.colorText};
    font-size: ${({ theme }) => theme.fontSize}px;
  }
`;

interface AddSemanticViewModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

export default function AddSemanticViewModal({
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: AddSemanticViewModalProps) {
  // --- Layer ---
  const [layers, setLayers] = useState<SemanticLayerOption[]>([]);
  const [selectedLayerUuid, setSelectedLayerUuid] = useState<string | null>(
    null,
  );
  const [loadingLayers, setLoadingLayers] = useState(false);

  // --- Runtime config ---
  const [runtimeSchema, setRuntimeSchema] = useState<JsonSchema | null>(null);
  // Read by the change handler without re-creating it on every schema load.
  const runtimeSchemaRef = useRef<JsonSchema | null>(null);
  runtimeSchemaRef.current = runtimeSchema;
  const [runtimeUiSchema, setRuntimeUiSchema] = useState<
    UISchemaElement | undefined
  >();
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({});
  const [loadingRuntime, setLoadingRuntime] = useState(false);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [staleSchemaOptions, setStaleSchemaOptions] = useState(false);
  const errorsRef = useRef<ErrorObject[]>([]);
  const dynamicDepsRef = useRef<Record<string, string[]>>({});
  const lastDepSnapshotRef = useRef('');
  const schemaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Views ---
  const [availableViews, setAvailableViews] = useState<AvailableView[]>([]);
  const [selectedViewNames, setSelectedViewNames] = useState<string[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const viewsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewsKeyRef = useRef('');
  // JSON Forms debounces onChange, so a change can arrive after unmount.
  const unmountedRef = useRef(false);

  // --- Misc ---
  const [saving, setSaving] = useState(false);
  const [creationErrors, setCreationErrors] = useState<
    { name: string; message: string }[]
  >([]);
  const fetchGenRef = useRef(0);
  // Bumped whenever dependent options go stale, so views queued or in
  // flight for a previous dependency state never land.
  const viewsGenRef = useRef(0);

  const [authentication, setAuthentication] = useState<{
    error: SupersetError<{ url: string; tab_id: string }>;
    retry: () => void;
  }>();
  const captureAuthenticationError = useCallback(
    async (
      error: Parameters<typeof getClientErrorObject>[0],
      retry: () => void,
      isCurrent: () => boolean,
    ): Promise<boolean> => {
      const parsed = await getClientErrorObject(error);
      if (!isCurrent()) return true;
      const oauthError = parsed.errors?.find(
        item => item.error_type === ErrorTypeEnum.OAUTH2_REDIRECT,
      );
      if (
        oauthError &&
        typeof oauthError.extra?.url === 'string' &&
        typeof oauthError.extra?.tab_id === 'string'
      ) {
        setAuthentication({
          error: {
            ...oauthError,
            extra: {
              url: oauthError.extra.url,
              tab_id: oauthError.extra.tab_id,
            },
          },
          retry,
        });
        return true;
      }
      return false;
    },
    [],
  );

  // =========================================================================
  // Fetch helpers
  // =========================================================================

  const fetchLayers = async () => {
    setLoadingLayers(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/semantic_layer/',
      });
      setLayers(
        (json.result ?? []).map((l: { uuid: string; name: string }) => ({
          uuid: l.uuid,
          name: l.name,
        })),
      );
    } catch {
      addDangerToast(t('An error occurred while fetching semantic layers'));
    } finally {
      setLoadingLayers(false);
    }
  };

  const fetchViews = useCallback(
    async (uuid: string, rData: Record<string, unknown>, gen: number) => {
      const viewsGen: number = viewsGenRef.current;
      const isCurrent = (): boolean =>
        gen === fetchGenRef.current && viewsGen === viewsGenRef.current;
      setLoadingViews(true);
      setAvailableViews([]);
      setSelectedViewNames([]);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/semantic_layer/${uuid}/views`,
          jsonPayload: { runtime_data: rData },
        });
        if (!isCurrent()) return;
        setAvailableViews(json.result ?? []);
      } catch (error) {
        if (!isCurrent()) return;
        if (
          await captureAuthenticationError(
            error,
            () => {
              fetchViews(uuid, rData, gen);
            },
            isCurrent,
          )
        )
          return;
        addDangerToast(t('An error occurred while fetching available views'));
      } finally {
        if (isCurrent()) setLoadingViews(false);
      }
    },
    [addDangerToast, captureAuthenticationError],
  );

  const lastSchemaJsonRef = useRef('');
  const refreshErrorToastShownRef = useRef(false);
  // Incremented per scheduled refresh so an out-of-order response from a
  // superseded request cannot apply a stale schema, toast, or roll back the
  // snapshot a newer request committed.
  const schemaRefreshGenRef = useRef(0);
  // Dependency state whose failed refresh has already been retried once, so
  // a persistent outage cannot re-fire on every subsequent form edit.
  const retriedDepSnapshotRef = useRef('');
  const applyRuntimeSchema = useCallback((rawSchema: JsonSchema) => {
    dynamicDepsRef.current = getDynamicDependencies(rawSchema);
    const previousSchema = runtimeSchemaRef.current;
    // Reconcile against the matching response, not an intermediate empty
    // option list. Retain selections that are valid in both dependency states.
    setRuntimeData(previous =>
      reconcileDynamicFieldValues(previous, previousSchema, rawSchema),
    );
    const schema = sanitizeSchema(rawSchema);
    const uiSchema = buildUiSchema(schema);
    // Dedupe key = key-order-canonical schema + the derived ui schema.
    // Canonicalizing alone would hide a refresh whose only change is
    // property order, but ``buildUiSchema`` derives field display order from
    // that order when ``x-propertyOrder`` is absent — including the ui schema
    // keeps such reorderings visible while still ignoring incidental
    // serialization differences elsewhere.
    const schemaJson = `${stableSerialize(schema)}|${JSON.stringify(uiSchema)}`;
    // A refresh response whose sanitized schema is unchanged keeps the
    // existing object identities: JSON Forms then neither rebuilds its AJV
    // validator (which caches one compiled copy per schema object — a per-
    // selection memory leak at large enum sizes) nor remounts the renderer
    // tree.
    if (schemaJson === lastSchemaJsonRef.current) return;
    lastSchemaJsonRef.current = schemaJson;
    setRuntimeSchema(schema);
    setRuntimeUiSchema(uiSchema);
  }, []);

  const scheduleFetchViews = useCallback(
    (uuid: string, data: Record<string, unknown>) => {
      const key = JSON.stringify(data);
      if (key === lastViewsKeyRef.current) return;
      lastViewsKeyRef.current = key;
      if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
      viewsTimerRef.current = setTimeout(() => {
        fetchViews(uuid, data, fetchGenRef.current);
      }, SCHEMA_REFRESH_DEBOUNCE_MS);
    },
    [fetchViews],
  );

  // Drop views queued or in flight for the previous dependency state.
  const invalidateViews = useCallback(() => {
    viewsGenRef.current += 1;
    if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
    setLoadingViews(false);
    setAvailableViews([]);
    setSelectedViewNames([]);
    lastViewsKeyRef.current = '';
  }, []);

  // =========================================================================
  // Layer change — fetch runtime schema, clear downstream state
  // =========================================================================

  const handleLayerChange = useCallback(
    async (uuid: string): Promise<void> => {
      fetchGenRef.current += 1;
      const gen = fetchGenRef.current;

      setSelectedLayerUuid(uuid);
      setCreationErrors([]);

      setAuthentication(undefined);
      if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
      if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
      setRefreshingSchema(false);
      setStaleSchemaOptions(false);
      errorsRef.current = [];
      dynamicDepsRef.current = {};
      lastDepSnapshotRef.current = '';
      lastSchemaJsonRef.current = '';
      refreshErrorToastShownRef.current = false;
      retriedDepSnapshotRef.current = '';
      schemaRefreshGenRef.current += 1;
      setAvailableViews([]);
      setSelectedViewNames([]);
      lastViewsKeyRef.current = '';

      setLoadingRuntime(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/semantic_layer/${uuid}/schema/runtime`,
          jsonPayload: {},
        });
        if (gen !== fetchGenRef.current) return;
        const schema = json.result;
        if (
          !schema?.properties ||
          Object.keys(schema.properties).length === 0
        ) {
          // Preserve top-level runtime metadata (e.g. x-singleView) even when
          // there are no form fields, then fetch views right away.  Skip the
          // apply call entirely if the backend returned no schema at all.
          if (schema) applyRuntimeSchema(schema);
          fetchViews(uuid, {}, gen);
        } else {
          applyRuntimeSchema(schema);
        }
      } catch (error) {
        if (gen !== fetchGenRef.current) return;
        if (
          await captureAuthenticationError(
            error,
            () => {
              handleLayerChange(uuid);
            },
            () => gen === fetchGenRef.current,
          )
        )
          return;
        addDangerToast(
          t('An error occurred while fetching the runtime schema'),
        );
      } finally {
        if (gen === fetchGenRef.current) setLoadingRuntime(false);
      }
    },
    [
      applyRuntimeSchema,
      fetchViews,
      addDangerToast,
      captureAuthenticationError,
    ],
  );

  // =========================================================================
  // Runtime form change — refresh dynamic fields or auto-fetch views
  // =========================================================================

  const handleRuntimeFormChange = useCallback(
    ({
      data,
      errors,
    }: {
      data: Record<string, unknown>;
      errors?: ErrorObject[];
    }) => {
      if (unmountedRef.current) return;
      if (stableSerialize(data) !== stableSerialize(runtimeData)) {
        setCreationErrors([]);
      }
      setRuntimeData(data);
      errorsRef.current = errors ?? [];

      if (!selectedLayerUuid) return;
      const gen = fetchGenRef.current;

      // Dynamic deps changed → refresh schema (e.g. database → schema)
      const dynamicDeps = dynamicDepsRef.current;
      if (Object.keys(dynamicDeps).length > 0) {
        // Count schema defaults as DynamicFieldControl does, so a dependency
        // satisfied only by its default still refreshes dependent options.
        const schema: JsonSchema | undefined =
          runtimeSchemaRef.current ?? undefined;
        const hasSatisfiedDeps = Object.values(dynamicDeps).some(deps =>
          areDependenciesSatisfied(deps, data, schema),
        );
        // Wait for input only while a missing dependency is required: a
        // refresh is the only way to clear stale options, so an empty
        // optional dependency must still refresh for that state.
        const required: string[] = Array.isArray(schema?.required)
          ? schema.required
          : [];
        const awaitsRequiredDependency = Object.values(dynamicDeps).some(deps =>
          deps.some(
            dep =>
              required.includes(dep) &&
              !areDependenciesSatisfied([dep], data, schema),
          ),
        );
        if (!hasSatisfiedDeps && awaitsRequiredDependency) {
          // Not a committed state: the next valid change must refresh.
          lastDepSnapshotRef.current = '';
          schemaRefreshGenRef.current += 1;
          if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
          setRefreshingSchema(false);
          setStaleSchemaOptions(true);
          invalidateViews();
          return;
        }
        const snapshot = serializeDependencyValues(dynamicDeps, data);
        if (snapshot !== lastDepSnapshotRef.current) {
          lastDepSnapshotRef.current = snapshot;
          setRefreshingSchema(true);
          setStaleSchemaOptions(true);
          // Config is changing — clear views
          invalidateViews();
          if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
          const uuid = selectedLayerUuid;
          schemaRefreshGenRef.current += 1;
          const refreshGen = schemaRefreshGenRef.current;
          schemaTimerRef.current = setTimeout(async () => {
            try {
              const { json } = await SupersetClient.post({
                endpoint: `/api/v1/semantic_layer/${uuid}/schema/runtime`,
                jsonPayload: { runtime_data: data },
              });
              if (
                gen !== fetchGenRef.current ||
                refreshGen !== schemaRefreshGenRef.current
              )
                return;
              if (!json.result)
                throw new Error('Runtime schema refresh returned no schema');
              // The request succeeded, so end the current outage; a later
              // failure can toast and retry again.
              refreshErrorToastShownRef.current = false;
              retriedDepSnapshotRef.current = '';
              applyRuntimeSchema(json.result);
              setStaleSchemaOptions(false);
            } catch (error) {
              if (
                gen !== fetchGenRef.current ||
                refreshGen !== schemaRefreshGenRef.current
              )
                return;
                if (
                  await captureAuthenticationError(
                    error,
                    () => {
                      lastDepSnapshotRef.current = '';
                      handleRuntimeFormChange({
                        data,
                        errors: errorsRef.current,
                      });
                    },
                    () =>
                      gen === fetchGenRef.current &&
                      refreshGen === schemaRefreshGenRef.current,
                  )
                )
                  return;
              logging.error('Runtime schema refresh failed', error);
              // Allow exactly one retry per dependency state: clearing the
              // committed snapshot lets the next change event re-attempt
              // the refresh, but only if this state hasn't been retried
              // already, so a persistent outage doesn't re-fire on every
              // edit. Only clear a snapshot this attempt still owns — a
              // newer change may have committed its own since.
              if (
                lastDepSnapshotRef.current === snapshot &&
                retriedDepSnapshotRef.current !== snapshot
              ) {
                retriedDepSnapshotRef.current = snapshot;
                lastDepSnapshotRef.current = '';
              }
              // Only scalar choices can remain unsafe after a failed refresh;
              // array choices are not reconciled and should not block views.
              const hasStaleScalarChoices = Object.entries(
                schema?.properties ?? {},
              ).some(
                ([key, field]) =>
                  (dynamicDeps[key] ?? []).some(dep => dep !== key) &&
                  field.type !== 'array' &&
                  field.type !== 'object' &&
                  Array.isArray(field.enum) &&
                  field.enum.length > 0,
              );
              setStaleSchemaOptions(hasStaleScalarChoices);
              // Retain selections and toast once per outage.
              if (!refreshErrorToastShownRef.current) {
                refreshErrorToastShownRef.current = true;
                addDangerToast(
                  t('An error occurred while refreshing the runtime schema'),
                );
              }
            } finally {
              if (
                gen === fetchGenRef.current &&
                refreshGen === schemaRefreshGenRef.current
              )
                setRefreshingSchema(false);
            }
          }, SCHEMA_REFRESH_DEBOUNCE_MS);
          return;
        }
      }

      // No schema refresh needed — fetch views if form is valid
      if (!staleSchemaOptions && errorsRef.current.length === 0) {
        scheduleFetchViews(selectedLayerUuid, data);
      }
    },
    [
      selectedLayerUuid,
      applyRuntimeSchema,
      scheduleFetchViews,
      invalidateViews,
      addDangerToast,
      staleSchemaOptions,
      runtimeData,
      captureAuthenticationError,
    ],
  );

  // After a schema refresh settles, JSON Forms re-validates and fires
  // onChange → handleRuntimeFormChange handles view fetching. As a fallback
  // (in case onChange doesn't fire), try once refreshingSchema flips false.
  const prevRefreshingRef = useRef(false);
  useEffect(() => {
    if (
      prevRefreshingRef.current &&
      !refreshingSchema &&
      !staleSchemaOptions &&
      selectedLayerUuid
    ) {
      const timer = setTimeout(() => {
        if (errorsRef.current.length === 0) {
          scheduleFetchViews(selectedLayerUuid, runtimeData);
        }
      }, 100);
      prevRefreshingRef.current = false;
      return () => clearTimeout(timer);
    }
    prevRefreshingRef.current = refreshingSchema;
    return undefined;
  }, [
    refreshingSchema,
    staleSchemaOptions,
    selectedLayerUuid,
    runtimeData,
    scheduleFetchViews,
  ]);

  // Closing the modal clears the debounce timers below, but unmounting it
  // while open does not go through that path. Without this, a pending schema
  // refresh or views fetch, a request already in flight, or a JSON Forms
  // change delivered late would still post or toast for a component that no
  // longer exists.
  useEffect(() => {
    // Reset on mount too: StrictMode runs this cleanup once in development
    // and then mounts again.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Drop in-flight continuations, as closing the modal does.
      fetchGenRef.current += 1;
      if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
      if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
    };
  }, []);

  // =========================================================================
  // Modal open / close
  // =========================================================================

  useEffect(() => {
    if (show) {
      fetchLayers();
    } else {
      fetchGenRef.current += 1;
      if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
      if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
      setLayers([]);
      setAuthentication(undefined);
      setSelectedLayerUuid(null);
      setLoadingLayers(false);
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
      setLoadingRuntime(false);
      setRefreshingSchema(false);
      setStaleSchemaOptions(false);
      errorsRef.current = [];
      dynamicDepsRef.current = {};
      lastDepSnapshotRef.current = '';
      lastSchemaJsonRef.current = '';
      refreshErrorToastShownRef.current = false;
      retriedDepSnapshotRef.current = '';
      schemaRefreshGenRef.current += 1;
      setAvailableViews([]);
      setSelectedViewNames([]);
      setLoadingViews(false);
      setSaving(false);
      setCreationErrors([]);
      lastViewsKeyRef.current = '';
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================================================================
  // Save
  // =========================================================================

  const newViewCount = availableViews.filter(
    v => selectedViewNames.includes(v.name) && !v.already_added,
  ).length;

  const handleSave = async () => {
    if (!selectedLayerUuid || newViewCount === 0) return;
    const gen = fetchGenRef.current;
    setSaving(true);
    setCreationErrors([]);
    try {
      const viewsToCreate = availableViews
        .filter(v => selectedViewNames.includes(v.name) && !v.already_added)
        .map(v => ({
          name: v.name,
          semantic_layer_uuid: selectedLayerUuid,
          configuration: runtimeData,
        }));

      let body: unknown;
      try {
        const { json } = await SupersetClient.post({
          endpoint: '/api/v1/semantic_view/',
          jsonPayload: { views: viewsToCreate },
        });
        body = json;
      } catch (error) {
        // SupersetClient rejects non-2xx responses before parsing their body.
        if (
          !isRecord(error) ||
          error.status !== 422 ||
          typeof error.json !== 'function'
        ) {
          throw error;
        }
        body = await error.json();
      }
      const { created, errors, failedCount } = parseCreationResult(body);
      // Committed creations must refresh the parent even after this modal closes.
      if (created.length > 0) {
        addSuccessToast(t('%s semantic view(s) added', created.length));
        onSuccess();
      }
      if (gen !== fetchGenRef.current) return;
      setCreationErrors(errors);

      if (created.length > 0) {
        setAvailableViews(previous =>
          previous.map(view =>
            created.includes(view.name)
              ? { ...view, already_added: true }
              : view,
          ),
        );
        setSelectedViewNames(previous =>
          previous.filter(name => !created.includes(name)),
        );
      }

      if (errors.length > 0) {
        const failedNames = errors.map(error => error.name).filter(Boolean);
        addDangerToast(
          failedNames.length > 0 && failedCount <= 3
            ? t(
                '%s semantic view(s) failed to add: %s',
                failedCount,
                failedNames.join(', '),
              )
            : failedCount > 0
              ? t('%s semantic view(s) failed to add', failedCount)
              : creationErrorMessage(),
        );
      }

      if (created.length > 0 && errors.length === 0) {
        onHide();
      }
    } catch {
      if (gen !== fetchGenRef.current) return;
      setCreationErrors([{ name: '', message: creationErrorMessage() }]);
      addDangerToast(creationErrorMessage());
    } finally {
      if (gen === fetchGenRef.current) setSaving(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  const hasRuntimeFields =
    runtimeSchema?.properties &&
    Object.keys(runtimeSchema.properties).length > 0;

  // Stable identity unless its inputs change: JSON Forms hands ``config`` to
  // every control, so an inline literal would re-render all of them on each
  // modal render.
  const jsonFormsConfig = useMemo(
    () => ({ refreshingSchema, staleSchemaOptions, formData: runtimeData }),
    [refreshingSchema, staleSchemaOptions, runtimeData],
  );

  // Sorted copy — sorting in place would mutate React state during render.
  const viewOptions = useMemo(
    () =>
      [...availableViews]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(v => ({
          value: v.name,
          label: v.already_added ? `${v.name} (${t('already added')})` : v.name,
          disabled: v.already_added,
        })),
    [availableViews],
  );

  const viewsDisabled =
    loadingViews || (!loadingViews && availableViews.length === 0);

  // When ``x-singleView: true`` the runtime form fully describes a single
  // semantic view (e.g. a MetricFlow cube).  Hide the picker and auto-select
  // whatever ``get_semantic_views`` returned so the Add button can fire
  // without an extra user click.
  const singleViewMode =
    (runtimeSchema as Record<string, unknown> | null)?.['x-singleView'] ===
    true;

  useEffect(() => {
    if (!singleViewMode) return;
    const namesToAdd = availableViews
      .filter(v => !v.already_added)
      .map(v => v.name)
      .slice(0, 1);
    setSelectedViewNames(prev => {
      if (
        prev.length === namesToAdd.length &&
        prev.every((n, i) => n === namesToAdd[i])
      ) {
        return prev;
      }
      return namesToAdd;
    });
  }, [singleViewMode, availableViews]);

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={t('Add Semantic View')}
      icon={<Icons.PlusOutlined />}
      width={MODAL_STANDARD_WIDTH}
      saveDisabled={
        newViewCount === 0 || saving || staleSchemaOptions || refreshingSchema
      }
      saveText={newViewCount > 0 ? t('Add %s view(s)', newViewCount) : t('Add')}
      saveLoading={saving}
    >
      <ModalContent>
        {creationErrors.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={t('Some semantic views could not be added')}
            description={
              <FailureDetails
                aria-label={t('Some semantic views could not be added')}
                tabIndex={0}
              >
                <List
                  dataSource={creationErrors}
                  renderItem={error => (
                    <List.Item>
                      {error.name
                        ? t('Failed to add %s: %s', error.name, error.message)
                        : error.message}
                    </List.Item>
                  )}
                />
              </FailureDetails>
            }
        )}
        {authentication && (
          <OAuth2RedirectMessage
            error={authentication.error}
            source="crud"
            errorMitigationFunction={() => {
              setAuthentication(undefined);
              authentication.retry();
            }}
          />
        )}
        {/* Semantic Layer */}
        <ModalFormField label={t('Semantic Layer')}>
          <Select
            ariaLabel={t('Semantic layer')}
            placeholder={t('Select a semantic layer')}
            loading={loadingLayers}
            disabled={saving}
            value={selectedLayerUuid}
            onChange={value => handleLayerChange(value as string)}
            options={layers.map(l => ({
              value: l.uuid,
              label: l.name,
            }))}
            getPopupContainer={() => document.body}
          />
        </ModalFormField>

        {/* Loading runtime schema */}
        {loadingRuntime && (
          <LoadingContainer>
            <Spin size="small" />
          </LoadingContainer>
        )}

        {/* Source location (runtime config fields) */}
        {hasRuntimeFields && !loadingRuntime && (
          <>
            <SectionLabel>{t('Source location')}</SectionLabel>
            <VerticalFormFields>
              <JsonForms
                readonly={saving}
                schema={runtimeSchema!}
                uischema={runtimeUiSchema}
                data={runtimeData}
                renderers={renderers}
                cells={cellRegistryEntries}
                config={jsonFormsConfig}
                validationMode="ValidateAndHide"
                onChange={handleRuntimeFormChange}
              />
            </VerticalFormFields>
          </>
        )}

        {/* Semantic Views — always visible once a layer is selected, unless
            the runtime schema declares ``x-singleView: true``: extensions
            (e.g. MetricFlow cubes) whose runtime form fully describes a
            single view set that flag so the picker disappears and the
            view is auto-selected when ``get_semantic_views`` returns it. */}
        {selectedLayerUuid && !loadingRuntime && !singleViewMode && (
          <ModalFormField label={t('Semantic Views')}>
            <Select
              ariaLabel={t('Semantic views')}
              placeholder={t('Select semantic views')}
              mode="multiple"
              loading={loadingViews}
              disabled={viewsDisabled || saving}
              value={selectedViewNames}
              onChange={values => setSelectedViewNames(values as string[])}
              options={viewOptions}
              getPopupContainer={() => document.body}
            />
          </ModalFormField>
        )}
      </ModalContent>
    </StandardModal>
  );
}
