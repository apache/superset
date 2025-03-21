import { ChangeEvent, EventHandler, useState } from 'react';
import {
  css,
  t,
  styled,
  SupersetClient,
  SupersetTheme,
} from '@superset-ui/core';
import InfoTooltip from 'src/components/InfoTooltip';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import Collapse from 'src/components/Collapse';
import { Switch } from 'src/components/Switch';
import { useDatabaseTables } from 'src/hooks/apiResources';
import { Select } from 'src/components';
import {
  StyledInputContainer,
  StyledTokenEstimate,
  StyledTopKForm,
  antdCollapseStyles,
} from './styles';
import {
  DatabaseObject,
  LlmProvider,
  LlmContextJson
} from '../types';
import SchemaSelector from './SchemaSelector';
import { wideButton } from './styles';
import Button from 'src/components/Button';
import { useAssistantBuildContextQuery } from 'src/hooks/apiResources';

const AI_ASSISTANT_DEFAULT_INSTRUCTIONS = `You are a postgresql database expert. Given an input question, create a syntactically correct postgresql query. You MUST only answer with the SQL query, nothing else. Unless the user specifies a specific number of results they wish to obtain, always limit your query to at most return 1000 results. You can order the results by relevant columns. You MUST check that the query doesn't contain syntax errors or incorrect table, views, column names or joins on wrong columns. Fix any error you might find before returning your answer. DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database. To construct your database query you MUST ALWAYS use the database metadata information provided to you as a JSON file. Do NOT skip this step. This JSON file specifies all the database schemas, for each schema all its relations (which are tables, and views) and for each table its columns, indexes, and foreign key constraints. The unique indexes are very useful to understand what differentiates one record to another in the same relation. The foreign key constraints are very useful to find the correct columns to join.`;

const StyledLlmSwitch = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    margin-top: ${theme.gridUnit * 6}px;
    margin-left: ${theme.gridUnit * 4}px;
    margin-bottom: ${theme.gridUnit * 6}px;

    .control-label {
      font-family: ${theme.typography.families.sansSerif};
      font-size: ${theme.typography.sizes.m}px;
      margin-right: ${theme.gridUnit * 4}px;
    }

    .input-container {
      display: flex;
      align-items: center;

      label {
        margin-left: ${theme.gridUnit * 2}px;
        margin-top: ${theme.gridUnit * 2}px;
      }
    }
  `}
`;

const GEMINI_MODELS = {
  'models/gemini-1.5-flash-002': 'Gemini 1.5 Flash',
  // 'models/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  'models/gemini-2.0-flash-lite-001': 'Gemini 2.0 Flash-Lite',
  'models/gemini-1.5-pro-002': 'Gemini 1.5 Pro',
}

