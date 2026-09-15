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
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { Input, Select, Button } from '@superset-ui/core/components';
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
import { styled } from '@apache-superset/core/theme';
import {
  renderers,
  sanitizeSchema,
  buildUiSchema,
  getDynamicDependencies,
  areDependenciesSatisfied,
  serializeDependencyValues,
  SCHEMA_REFRESH_DEBOUNCE_MS,
} from './jsonFormsHelpers';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

type Step = 'type' | 'config';
type ValidationMode = 'ValidateAndHide' | 'ValidateAndShow';

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
  // Tracks the most recent value we auto-populated into the Name field so we
  // can overwrite it when the user switches type — but leave alone anything
  // the user has hand-edited.
  const autoFilledNameRef = useRef<string>('');

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/semantic_layer/types',
      });
      setTypes(json.result ?? []);
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      addDangerToast(
        clientError.error ||
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
        if (json.warning) {
          addDangerToast(String(json.warning));
        }
        if (isInitialFetch) setStep('config');
      } catch (error) {
        const clientError = await getClientErrorObject(error);
        if (isInitialFetch) {
          addDangerToast(
            clientError.error ||
              t('An error occurred while fetching the configuration schema'),
          );
        } else {
          addDangerToast(
            clientError.error ||
              t('An error occurred while refreshing the configuration schema'),
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
      } catch (error) {
        const clientError = await getClientErrorObject(error);
        addDangerToast(
          clientError.error ||
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
      autoFilledNameRef.current = '';
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    }
  }, [show, fetchTypes, isEditMode, semanticLayerUuid, fetchExistingLayer]);

  const handleStepAdvance = () => {
    if (selectedType) {
      // Pre-fill the Name with the type's display name so a user who just
      // wants the defaults doesn't have to invent one. Skip the overwrite
      // once the user has typed something the auto-fill didn't put there.
      const type = types.find(t => t.id === selectedType);
      if (type && (name === '' || name === autoFilledNameRef.current)) {
        setName(type.name);
        autoFilledNameRef.current = type.name;
      }
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
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      addDangerToast(
        clientError.error ||
          (isEditMode
            ? t('An error occurred while updating the semantic layer')
            : t('An error occurred while creating the semantic layer')),
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit mode skips the type-picker step. Gating on this prevents the brief
  // flash of the Create modal's first step while the existing layer is being
  // fetched.
  const isTypeStep = step === 'type' && !isEditMode;

  const handleSave = () => {
    if (isTypeStep) {
      handleStepAdvance();
    } else {
      // Trigger validation UI and submit only from explicit save action.
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
      if (!hasSatisfiedDeps) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setRefreshingSchema(false);
        lastDepSnapshotRef.current = '';
        return;
      }

      // Only re-fetch if dependency values actually changed
      const snapshot = serializeDependencyValues(dynamicDeps, data);
      if (snapshot === lastDepSnapshotRef.current) return;
      lastDepSnapshotRef.current = snapshot;

      // Flip the loading state immediately so dependent fields are disabled
      // through the debounce window — otherwise the user keeps seeing the
      // stale options for ~500ms before the request even fires.
      setRefreshingSchema(true);

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
      // When a dependency of a dynamic field changes, clear that field's
      // value so we don't carry a stale selection across the refresh (e.g.
      // ``schema=PUBLIC`` lingering after the user switches database).
      const dynamicDeps = dynamicDepsRef.current;
      let nextData = data;
      if (Object.keys(dynamicDeps).length > 0) {
        const cleared: Record<string, unknown> = {};
        for (const [field, deps] of Object.entries(dynamicDeps)) {
          // Self-deps don't count — a field shouldn't wipe its own value
          // every time the user picks something in it.
          const externalDeps = deps.filter(dep => dep !== field);
          if (externalDeps.length === 0) continue;
          const depsChanged = externalDeps.some(
            dep => JSON.stringify(formData[dep]) !== JSON.stringify(data[dep]),
          );
          if (depsChanged && data[field] !== undefined && data[field] !== '') {
            cleared[field] = undefined;
          }
        }
        if (Object.keys(cleared).length > 0) {
          nextData = { ...data, ...cleared };
        }
      }

      setFormData(nextData);
      errorsRef.current = errors ?? [];
      setHasErrors(errorsRef.current.length > 0);
      maybeRefreshSchema(nextData);
    },
    [maybeRefreshSchema, formData],
  );

  const selectedTypeName =
    types.find(type => type.id === selectedType)?.name ?? '';

  const title = isEditMode
    ? t('Edit %s', selectedTypeName || t('Semantic Layer'))
    : isTypeStep
      ? t('New Semantic Layer')
      : t('Configure %s', selectedTypeName);

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={title}
      icon={isEditMode ? <Icons.EditOutlined /> : <Icons.PlusOutlined />}
      width={isTypeStep ? MODAL_STANDARD_WIDTH : MODAL_MEDIUM_WIDTH}
      saveDisabled={
        isTypeStep ? !selectedType : saving || !name.trim() || hasErrors
      }
      saveText={isTypeStep ? undefined : isEditMode ? t('Save') : t('Create')}
      saveLoading={saving}
      contentLoading={loading}
    >
      <ModalContent>
        {isTypeStep ? (
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
            />
          </ModalFormField>
        ) : (
          <>
            {!isEditMode && (
              <Button
                buttonStyle="link"
                icon={<Icons.CaretLeftOutlined iconSize="s" />}
                onClick={handleBack}
              >
                {t('Back')}
              </Button>
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
          </>
        )}
      </ModalContent>
    </StandardModal>
  );
}
