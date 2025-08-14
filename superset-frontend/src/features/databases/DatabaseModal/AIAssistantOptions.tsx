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
import { useEffect, useState } from 'react';
import { t, SupersetClient, SupersetTheme } from '@superset-ui/core';
import {
  InfoTooltip,
  Button,
  Checkbox,
  Collapse,
  Select,
  Switch,
  CollapseLabelInModal,
} from '@superset-ui/core/components';
import {
  useDatabaseTables,
  LlmDefaults,
  SavedContextStatus,
  useLlmContextStatus,
  useLlmDefaults,
} from 'src/hooks/apiResources';
import {
  StyledContextError,
  StyledContextWrapper,
  StyledInputContainer,
  StyledLlmSwitch,
  StyledTokenEstimate,
  StyledTopKForm,
  wideButton,
} from './styles';
import { DatabaseObject } from '../types';
import SchemaSelector from './SchemaSelector';

const AIAssistantOptions = ({
  db,
  onLlmConnectionChange,
  onLlmContextOptionsChange,
}: {
  db: DatabaseObject | null;
  onLlmConnectionChange: Function;
  onLlmContextOptionsChange: Function;
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    db?.llm_connection?.provider || null,
  );
  const [regenerating, setRegenerating] = useState(false);
  const [savedContext, setSavedContext] = useState<SavedContextStatus | null>(
    null,
  );
  const [contextError, setContextError] = useState<string | null>(null);
  const [llmDefaults, setLlmDefaults] = useState<LlmDefaults | null>(null);
  const [selectedModelTokenLimit, setSelectedModelTokenLimit] = useState<
    number | null
  >(null);
  const tables = useDatabaseTables(db?.id || 0);
  const contextSettings = db?.llm_context_options;
  const [activeKey, setActiveKey] = useState<string | string[] | undefined>(
    undefined,
  );

  const contextStatus = useLlmContextStatus({
    dbId: db?.id || 1,
    onSuccess: result => {
      setRegenerating(result.status === 'building');
      if (result.context) {
        setSavedContext(result.context);
      }
      setContextError(result.error ? result.error.build_time : null);
    },
  });

  useLlmDefaults({
    dbId: db?.id || 1,
    onSuccess: result => {
      if (result) {
        setLlmDefaults(result);
      }
    },
  });

  useEffect(() => {
    if (llmDefaults && selectedProvider && llmDefaults[selectedProvider]) {
      const model =
        db?.llm_connection?.model ||
        Object.keys(llmDefaults[selectedProvider].models)[0];
      setSelectedModelTokenLimit(
        llmDefaults[selectedProvider].models[model]?.input_token_limit || null,
      );
    } else {
      setSelectedModelTokenLimit(null);
    }
  }, [llmDefaults, selectedProvider, db?.llm_connection?.model]);

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    onLlmConnectionChange({
      ...db?.llm_connection,
      provider: value,
      model: llmDefaults?.[value]?.models
        ? Object.keys(llmDefaults[value].models)[0]
        : '',
    });
  };

  const handleLlmConnectionChange = (name: string, value: any) => {
    onLlmConnectionChange({ ...db?.llm_connection, [name]: value });
  };

  const handleContextOptionsChange = (name: string, value: any) => {
    onLlmContextOptionsChange({ ...db?.llm_context_options, [name]: value });
  };

  const onSchemasChange = (value: string[]) => {
    handleContextOptionsChange('schemas', JSON.stringify(value));
  };

  return (
    <>
      <StyledLlmSwitch>
        <div className="control-label">
          {t('Enable large language model support in SQL Lab')}
        </div>
        <div className="input-container">
          <Switch
            id="enabled"
            checked={db?.llm_connection?.enabled || false}
            onChange={(checked: boolean) =>
              handleLlmConnectionChange('enabled', checked)
            }
          />
        </div>
      </StyledLlmSwitch>
      <Collapse
        expandIconPosition="right"
        accordion
        modalMode
        activeKey={activeKey}
        onChange={key => setActiveKey(key)}
        items={[
          {
            key: 'language_models',
            label: (
              <CollapseLabelInModal
                title={t('Language Models')}
                subtitle={t(
                  'Choose an LLM API and model to use for AI Assistant.',
                )}
                testId="language-models-label-test"
              />
            ),
            children: (
              <div>
                <StyledInputContainer className="mb-8">
                  <div className="control-label">
                    {t('Language model provider')}
                  </div>
                  <div className="input-container">
                    <Select
                      options={
                        llmDefaults
                          ? Object.keys(llmDefaults).map(provider => ({
                              value: provider,
                              label: provider,
                            }))
                          : []
                      }
                      value={db?.llm_connection?.provider}
                      onChange={handleProviderChange}
                    />
                  </div>
                </StyledInputContainer>

                {selectedProvider && (
                  <>
                    <StyledInputContainer className="mb-8">
                      <div className="control-label">
                        {t('Provider API key')}
                      </div>
                      <div className="input-container">
                        <input
                          type="text"
                          name="api_key"
                          value={db?.llm_connection?.api_key || ''}
                          placeholder={t('Enter your API key')}
                          onChange={e =>
                            handleLlmConnectionChange('api_key', e.target.value)
                          }
                        />
                      </div>
                    </StyledInputContainer>

                    <StyledInputContainer className="mb-8">
                      <div className="control-label">{t('Model')}</div>
                      <div className="input-container">
                        <Select
                          options={
                            llmDefaults && selectedProvider in llmDefaults
                              ? Object.entries(
                                  llmDefaults[selectedProvider].models,
                                ).map(([model, data]) => ({
                                  value: model,
                                  label: data.name,
                                }))
                              : []
                          }
                          value={db?.llm_connection?.model}
                          onChange={value =>
                            handleLlmConnectionChange('model', value)
                          }
                        />
                      </div>
                    </StyledInputContainer>
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'context_settings',
            label: (
              <CollapseLabelInModal
                title={t('Context Settings')}
                subtitle={t(
                  'Set instructions and choose schemas for the AI Assistant context.',
                )}
                testId="context-settings-label-test"
              />
            ),
            children: (
              <>
                {((savedContext && savedContext.size) || contextError) && (
                  <StyledContextWrapper>
                    {savedContext && savedContext.size && (
                      <StyledTokenEstimate>
                        <div>
                          <span>Estimated context size: </span>
                          <span>{savedContext.size} tokens</span>
                        </div>
                        {selectedModelTokenLimit &&
                          savedContext.size > selectedModelTokenLimit && (
                            <div className="warning">
                              This exceeds the model's input token limit of{' '}
                              {selectedModelTokenLimit} tokens.
                            </div>
                          )}
                        <div>
                          Context build time:{' '}
                          {new Date(
                            `${savedContext.build_time}Z`,
                          ).toLocaleString()}
                        </div>
                      </StyledTokenEstimate>
                    )}
                    {contextError && (
                      <StyledContextError>
                        The last context build for this database failed at{' '}
                        {new Date(`${contextError}Z`).toLocaleString()}.
                      </StyledContextError>
                    )}
                  </StyledContextWrapper>
                )}
                <StyledInputContainer>
                  <div className="control-label">
                    {t('Context refresh interval (hours)')}
                  </div>
                  <div className="input-container">
                    <input
                      type="number"
                      name="refresh_interval"
                      value={
                        contextSettings?.refresh_interval !== undefined
                          ? contextSettings.refresh_interval
                          : ''
                      }
                      placeholder={t('12')}
                      onChange={e =>
                        handleContextOptionsChange(
                          'refresh_interval',
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="helper">
                    {t(
                      'Frequently updating the database context will consume more system resources' +
                        ' but will make changes to the database schema available to the AI Assistant sooner.',
                    )}
                  </div>
                </StyledInputContainer>
                <StyledInputContainer className="mb-8">
                  <div className="control-label">
                    {t('Select tables to include in the context')}
                  </div>
                  <div className="input-container">
                    <SchemaSelector
                      value={JSON.parse(contextSettings?.schemas || '[]')}
                      options={tables.result || {}}
                      loading={tables.status === 'loading'}
                      error={tables.error}
                      onSchemasChange={onSchemasChange}
                      maxContentHeight={500}
                    />
                  </div>
                  <div className="helper">
                    {t(
                      "Tables that aren't included will not be available for the AI Assistant to query.",
                    )}
                  </div>
                </StyledInputContainer>
                <StyledInputContainer>
                  <div className="input-container">
                    <Checkbox
                      id="include_indexes"
                      indeterminate={false}
                      checked={!!contextSettings?.include_indexes}
                      onChange={e =>
                        handleContextOptionsChange(
                          'include_indexes',
                          (e.target as HTMLInputElement).checked,
                        )
                      }
                    >
                      {t('Include indexes in the database context')}
                    </Checkbox>
                    <InfoTooltip
                      tooltip={t(
                        'Indexes increase the size of the database context but may improve' +
                          " the AI Assistant's ability to generate queries.",
                      )}
                    />
                  </div>
                </StyledInputContainer>
                <StyledInputContainer>
                  <div className="control-label">
                    {t(
                      'Include up to k most common results from the first n rows',
                    )}
                  </div>
                  <StyledTopKForm>
                    <div className="input-container">
                      <div className="control-label">{t('Results (k)')}</div>
                      <input
                        type="text"
                        name="top_k"
                        value={contextSettings?.top_k || ''}
                        placeholder={t('10')}
                        onChange={e =>
                          handleContextOptionsChange('top_k', e.target.value)
                        }
                      />
                    </div>
                    <div className="input-container">
                      <div className="control-label">{t('Row limit (n)')}</div>
                      <input
                        type="text"
                        name="top_k_limit"
                        value={contextSettings?.top_k_limit || ''}
                        placeholder={t('50000')}
                        onChange={e =>
                          handleContextOptionsChange(
                            'top_k_limit',
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="helper">
                      {t(
                        'The "top k" most common values on text columns are included to ' +
                          "increase the model's ability to perform text matching. Row " +
                          'limit is the number of rows we scan to calculate the most common values',
                      )}
                    </div>
                  </StyledTopKForm>
                </StyledInputContainer>
                <StyledInputContainer>
                  <div
                    className="input-container"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <div
                      className="control-label"
                      style={{ marginBottom: '0' }}
                    >
                      {t('LLM Instructions')}
                    </div>
                    <Button
                      buttonStyle="link"
                      onClick={() => {
                        const defaultInstructions =
                          llmDefaults?.[selectedProvider || '']?.instructions ||
                          '';
                        handleContextOptionsChange(
                          'instructions',
                          defaultInstructions,
                        );
                      }}
                    >
                      {t('Reset')}
                    </Button>
                  </div>
                  <div className="input-container">
                    <textarea
                      name="instructions"
                      value={
                        contextSettings?.instructions ||
                        llmDefaults?.[selectedProvider || '']?.instructions ||
                        ''
                      }
                      onChange={e =>
                        handleContextOptionsChange(
                          'instructions',
                          e.target.value,
                        )
                      }
                      style={{ flex: 1 }}
                    />
                  </div>
                </StyledInputContainer>
                <Button
                  onClick={() => {
                    setRegenerating(true);
                    return SupersetClient.post({
                      endpoint: '/api/v1/sqllab/generate_db_context',
                      body: JSON.stringify({ database_id: db?.id || 0 }),
                      headers: { 'Content-Type': 'application/json' },
                    }).finally(() => {
                      setTimeout(() => {
                        setRegenerating(savedContext?.status === 'building');
                      }, 10000);
                      contextStatus.refetch();
                    });
                  }}
                  loading={regenerating}
                  cta
                  buttonStyle="link"
                  css={(theme: SupersetTheme) => wideButton(theme)}
                >
                  {regenerating
                    ? t('Regenerating...')
                    : t('Regenerate context')}
                </Button>
              </>
            ),
          },
        ]}
      />
    </>
  );
};

export default AIAssistantOptions;
