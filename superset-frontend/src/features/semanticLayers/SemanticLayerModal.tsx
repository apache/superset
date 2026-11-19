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
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import isEqual from 'lodash/isEqual';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import {
  Form,
  Input,
  Select,
  Button,
  Loading,
  Flex,
} from '@superset-ui/core/components';
import { Alert } from '@apache-superset/core/components';
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

import { isRecord } from '../semanticViews/creationResult';
import SemanticLayerSetupHelp from './SemanticLayerSetupHelp';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;

  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  }
  .ant-form-item-label {
    padding-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }
  .ant-form-item-extra {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
  .ant-form-item-required::before {
    order: 1;
    margin-inline: ${({ theme }) => theme.sizeUnit / 2}px 0;
  }
  .ant-divider {
    display: none;
  }
`;

type Step = 'type' | 'config';
type ValidationMode = 'ValidateAndHide' | 'ValidateAndShow';

const configurationErrorMessage = () =>
  t(
    'Could not refresh metadata. Check the connection details and your permissions.',
  );

interface SemanticLayerType {
  id: string;
  name: string;
  description?: string | null;
}

interface SemanticLayerModalProps {
  show: boolean;
  onHide: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  semanticLayerUuid?: string;
}

export default function SemanticLayerModal({
  show,
  onHide,
  onCreated,
  onUpdated,
  addDangerToast,
  addSuccessToast,
  semanticLayerUuid,
}: SemanticLayerModalProps) {
  const isEditMode = !!semanticLayerUuid;
  const [step, setStep] = useState<Step>('type');
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [types, setTypes] = useState<SemanticLayerType[]>([]);
  const [typeStatus, setTypeStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const typeRequestRef = useRef(0);
  const saveRequestRef = useRef(0);
  const onCreatedRef = useRef(onCreated);
  const onUpdatedRef = useRef(onUpdated);
  useLayoutEffect(() => {
    onCreatedRef.current = onCreated;
    onUpdatedRef.current = onUpdated;
  }, [onCreated, onUpdated]);
  const [loading, setLoading] = useState(false);
  const [configSchema, setConfigSchema] = useState<JsonSchema | null>(null);
  const [uiSchema, setUiSchema] = useState<UISchemaElement | undefined>(
    undefined,
  );
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savedForm, setSavedForm] = useState<{
    name: string;
    configuration: Record<string, unknown>;
  } | null>(null);
  const clearRequestRef = useRef(0);
  const savedConfiguration = { ...savedForm?.configuration };
  for (const [field, property] of Object.entries(
    configSchema?.properties ?? {},
  )) {
    if (typeof property !== 'object' || property === null) continue;
    const backfilledValue =
      property.const ?? (property.readOnly ? property.default : undefined);
    if (backfilledValue !== undefined)
      savedConfiguration[field] = backfilledValue;
  }
  const dirty =
    !savedForm ||
    name !== savedForm.name ||
    !isEqual(formData, savedConfiguration);
  const [hasErrors, setHasErrors] = useState(true);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [validationMode, setValidationMode] =
    useState<ValidationMode>('ValidateAndHide');
  const errorsRef = useRef<ErrorObject[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDepSnapshotRef = useRef<string>('');
  const dynamicDepsRef = useRef<Record<string, string[]>>({});
  const schemaRequestRef = useRef(0);
  // Tracks the most recent value we auto-populated into the Name field so we
  // can overwrite it when the user switches type — but leave alone anything
  // the user has hand-edited.
  const autoFilledNameRef = useRef<string>('');

  const fetchTypes = useCallback(async () => {
    typeRequestRef.current += 1;
    const request = typeRequestRef.current;
    setTypeStatus('loading');
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/semantic_layer/types',
      });
      if (request !== typeRequestRef.current) return;
      const result: unknown = json.result;
      if (
        !Array.isArray(result) ||
        !result.every(
          (type): type is SemanticLayerType =>
            isRecord(type) &&
            typeof type.id === 'string' &&
            typeof type.name === 'string',
        )
      )
        throw new Error('Invalid semantic layer types');
      setTypes(result);
      setTypeStatus('success');
    } catch {
      if (request !== typeRequestRef.current) return;
      setTypeStatus('error');
      addDangerToast(
        t('An error occurred while fetching semantic layer types'),
      );
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
      schemaRequestRef.current += 1;
      const request = schemaRequestRef.current;
      const isInitialFetch = !configuration;
      if (isInitialFetch) setLoading(true);
      else setRefreshingSchema(true);
      try {
        const { json } = await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/schema/configuration',
          jsonPayload: { type, configuration },
        });
        if (request !== schemaRequestRef.current) return;
        applySchema(json.result);
        if (json.warning) {
          addDangerToast(configurationErrorMessage());
        }
        if (isInitialFetch) setStep('config');
      } catch {
        if (request !== schemaRequestRef.current) return;
        addDangerToast(
          isInitialFetch
            ? t('An error occurred while fetching the configuration schema')
            : configurationErrorMessage(),
        );
      } finally {
        if (request === schemaRequestRef.current) {
          if (isInitialFetch) setLoading(false);
          else setRefreshingSchema(false);
        }
      }
    },
    [addDangerToast, applySchema],
  );

  const fetchExistingLayer = useCallback(
    async (uuid: string) => {
      schemaRequestRef.current += 1;
      const request = schemaRequestRef.current;
      setLoading(true);
      try {
        const { json } = await SupersetClient.get({
          endpoint: `/api/v1/semantic_layer/${uuid}`,
        });
        if (request !== schemaRequestRef.current) return;
        const layer = json.result;
        setName(layer.name ?? '');
        setSelectedType(layer.type);
        setFormData(layer.configuration ?? {});
        setSavedForm({
          name: layer.name ?? '',
          configuration: layer.configuration ?? {},
        });
        setHasErrors(false);
        // Providers decide whether the saved configuration can enrich the schema.
        const { json: schemaJson } = await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/schema/configuration',
          jsonPayload: { type: layer.type, configuration: layer.configuration },
        });
        if (request !== schemaRequestRef.current) return;
        applySchema(schemaJson.result);
        if (schemaJson.warning) addDangerToast(configurationErrorMessage());
        setStep('config');
      } catch {
        if (request !== schemaRequestRef.current) return;
        addDangerToast(
          t('An error occurred while fetching the semantic layer'),
        );
      } finally {
        if (request === schemaRequestRef.current) setLoading(false);
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
      typeRequestRef.current += 1;
      schemaRequestRef.current += 1;
      setStep('type');
      setName('');
      setSelectedType(null);
      setTypes([]);
      setTypeStatus('loading');
      setLoading(false);
      setSaving(false);
      setConfigSchema(null);
      setUiSchema(undefined);
      setFormData({});
      setSavedForm(null);
      setClearing(false);
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

  useEffect(
    () => () => {
      typeRequestRef.current += 1;
      saveRequestRef.current += 1;
      clearRequestRef.current += 1;
      schemaRequestRef.current += 1;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [show, semanticLayerUuid],
  );

  const handleReloadMetadata = async () => {
    if (!semanticLayerUuid || dirty || saving || clearing || refreshingSchema)
      return;
    clearRequestRef.current += 1;
    const request = clearRequestRef.current;
    setClearing(true);
    try {
      await SupersetClient.post({
        endpoint: `/api/v1/semantic_layer/${semanticLayerUuid}/clear_cache`,
        jsonPayload: {},
      });
      if (request !== clearRequestRef.current) return;
      addSuccessToast(t('Cache cleared; reload to fetch metadata'));
      onHide();
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      if (request === clearRequestRef.current) {
        addDangerToast(
          clientError.error || t('Unable to clear metadata cache'),
        );
      }
    } finally {
      if (request === clearRequestRef.current) setClearing(false);
    }
  };

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
    schemaRequestRef.current += 1;
    setRefreshingSchema(false);
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
    saveRequestRef.current += 1;
    const request = saveRequestRef.current;
    setSaving(true);
    try {
      if (isEditMode && semanticLayerUuid) {
        await SupersetClient.put({
          endpoint: `/api/v1/semantic_layer/${semanticLayerUuid}`,
          jsonPayload: { name, configuration: formData },
        });
        if (request !== saveRequestRef.current) {
          // Cancel refreshed the parent before the update committed.
          onUpdatedRef.current?.();
          return;
        }
        addSuccessToast(t('Semantic layer updated'));
      } else {
        await SupersetClient.post({
          endpoint: '/api/v1/semantic_layer/',
          jsonPayload: { name, type: selectedType, configuration: formData },
        });
        // The server created the layer even if this dialog was closed. Only
        // the parent may refresh the picker; stale dialog UI remains ignored.
        onCreatedRef.current?.();
        if (request !== saveRequestRef.current) return;
        addSuccessToast(t('Semantic layer created'));
      }
      onHide();
    } catch (error) {
      if (request !== saveRequestRef.current) return;
      const clientError = await getClientErrorObject(error);
      if (request !== saveRequestRef.current) return;
      addDangerToast(
        clientError.error ||
          (isEditMode
            ? t('An error occurred while updating the semantic layer')
            : t('An error occurred while creating the semantic layer')),
      );
    } finally {
      if (request === saveRequestRef.current) setSaving(false);
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
        schemaRequestRef.current += 1;
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
      // Invalidate in-flight results before the next debounced request starts.
      schemaRequestRef.current += 1;

      // Indicate pending discovery through the debounce window without
      // preventing manual entry while suggestions are unavailable.
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

  const selectedProvider = types.find(type => type.id === selectedType);
  const selectedTypeName = selectedProvider?.name ?? '';
  const description = selectedProvider?.description;

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
        isTypeStep
          ? !selectedType || typeStatus !== 'success' || loading
          : loading || saving || clearing || !name.trim() || hasErrors
      }
      saveText={isTypeStep ? undefined : isEditMode ? t('Save') : t('Create')}
      saveLoading={saving}
    >
      <ModalContent>
        <SemanticLayerSetupHelp />
        {loading ? (
          <Flex justify="center" align="center" style={{ minHeight: 200 }}>
            <Loading position="normal" />
          </Flex>
        ) : (
          <>
            {/* COPY-TBD: semantic setup guidance, pending product copy. */}
            {isTypeStep && typeStatus === 'loading' && (
              <p>
                <output>{t('Loading semantic layer types…')}</output>
              </p>
            )}
            {isTypeStep && typeStatus === 'error' && (
              <>
                <Alert
                  type="error"
                  role="alert"
                  showIcon
                  message={t(
                    'Unable to load semantic layer types. Try again or ask your administrator for help.',
                  )}
                />
                <Button onClick={fetchTypes}>{t('Try again')}</Button>
              </>
            )}
            {isTypeStep && typeStatus === 'success' && types.length === 0 && (
              <p>
                <output>
                  {t(
                    'No semantic layer types are available. Ask your administrator to check the semantic layer setup for this deployment.',
                  )}
                </output>
              </p>
            )}
            {isTypeStep &&
              typeStatus === 'success' &&
              types.length > 0 &&
              !selectedType && (
                <p>
                  {t(
                    'Choose a semantic layer type to see its setup information.',
                  )}
                </p>
              )}
            {typeof description === 'string' && description.trim() && (
              <p data-test="semantic-provider-description">{t(description)}</p>
            )}
            {isTypeStep ? (
              <ModalFormField label={t('Type')}>
                <Select
                  ariaLabel={t('Semantic layer type')}
                  placeholder={t('Select a semantic layer type')}
                  value={selectedType}
                  disabled={
                    typeStatus !== 'success' || types.length === 0 || loading
                  }
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
                {isEditMode && (
                  <Button
                    disabled={dirty || saving || clearing || refreshingSchema}
                    loading={clearing}
                    onClick={handleReloadMetadata}
                  >
                    {t('Reload metadata')}
                  </Button>
                )}
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
                    disabled={clearing}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('Name of the semantic layer')}
                  />
                </ModalFormField>
                {configSchema && (
                  // Wrap in a form with autocomplete="off" so browsers do not
                  // autofill credential fields (service token, account, etc.).
                  <Form layout="vertical" autoComplete="off">
                    <JsonForms
                      readonly={clearing}
                      schema={configSchema}
                      uischema={uiSchema}
                      data={formData}
                      renderers={renderers}
                      cells={cellRegistryEntries}
                      config={{ refreshingSchema, formData }}
                      validationMode={validationMode}
                      onChange={handleFormChange}
                    />
                  </Form>
                )}
              </>
            )}
          </>
        )}
      </ModalContent>
    </StandardModal>
  );
}
