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
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { SupersetClient } from '@superset-ui/core';
import { Checkbox, Spin } from 'antd';
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
  MODAL_MEDIUM_WIDTH,
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

type Step = 'layer' | 'configure' | 'select';

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

const BackLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colorPrimary};
  cursor: pointer;
  padding: 0;
  font-size: ${({ theme }) => theme.fontSize[1]}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;

  &:hover {
    text-decoration: underline;
  }
`;

const ViewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.sizeUnit * 6}px;
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
  const [step, setStep] = useState<Step>('layer');
  const [layers, setLayers] = useState<SemanticLayerOption[]>([]);
  const [selectedLayerUuid, setSelectedLayerUuid] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 2: Configure (runtime schema)
  const [runtimeSchema, setRuntimeSchema] = useState<JsonSchema | null>(null);
  const [runtimeUiSchema, setRuntimeUiSchema] = useState<
    UISchemaElement | undefined
  >(undefined);
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({});
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [hasRuntimeErrors, setHasRuntimeErrors] = useState(false);
  const errorsRef = useRef<ErrorObject[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDepSnapshotRef = useRef<string>('');
  const dynamicDepsRef = useRef<Record<string, string[]>>({});

  // Step 3: Select views
  const [availableViews, setAvailableViews] = useState<AvailableView[]>([]);
  const [selectedViews, setSelectedViews] = useState<Set<string>>(new Set());
  const [loadingViews, setLoadingViews] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (show) {
      fetchLayers();
    } else {
      setStep('layer');
      setLayers([]);
      setSelectedLayerUuid(null);
      setLoading(false);
      setSaving(false);
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
      setRefreshingSchema(false);
      setHasRuntimeErrors(false);
      errorsRef.current = [];
      lastDepSnapshotRef.current = '';
      dynamicDepsRef.current = {};
      setAvailableViews([]);
      setSelectedViews(new Set());
      setLoadingViews(false);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLayers = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const applyRuntimeSchema = useCallback((rawSchema: JsonSchema) => {
    const schema = sanitizeSchema(rawSchema);
    setRuntimeSchema(schema);
    setRuntimeUiSchema(buildUiSchema(schema));
    dynamicDepsRef.current = getDynamicDependencies(rawSchema);
  }, []);

  const fetchRuntimeSchema = useCallback(
    async (uuid: string, currentRuntimeData?: Record<string, unknown>) => {
      const isInitialFetch = !currentRuntimeData;
      if (isInitialFetch) setLoading(true);
      else setRefreshingSchema(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/semantic_layer/${uuid}/schema/runtime`,
          jsonPayload: currentRuntimeData
            ? { runtime_data: currentRuntimeData }
            : {},
        });
        const schema = json.result;
        if (
          isInitialFetch &&
          (!schema ||
            !schema.properties ||
            Object.keys(schema.properties).length === 0)
        ) {
          // No runtime config needed — skip to step 3
          fetchViews(uuid, {});
        } else if (isInitialFetch) {
          applyRuntimeSchema(schema);
          setStep('configure');
        } else {
          applyRuntimeSchema(schema);
        }
      } catch {
        if (isInitialFetch) {
          addDangerToast(
            t('An error occurred while fetching the runtime schema'),
          );
        }
      } finally {
        if (isInitialFetch) setLoading(false);
        else setRefreshingSchema(false);
      }
    },
    [addDangerToast, applyRuntimeSchema], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const fetchViews = useCallback(
    async (uuid: string, rData: Record<string, unknown>) => {
      setLoadingViews(true);
      setStep('select');
      try {
        const { json } = await SupersetClient.post({
          endpoint: `/api/v1/semantic_layer/${uuid}/views`,
          jsonPayload: { runtime_data: rData },
        });
        const views: AvailableView[] = json.result ?? [];
        setAvailableViews(views);
        // Pre-select views that are already added (disabled anyway)
        setSelectedViews(
          new Set(views.filter(v => v.already_added).map(v => v.name)),
        );
      } catch {
        addDangerToast(t('An error occurred while fetching available views'));
      } finally {
        setLoadingViews(false);
      }
    },
    [addDangerToast],
  );

  const maybeRefreshRuntimeSchema = useCallback(
    (data: Record<string, unknown>) => {
      if (!selectedLayerUuid) return;

      const dynamicDeps = dynamicDepsRef.current;
      if (Object.keys(dynamicDeps).length === 0) return;

      const hasSatisfiedDeps = Object.values(dynamicDeps).some(deps =>
        areDependenciesSatisfied(deps, data),
      );
      if (!hasSatisfiedDeps) return;

      const snapshot = serializeDependencyValues(dynamicDeps, data);
      if (snapshot === lastDepSnapshotRef.current) return;
      lastDepSnapshotRef.current = snapshot;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchRuntimeSchema(selectedLayerUuid, data);
      }, SCHEMA_REFRESH_DEBOUNCE_MS);
    },
    [selectedLayerUuid, fetchRuntimeSchema],
  );

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
      setHasRuntimeErrors(errorsRef.current.length > 0);
      maybeRefreshRuntimeSchema(data);
    },
    [maybeRefreshRuntimeSchema],
  );

  const handleToggleView = (viewName: string, checked: boolean) => {
    setSelectedViews(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(viewName);
      } else {
        next.delete(viewName);
      }
      return next;
    });
  };

  const newViewCount = availableViews.filter(
    v => selectedViews.has(v.name) && !v.already_added,
  ).length;

  const handleAddViews = async () => {
    if (!selectedLayerUuid) return;
    setSaving(true);
    try {
      const viewsToCreate = availableViews
        .filter(v => selectedViews.has(v.name) && !v.already_added)
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

  const handleSave = () => {
    if (step === 'layer' && selectedLayerUuid) {
      fetchRuntimeSchema(selectedLayerUuid);
    } else if (step === 'configure' && selectedLayerUuid) {
      fetchViews(selectedLayerUuid, runtimeData);
    } else if (step === 'select') {
      handleAddViews();
    }
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('layer');
      setRuntimeSchema(null);
      setRuntimeUiSchema(undefined);
      setRuntimeData({});
      setHasRuntimeErrors(false);
      errorsRef.current = [];
      lastDepSnapshotRef.current = '';
      dynamicDepsRef.current = {};
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    } else if (step === 'select') {
      // Go back to configure if we had a runtime schema, otherwise to layer
      if (runtimeSchema) {
        setStep('configure');
      } else {
        setStep('layer');
      }
      setAvailableViews([]);
      setSelectedViews(new Set());
    }
  };

  const title =
    step === 'layer'
      ? t('Add Semantic View')
      : step === 'configure'
        ? t('Configure')
        : t('Select Views');

  const saveText =
    step === 'select' ? t('Add %s view(s)', newViewCount) : t('Next');

  const saveDisabled =
    step === 'layer'
      ? !selectedLayerUuid
      : step === 'configure'
        ? hasRuntimeErrors
        : step === 'select'
          ? newViewCount === 0 || saving
          : false;

  const modalWidth =
    step === 'configure' ? MODAL_MEDIUM_WIDTH : MODAL_STANDARD_WIDTH;

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={title}
      icon={<Icons.PlusOutlined />}
      width={modalWidth}
      saveDisabled={saveDisabled}
      saveText={saveText}
      saveLoading={saving}
      contentLoading={loading}
    >
      {step === 'layer' && (
        <ModalContent>
          <ModalFormField label={t('Semantic Layer')}>
            <Select
              ariaLabel={t('Semantic layer')}
              placeholder={t('Select a semantic layer')}
              value={selectedLayerUuid}
              onChange={value => setSelectedLayerUuid(value as string)}
              options={layers.map(l => ({
                value: l.uuid,
                label: l.name,
              }))}
              getPopupContainer={() => document.body}
              dropdownAlign={{
                points: ['tl', 'bl'],
                offset: [0, 4],
                overflow: { adjustX: 0, adjustY: 1 },
              }}
            />
          </ModalFormField>
        </ModalContent>
      )}

      {step === 'configure' && (
        <ModalContent>
          <BackLink type="button" onClick={handleBack}>
            <Icons.CaretLeftOutlined iconSize="s" />
            {t('Back')}
          </BackLink>
          {runtimeSchema && (
            <JsonForms
              schema={runtimeSchema}
              uischema={runtimeUiSchema}
              data={runtimeData}
              renderers={renderers}
              cells={cellRegistryEntries}
              config={{ refreshingSchema, formData: runtimeData }}
              validationMode="ValidateAndHide"
              onChange={handleRuntimeFormChange}
            />
          )}
        </ModalContent>
      )}

      {step === 'select' && (
        <ModalContent>
          <BackLink type="button" onClick={handleBack}>
            <Icons.CaretLeftOutlined iconSize="s" />
            {t('Back')}
          </BackLink>
          {loadingViews ? (
            <LoadingContainer>
              <Spin />
            </LoadingContainer>
          ) : (
            <ViewList>
              {availableViews.map(view => (
                <Checkbox
                  key={view.name}
                  checked={selectedViews.has(view.name)}
                  disabled={view.already_added}
                  onChange={e => handleToggleView(view.name, e.target.checked)}
                >
                  {view.name}
                  {view.already_added && <span> ({t('Already added')})</span>}
                </Checkbox>
              ))}
              {availableViews.length === 0 && !loadingViews && (
                <span>{t('No views available')}</span>
              )}
            </ViewList>
          )}
        </ModalContent>
      )}
    </StandardModal>
  );
}