const AIAssistantOptions = ({
    db,
    onInputChange,
    onSelectChange,
    onSwitchChange,
    onTextChange,
}: {
    db: DatabaseObject | null,
    onInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
    onSelectChange: Function;
    onSwitchChange: Function;
    onTextChange: EventHandler<ChangeEvent<HTMLTextAreaElement>>;
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(db?.llm_provider || null);
  const [regenerating, setRegenerating] = useState(false);
  const tables = useDatabaseTables(db?.id || 0);
  const contextJson: LlmContextJson = JSON.parse(db?.llm_context_options || '{}');

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    onSelectChange({ target: { name: 'llm_provider', value } });
  };

  const handleModelChange = (value: string) => {
    onSelectChange({ target: { name: 'llm_model', value } });
  };

  const handleLlmEnabledChange = (checked: boolean) => {
    onSwitchChange({ target: { name: 'llm_enabled', checked } });
  };

  const onContextInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newJson = { ...contextJson, [event.target.name]: event.target.value };
    onSelectChange({ target: { name: 'llm_context_options', value: JSON.stringify(newJson) } });
  };

  const onInstructionsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newJson = { ...contextJson, instructions: event.target.value };
    onSelectChange({ target: { name: 'llm_context_options', value: JSON.stringify(newJson) } });
  };

  const onSchemasChange = (value: string[]) => {
    const newJson = { ...contextJson, schemas: value };
    onSelectChange({ target: { name: 'llm_context_options', value: JSON.stringify(newJson) } });
  };

  return (
    <>
      <StyledLlmSwitch>
        <div className="control-label">{t('Enable large language model support in SQL Lab')}</div>
        <div className="input-container">
          <Switch
            id="llm_enabled"
            checked={db?.llm_enabled || false}
            onChange={handleLlmEnabledChange}
          />
          <label htmlFor="llm_enabled">
            {db?.llm_enabled ? t('on') : t('off')}
          </label>
        </div>
      </StyledLlmSwitch>
      <Collapse
        expandIconPosition="right"
        accordion
        css={(theme: SupersetTheme) => antdCollapseStyles(theme)}
      >
        <Collapse.Panel header={
            <div>
              <h4>{t('Language Models')}</h4>
              <p className="helper">
                {t('Choose an LLM API and model to use for AI Assistant.')}{' '}
              </p>
            </div>
          }
          key="1"
        >
          <StyledInputContainer className="mb-8">
            <div className="control-label">{t('Language model provider')}</div>
            <div className="input-container">
              <Select
                options={
                  [
                    { value: LlmProvider.Gemini, label: LlmProvider.Gemini },
                  ]
                }
                value={db?.llm_provider || ''}
                onChange={handleProviderChange}
              />
            </div>
          </StyledInputContainer>
          {selectedProvider && (
            <>
              <StyledInputContainer className="mb-8">
                  <div className="control-label">{t('Provider API key')}</div>
                  <div className="input-container">
                  <input
                      type="text"
                      name="llm_api_key"
                      value={db?.llm_api_key || ''}
                      placeholder={t('Enter your API key')}
                      onChange={onInputChange}
                  />
                  </div>
              </StyledInputContainer>
              <StyledInputContainer className="mb-8">
                  <div className="control-label">{t('Model')}</div>
                  <div className="input-container">
                      <Select
                          options={
                              selectedProvider === LlmProvider.Gemini ?
                              Object.entries(GEMINI_MODELS).map(([model, label]) => ({
                                  value: model,
                                  label: label
                              })) :
                              []
                          }
                          value={db?.llm_model || ''}
                          onChange={handleModelChange}
                      />
                  </div>
              </StyledInputContainer>
            </>
          )}
        </Collapse.Panel>
        <Collapse.Panel header={
            <div>
              <h4>{t('Context Settings')}</h4>
              <p className="helper">
                {t('Set instructions and choose schemas.')}{' '}
              </p>
            </div>
          }
          key="2"
        >
          {/* <StyledTokenEstimate>
            <span>Estimated context size: </span> 
            <span>34,290 tokens</span>
          </StyledTokenEstimate> */}
          <StyledInputContainer>
            <div className="control-label">{t('Context refresh interval (hours)')}</div>
            <div className="input-container">
              <input
                type="number"
                name="refresh_interval"
                value={contextJson.refresh_interval || ''}
                placeholder={t('12')}
                onChange={onContextInputChange}
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
              <div className="control-label">{t('Select tables to include in the context')}</div>
              <div className="input-container">
                <SchemaSelector
                  value={contextJson.schemas || []}
                  options={tables.result || {}}
                  loading={tables.status === 'loading'}
                  error={tables.error}
                  onSchemasChange={onSchemasChange}
                />
              </div>
              <div className="helper">
                  {t(
                      'Tables that aren\'t included will not be available for the AI Assistant to query.'
                  )}
              </div>
          {/* </div> */}
          </StyledInputContainer>
          <StyledInputContainer>
              <div className="input-container">
              <IndeterminateCheckbox
                id="include_indexes"
                indeterminate={false}
                checked={!!contextJson?.include_indexes}
                onChange={onContextInputChange}
                labelText={t('Include indexes in the database context')}
              />
              <InfoTooltip
                tooltip={t(
                  'Indexes increase the size of the database context but may improve' +
                  ' the AI Assistant\'s ability to generate queries.',
                )}
              />
              </div>
          </StyledInputContainer>
          <StyledInputContainer>
              <div className="control-label">{t('Include up to k most common results from the first n rows')}</div>
              <StyledTopKForm>
                <div className="input-container">
                  <div className="control-label">{t('Results (k)')}</div>
                  <input
                      type="text"
                      name="top_k"
                      value={contextJson.top_k || ''}
                      placeholder={t('10')}
                      onChange={onContextInputChange}
                  />
                </div>
                <div className="input-container">
                  <div className="control-label">{t('Row limit (n)')}</div>
                  <input
                      type="text"
                      name="top_k_row_limit"
                      value={contextJson.top_k_row_limit || ''}
                      placeholder={t('50000')}
                      onChange={onContextInputChange}
                  />
                </div>
                <div className="helper">
                  {t(
                    'The "top k" most common values on text columns are included to ' +
                    'increase the model\'s ability to perform text matching. Row ' +
                    'limit is the number of rows we scan to calculate the most common values',
                  )}
                </div>
              </StyledTopKForm>
          </StyledInputContainer>
          <StyledInputContainer>
              <div className="control-label">{t('LLM Instructions')}</div>
              <div className="input-container">
              <textarea
                  name="instructions"
                  value={contextJson.instructions || ''}
                  placeholder={t(AI_ASSISTANT_DEFAULT_INSTRUCTIONS)}
                  onChange={onInstructionsChange}
              />
              </div>
          </StyledInputContainer>
            <Button
              onClick={() => {
                setRegenerating(true);
                // const query = useAssistantBuildContextQuery({ dbId: db?.id || 0 }, {
                //   selectFromResult: ({ isLoading, isError, error, data }) => {
                //     setTimeout(() => setRegenerating(false), 10000);
                //     return {
                //       data: !isLoading && data ? data : [],
                //     };
                //   },
                // });
                return SupersetClient.post({
                  endpoint: '/api/v1/sqllab/generate_db_context',
                  body: JSON.stringify({ database_id: db?.id || 0 }),
                  headers: { 'Content-Type': 'application/json' },
                }).finally(() => {
                  setTimeout(() => setRegenerating(false), 10000);
                });
              }}
              loading={regenerating}
              cta
              buttonStyle="link"
              css={(theme: SupersetTheme) => wideButton(theme)}
              >
              {t('Regenerate context')}
            </Button>
        </Collapse.Panel>
      </Collapse>
    </>
  );
};

export default AIAssistantOptions;
