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
import { SupersetClient } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
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

interface SemanticLayerOption {
  uuid: string;
  name: string;
}

interface AvailableView {
  name: string;
  already_added: boolean;
}

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
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
  const [runtimeUiSchema, setRuntimeUiSchema] = useState<
    UISchemaElement | undefined
  >();
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({});
  const [loadingRuntime, setLoadingRuntime] = useState(false);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
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

  // --- Misc ---
  const [saving, setSaving] = useState(false);
  const fetchGenRef = useRef(0);

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
      setLoadingViews(true);
      setAvailableViews([]);
      setSelectedViewNames([]);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/semantic_layer/${uuid}/views`,
          jsonPayload: { runtime_data: rData },
        });
        if (gen !== fetchGenRef.current) return;
        setAvailableViews(json.result ?? []);
      } catch {
        if (gen !== fetchGenRef.current) return;
        addDangerToast(t('An error occurred while fetching available views'));
      } finally {
        if (gen === fetchGenRef.current) setLoadingViews(false);
      }
    },
    [addDangerToast],
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

  // =========================================================================
  // Layer change — fetch runtime schema, clear downstream state
  // =========================================================================

  const handleLayerChange = useCallback(
    async (uuid: string) => {
      fetchGenRef.current += 1;
      const gen = fetchGenRef.current;

      setSelectedLayerUuid(uuid);
      if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
      if (viewsTimerRef.current) clearTimeout(viewsTimerRef.current);
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
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
      } catch {
        if (gen !== fetchGenRef.current) return;
        addDangerToast(
          t('An error occurred while fetching the runtime schema'),
        );
      } finally {
        if (gen === fetchGenRef.current) setLoadingRuntime(false);
      }
    },
    [applyRuntimeSchema, fetchViews, addDangerToast],
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
      setRuntimeData(data);
      errorsRef.current = errors ?? [];

      if (!selectedLayerUuid) return;
      const gen = fetchGenRef.current;

      // Dynamic deps changed → refresh schema (e.g. database → schema)
      const dynamicDeps = dynamicDepsRef.current;
      if (Object.keys(dynamicDeps).length > 0) {
        const hasSatisfiedDeps = Object.values(dynamicDeps).some(deps =>
          areDependenciesSatisfied(deps, data),
        );
        if (hasSatisfiedDeps) {
          const snapshot = serializeDependencyValues(dynamicDeps, data);
          if (snapshot !== lastDepSnapshotRef.current) {
            lastDepSnapshotRef.current = snapshot;
            // Config is changing — clear views
            setAvailableViews([]);
            setSelectedViewNames([]);
            lastViewsKeyRef.current = '';
            if (schemaTimerRef.current) clearTimeout(schemaTimerRef.current);
            const uuid = selectedLayerUuid;
            schemaRefreshGenRef.current += 1;
            const refreshGen = schemaRefreshGenRef.current;
            schemaTimerRef.current = setTimeout(async () => {
              setRefreshingSchema(true);
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
                // Reset before applying: the request itself succeeded, so a
                // throw inside applyRuntimeSchema must not be reported (or
                // retried) as a transient network failure.
                refreshErrorToastShownRef.current = false;
                retriedDepSnapshotRef.current = '';
                if (json.result) applyRuntimeSchema(json.result);
              } catch (error) {
                if (
                  gen !== fetchGenRef.current ||
                  refreshGen !== schemaRefreshGenRef.current
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
                // The form (and the user's selections) stay intact; only the
                // dynamic narrowing is stale, so surface it without blocking
                // — once per outage, not once per debounced attempt.
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
      }

      // No schema refresh needed — fetch views if form is valid
      if (errorsRef.current.length === 0) {
        scheduleFetchViews(selectedLayerUuid, data);
      }
    },
    [selectedLayerUuid, applyRuntimeSchema, scheduleFetchViews, addDangerToast],
  );

  // After a schema refresh settles, JSON Forms re-validates and fires
  // onChange → handleRuntimeFormChange handles view fetching. As a fallback
  // (in case onChange doesn't fire), try once refreshingSchema flips false.
  const prevRefreshingRef = useRef(false);
  useEffect(() => {
    if (prevRefreshingRef.current && !refreshingSchema && selectedLayerUuid) {
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
  }, [refreshingSchema, selectedLayerUuid, runtimeData, scheduleFetchViews]);

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
      setSelectedLayerUuid(null);
      setLoadingLayers(false);
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
      setLoadingRuntime(false);
      setRefreshingSchema(false);
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
    setSaving(true);
    try {
      const viewsToCreate = availableViews
        .filter(v => selectedViewNames.includes(v.name) && !v.already_added)
        .map(v => ({
          name: v.name,
          semantic_layer_uuid: selectedLayerUuid,
          configuration: runtimeData,
        }));

      const { json } = await SupersetClient.post({
        endpoint: '/api/v1/semantic_view/',
        jsonPayload: { views: viewsToCreate },
      });

      const created = Array.isArray(json?.result?.created)
        ? json.result.created
        : [];
      const errors = Array.isArray(json?.result?.errors)
        ? json.result.errors
        : [];

      if (created.length > 0) {
        addSuccessToast(t('%s semantic view(s) added', created.length));
      }

      if (errors.length > 0) {
        const failedNames = errors
          .map((error: { name?: string }) => error?.name)
          .filter((name: string | undefined): name is string => !!name);
        addDangerToast(
          failedNames.length > 0
            ? t(
                '%s semantic view(s) failed to add: %s',
                errors.length,
                failedNames.join(', '),
              )
            : t('%s semantic view(s) failed to add', errors.length),
        );
      }

      if (created.length > 0 && errors.length === 0) {
        onSuccess();
        onHide();
      } else if (errors.length === 0) {
        addDangerToast(t('An error occurred while adding semantic views'));
      }
    } catch {
      addDangerToast(t('An error occurred while adding semantic views'));
    } finally {
      setSaving(false);
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
    () => ({ refreshingSchema, formData: runtimeData }),
    [refreshingSchema, runtimeData],
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
      saveDisabled={newViewCount === 0 || saving}
      saveText={newViewCount > 0 ? t('Add %s view(s)', newViewCount) : t('Add')}
      saveLoading={saving}
    >
      <ModalContent>
        {/* Semantic Layer */}
        <ModalFormField label={t('Semantic Layer')}>
          <Select
            ariaLabel={t('Semantic layer')}
            placeholder={t('Select a semantic layer')}
            loading={loadingLayers}
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
              disabled={viewsDisabled}
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
