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
import { Input } from 'antd';
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
} from './jsonFormsHelpers';

type Step = 'type' | 'config';
type ValidationMode = 'ValidateAndHide' | 'ValidateAndShow';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const BackLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colorPrimary};
  cursor: pointer;
  padding: 0;
  font-size: ${({ theme }) => theme.fontSize}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;

  &:hover {
    text-decoration: underline;
  }
`;

interface SemanticLayerType {
  id: string;
  name: string;
  description: string;
}

interface SemanticLayerModalProps {
  show: boolean;
  onHide: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  semanticLayerUuid?: string;
}

export default function SemanticLayerModal({
  show,
  onHide,
  addDangerToast,
  addSuccessToast,
  semanticLayerUuid,
}: SemanticLayerModalProps) {
  const isEditMode = !!semanticLayerUuid;
  const [step, setStep] = useState<Step>('type');
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [types, setTypes] = useState<SemanticLayerType[]>([]);
  const [loading, setLoading] = useState(false);
  const [configSchema, setConfigSchema] = useState<JsonSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UISchemaElement | undefined>(
    undefined,
  );
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [hasErrors, setHasErrors] = useState(true);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [validationMode, setValidationMode] =
    useState<ValidationMode>('ValidateAndHide');
  const errorsRef = useRef<ErrorObject[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDepSnapshotRef = useRef<string>('');
  const dynamicDepsRef = useRef<Record<string, string[]>>({});

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/semantic_layer/types',
      });
      setTypes(json.result ?? []);
    } catch {
      addDangerToast(
        t('An error occurred while fetching semantic layer types'),
      );
    } finally {
      setLoading(false);
    }
  }, [addDangerToast]);

  const applySchema = useCallback((rawSchema: JsonSchema) => {
    const schema = sanitizeSchema(rawSchema);
    setConfigSchema(schema);
    setUiSchema(buildUiSchema(schema));
    dynamicDepsRef.current = getDynamicDependencies(rawSchema);
  }, []);

  const fetchConfigSchema = useCallback(
    async (type: string, configuration?: Record<string, unknown>) => {
      const isInitialFetch = !configuration;
      if (isInitialFetch) setLoading(true);
      else setRefreshingSchema(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/schema/configuration',
          jsonPayload: { type, configuration },
        });
        applySchema(json.result);
        if (isInitialFetch) setStep('config');
      } catch {
        if (isInitialFetch) {
          addDangerToast(
            t('An error occurred while fetching the configuration schema'),
          );
        }
      } finally {
        if (isInitialFetch) setLoading(false);
        else setRefreshingSchema(false);
      }
    },
    [addDangerToast, applySchema],
  );

  const fetchExistingLayer = useCallback(
    async (uuid: string) => {
      setLoading(true);
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/semantic_layer/${uuid}`,
        });
        const layer = json.result;
        setName(layer.name ?? '');
        setSelectedType(layer.type);
        setFormData(layer.configuration ?? {});
        setHasErrors(false);
        // In edit mode, fetch the enriched schema using the full saved
        // configuration so that dynamic dropdowns (account, project,
        // environment) show their human-readable labels immediately rather
        // than flashing raw IDs while the background refresh completes.
        const { json: schemaJson } = await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/schema/configuration',
          jsonPayload: { type: layer.type, configuration: layer.configuration },
        });
        applySchema(schemaJson.result);
        setStep('config');
      } catch {
        addDangerToast(
          t('An error occurred while fetching the semantic layer'),
        );
      } finally {
        setLoading(false);
      }
    },
    [addDangerToast, applySchema],
  );

  useEffect(() => {
    if (show) {
      if (isEditMode && semanticLayerUuid) {
        fetchTypes();
        fetchExistingLayer(semanticLayerUuid);
      } else {
        fetchTypes();
      }
    } else {
      setStep('type');
      setName('');
      setSelectedType(null);
      setTypes([]);
      setConfigSchema(null);
      setUiSchema(undefined);
      setFormData({});
      setHasErrors(true);
      setRefreshingSchema(false);
      setValidationMode('ValidateAndHide');
      errorsRef.current = [];
      lastDepSnapshotRef.current = '';
      dynamicDepsRef.current = {};
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [show, fetchTypes, isEditMode, semanticLayerUuid, fetchExistingLayer]);

  const handleStepAdvance = () => {
    if (selectedType) {
      fetchConfigSchema(selectedType);
    }
  };

  const handleBack = () => {
    setStep('type');
    setConfigSchema(null);
    setUiSchema(undefined);
    setFormData({});
    setValidationMode('ValidateAndHide');
    errorsRef.current = [];
    lastDepSnapshotRef.current = '';
    dynamicDepsRef.current = {};
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (isEditMode && semanticLayerUuid) {
        await SupersetClient.put({
          endpoint: `/api/v1/semantic_layer/${semanticLayerUuid}`,
          jsonPayload: { name, configuration: formData },
        });
        addSuccessToast(t('Semantic layer updated'));
      } else {
        await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/',
          jsonPayload: { name, type: selectedType, configuration: formData },
        });
        addSuccessToast(t('Semantic layer created'));
      }
      onHide();
    } catch {
      addDangerToast(
        isEditMode
          ? t('An error occurred while updating the semantic layer')
          : t('An error occurred while creating the semantic layer'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (step === 'type') {
      handleStepAdvance();
    } else {
      setValidationMode('ValidateAndShow');
      if (errorsRef.current.length === 0) {
        handleCreate();
      }
    }
  };

  const maybeRefreshSchema = useCallback(
    (data: Record<string, unknown>) => {
      if (!selectedType) return;

      const dynamicDeps = dynamicDepsRef.current;
      if (Object.keys(dynamicDeps).length === 0) return;

      // Check if any dynamic field has all dependencies satisfied
      const hasSatisfiedDeps = Object.values(dynamicDeps).some(deps =>
        areDependenciesSatisfied(deps, data, configSchema ?? undefined),
      );
      if (!hasSatisfiedDeps) return;

      // Only re-fetch if dependency values actually changed
      const snapshot = serializeDependencyValues(dynamicDeps, data);
      if (snapshot === lastDepSnapshotRef.current) return;
      lastDepSnapshotRef.current = snapshot;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchConfigSchema(selectedType, data);
      }, SCHEMA_REFRESH_DEBOUNCE_MS);
    },
    [selectedType, fetchConfigSchema, configSchema],
  );

  const handleFormChange = useCallback(
    ({
      data,
      errors,
    }: {
      data: Record<string, unknown>;
      errors?: ErrorObject[];
    }) => {
      setFormData(data);
      errorsRef.current = errors ?? [];
      setHasErrors(errorsRef.current.length > 0);
      if (
        validationMode === 'ValidateAndShow' &&
        errorsRef.current.length === 0
      ) {
        handleCreate();
      }
      maybeRefreshSchema(data);
    },
    [validationMode, handleCreate, maybeRefreshSchema],
  );

  const selectedTypeName =
    types.find(type => type.id === selectedType)?.name ?? '';

  const title = isEditMode
    ? t('Edit %s', selectedTypeName || t('Semantic Layer'))
    : step === 'type'
      ? t('New Semantic Layer')
      : t('Configure %s', selectedTypeName);

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={title}
      icon={isEditMode ? <Icons.EditOutlined /> : <Icons.PlusOutlined />}
      width={step === 'type' ? MODAL_STANDARD_WIDTH : MODAL_MEDIUM_WIDTH}
      saveDisabled={
        step === 'type' ? !selectedType : saving || !name.trim() || hasErrors
      }
      saveText={
        step === 'type' ? undefined : isEditMode ? t('Save') : t('Create')
      }
      saveLoading={saving}
      contentLoading={loading}
    >
      {step === 'type' ? (
        <ModalContent>
          <ModalFormField label={t('Type')}>
            <Select
              ariaLabel={t('Semantic layer type')}
              placeholder={t('Select a semantic layer type')}
              value={selectedType}
              onChange={value => setSelectedType(value as string)}
              options={types.map(type => ({
                value: type.id,
                label: type.name,
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
      ) : (
        <ModalContent>
          {!isEditMode && (
            <BackLink type="button" onClick={handleBack}>
              <Icons.CaretLeftOutlined iconSize="s" />
              {t('Back')}
            </BackLink>
          )}
          <ModalFormField label={t('Name')} required>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('Name of the semantic layer')}
            />
          </ModalFormField>
          {configSchema && (
            // Wrap in a form with autocomplete="off" so browsers do not
            // autofill credential fields (service token, account, etc.).
            // eslint-disable-next-line jsx-a11y/no-redundant-roles
            <form
              role="presentation"
              autoComplete="off"
              onSubmit={e => e.preventDefault()}
            >
              <JsonForms
                schema={configSchema}
                uischema={uiSchema}
                data={formData}
                renderers={renderers}
                cells={cellRegistryEntries}
                config={{ refreshingSchema, formData }}
                validationMode={validationMode}
                onChange={handleFormChange}
              />
            </form>
          )}
        </ModalContent>
      )}
    </StandardModal>
  );
}
