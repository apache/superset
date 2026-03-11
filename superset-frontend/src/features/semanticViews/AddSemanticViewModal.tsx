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
import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Spin } from 'antd';
import { Select } from '@superset-ui/core/components';
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

  const applyRuntimeSchema = useCallback((rawSchema: JsonSchema) => {
    const schema = sanitizeSchema(rawSchema);
    setRuntimeSchema(schema);
    setRuntimeUiSchema(buildUiSchema(schema));
    dynamicDepsRef.current = getDynamicDependencies(rawSchema);
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
          // No runtime config needed — fetch views right away
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
            schemaTimerRef.current = setTimeout(async () => {
              setRefreshingSchema(true);
              try {
                const { json } = await SupersetClient.post({
                  endpoint: `/api/v1/semantic_layer/${uuid}/schema/runtime`,
                  jsonPayload: { runtime_data: data },
                });
                if (gen !== fetchGenRef.current) return;
                applyRuntimeSchema(json.result);
              } catch {
                // Silent fail on refresh — form still works
              } finally {
                if (gen === fetchGenRef.current) setRefreshingSchema(false);
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
    [selectedLayerUuid, applyRuntimeSchema, scheduleFetchViews],
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

      await SupersetClient.post({
        endpoint: '/api/v1/semantic_view/',
        jsonPayload: { views: viewsToCreate },
      });

      addSuccessToast(t('%s semantic view(s) added', viewsToCreate.length));
      onSuccess();
      onHide();
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

  const viewsDisabled =
    loadingViews || (!loadingViews && availableViews.length === 0);

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
                config={{ refreshingSchema, formData: runtimeData }}
                validationMode="ValidateAndHide"
                onChange={handleRuntimeFormChange}
              />
            </VerticalFormFields>
          </>
        )}

        {/* Semantic Views — always visible once a layer is selected */}
        {selectedLayerUuid && !loadingRuntime && (
          <ModalFormField label={t('Semantic Views')}>
            <Select
              ariaLabel={t('Semantic views')}
              placeholder={t('Select semantic views')}
              mode="multiple"
              loading={loadingViews}
              disabled={viewsDisabled}
              value={selectedViewNames}
              onChange={values => setSelectedViewNames(values as string[])}
              options={availableViews
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(v => ({
                  value: v.name,
                  label: v.already_added
                    ? `${v.name} (${t('already added')})`
                    : v.name,
                  disabled: v.already_added,
                }))}
              getPopupContainer={() => document.body}
            />
          </ModalFormField>
        )}
      </ModalContent>
    </StandardModal>
  );
}
