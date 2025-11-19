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
import { SupersetClient, t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import {
  Row,
  Col,
  Card,
  Input,
  Select,
  Button,
} from '@superset-ui/core/components';

const { TextArea } = Input;

const PageContainer = styled.div`
  padding: 48px;
  max-width: 1400px;
  margin: 0 auto;
`;

const PageTitle = styled.h1`
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 48px;
  display: flex;
  align-items: center;
  gap: 16px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const ChatContainer = styled.div`
  ${({ theme }) => `
    min-height: 400px;
    max-height: 400px;
    overflow-y: auto;
    padding: 32px;
    border: 1px solid ${theme.colorBorder};
    border-radius: 8px;
    background-color: ${theme.colorBgLayout};
    margin-bottom: 32px;
  `}
`;

const ChatMessage = styled.div<{ isUser?: boolean }>`
  ${({ theme, isUser }) => `
    padding: 24px;
    margin-bottom: 16px;
    border-radius: 8px;
    background-color: ${isUser ? theme.colorInfoBg : theme.colorBgContainer};
    max-width: 80%;
    ${isUser ? 'margin-left: auto;' : 'margin-right: auto;'}
    white-space: pre-wrap;
    word-wrap: break-word;

    pre {
      background-color: ${theme.colorBgLayout};
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }

    code {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
    }
  `}
`;

const LoadingMessage = styled.div`
  ${({ theme }) => `
    padding: 24px;
    margin-bottom: 16px;
    border-radius: 8px;
    background-color: ${theme.colorBgContainer};
    max-width: 80%;
    margin-right: auto;
    color: ${theme.colorTextSecondary};
    font-style: italic;
  `}
`;

const DatasetSelectorContainer = styled.div`
  margin-bottom: 32px;
`;

const StyledTextArea = styled(TextArea)`
  margin-bottom: 16px;
`;

const DataPreviewContainer = styled.div`
  ${({ theme }) => `
    max-height: 500px;
    overflow: auto;
    border: 1px solid ${theme.colorBorder};
    border-radius: 8px;
    margin-top: 16px;
  `}
`;

const ColumnTable = styled.table`
  ${({ theme }) => `
    width: 100%;
    border-collapse: collapse;

    th,
    td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid ${theme.colorBorder};
      white-space: nowrap;
    }

    th {
      font-weight: 600;
      background-color: ${theme.colorFillQuaternary};
      position: sticky;
      top: 0;
      z-index: 1;
    }

    tr:hover {
      background-color: ${theme.colorBgLayout};
    }
  `}
`;

const SQLCodeBlock = styled.pre`
  ${({ theme }) => `
    background-color: ${theme.colorBgLayout};
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid ${theme.colorBorder};

    code {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      color: ${theme.colorText};
    }
  `}
`;

interface Dataset {
  id: number;
  table_name: string;
  database_name: string;
  schema?: string;
}

interface ChatMessageType {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sql?: string; // Optional SQL code to display
  queryResults?: {
    columns: string[];
    data: Array<Record<string, any>>;
    rowCount: number;
  };
  isExecuting?: boolean;
}

interface DatasetData {
  columns: Array<{ name: string; type: string; description?: string }>;
  data: Array<Record<string, any>>;
}

export default function AIAssistant() {
  const theme = useTheme();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [datasetData, setDatasetData] = useState<DatasetData | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Fetch datasets on mount
  useEffect(() => {
    fetchDatasets();
  }, []);

  // Fetch dataset data when selection changes
  useEffect(() => {
    if (selectedDataset) {
      fetchDatasetData(selectedDataset);
    } else {
      setDatasetData(null);
    }
  }, [selectedDataset]);

  const fetchDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/dataset/',
        searchParams: {
          q: JSON.stringify({
            page_size: 100,
            order_column: 'table_name',
            order_direction: 'asc',
          }),
        },
      });

      const datasetsData = response.json.result.map((ds: any) => ({
        id: ds.id,
        table_name: ds.table_name,
        database_name: ds.database?.database_name || 'Unknown',
        schema: ds.schema,
      }));

      setDatasets(datasetsData);
    } catch (error) {
      console.error('Error fetching datasets:', error);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const fetchDatasetData = async (datasetId: number) => {
    setLoadingData(true);
    try {
      // First, fetch dataset metadata to get column information
      const datasetResponse = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasetId}`,
      });

      const dataset = datasetResponse.json.result;

      // Get column information including descriptions
      const columns =
        dataset.columns?.map((col: any) => ({
          name: col.column_name,
          type: col.type,
          description: col.description,
        })) || [];

      // Log column info for debugging
      console.log('Dataset columns with descriptions:', columns);

      // Now fetch sample data using the chart data API
      const queryPayload = {
        datasource: {
          id: datasetId,
          type: 'table',
        },
        queries: [
          {
            columns: columns.map((col: { name: string }) => col.name),
            row_limit: 50,
            orderby: [],
          },
        ],
        result_format: 'json',
        result_type: 'full',
      };

      const dataResponse = await SupersetClient.post({
        endpoint: '/api/v1/chart/data',
        jsonPayload: queryPayload,
      });

      // Extract the data from the response
      const result = dataResponse.json.result?.[0];
      const data = result?.data || [];

      setDatasetData({
        columns,
        data,
      });
    } catch (error) {
      console.error('Error fetching dataset data:', error);
      // Still show columns even if data fetch fails
      const datasetResponse = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${datasetId}`,
      });
      const dataset = datasetResponse.json.result;
      const columns =
        dataset.columns?.map((col: any) => ({
          name: col.column_name,
          type: col.type,
          description: col.description,
        })) || [];
      setDatasetData({
        columns,
        data: [],
      });
    } finally {
      setLoadingData(false);
    }
  };

  // Build schema information for AI context
  const buildSchemaInfo = (): string => {
    if (!selectedDataset || !datasetData) return '';

    const datasetName =
      datasets.find(d => d.id === selectedDataset)?.table_name || 'Unknown';
    let schemaInfo = `The dataset "${datasetName}" has the following columns:\n\n`;

    datasetData.columns.forEach(col => {
      schemaInfo += `- ${col.name} (${col.type})`;
      if (col.description) {
        schemaInfo += `: ${col.description}`;
      }
      schemaInfo += '\n';
    });

    schemaInfo +=
      '\nGenerate a valid SQL SELECT query using ONLY these column names.\n';
    schemaInfo +=
      'DO NOT explain your reasoning, and DO NOT return anything other than the SQL query itself.';

    return schemaInfo;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    if (!selectedDataset) {
      // Show error if no dataset selected
      const errorMessage: ChatMessageType = {
        id: Date.now().toString(),
        text: 'Please select a dataset first before asking questions.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const newMessage: ChatMessageType = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setLoadingAI(true);

    try {
      // Call the AI SQL generation API
      const response = await SupersetClient.post({
        endpoint: '/api/v1/aiassistant/generate_sql',
        jsonPayload: {
          dataset_id: selectedDataset,
          user_query: inputValue,
        },
      });

      const { sql, error } = response.json;

      const aiResponse: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        text: error ? `❌ Error: ${error}` : '✅ Generated SQL:',
        isUser: false,
        timestamp: new Date(),
        sql: error ? undefined : sql,
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error: any) {
      console.error('Error generating SQL:', error);

      const errorResponse: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        text: `❌ Error: ${error?.message || 'Failed to generate SQL. Please try again.'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setLoadingAI(false);
    }
  };

  const executeQuery = async (messageId: string, sql: string) => {
    if (!selectedDataset) return;

    // Find the dataset to get database_id
    const dataset = datasets.find(d => d.id === selectedDataset);
    if (!dataset) return;

    // Update message to show executing state
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, isExecuting: true } : msg,
      ),
    );

    try {
      // Fetch dataset details to get database_id and schema
      const datasetResponse = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${selectedDataset}`,
      });

      const datasetDetails = datasetResponse.json.result;
      const databaseId = datasetDetails.database.id;
      const schema = datasetDetails.schema;

      // Execute the SQL query using SQL Lab API
      const response = await SupersetClient.post({
        endpoint: '/api/v1/sqllab/execute/',
        jsonPayload: {
          database_id: databaseId,
          sql: sql,
          schema: schema,
          runAsync: false,
        },
      });

      const result = response.json;

      // Extract column names and data from result
      const columns = result.columns?.map((col: any) => col.name) || [];
      const data = result.data || [];

      // Update message with results
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? {
                ...msg,
                isExecuting: false,
                queryResults: {
                  columns,
                  data,
                  rowCount: data.length,
                },
              }
            : msg,
        ),
      );
    } catch (error: any) {
      console.error('Error executing query:', error);

      // Add error message
      const errorMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        text: `❌ Query execution failed: ${error?.message || 'Unknown error'}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [
        ...prev.map(msg =>
          msg.id === messageId ? { ...msg, isExecuting: false } : msg,
        ),
        errorMessage,
      ]);
    }
  };

  const datasetOptions = datasets.map(ds => ({
    label: `${ds.table_name} (${ds.database_name}${ds.schema ? ` - ${ds.schema}` : ''})`,
    value: ds.id,
  }));

  return (
    <PageContainer>
      <PageTitle>🤖 AI Assistant</PageTitle>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <StyledCard title={t('Chat with AI')} bordered={false}>
            <ChatContainer>
              {messages.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: theme.colorTextSecondary,
                    marginTop: '150px',
                  }}
                >
                  {t('Start a conversation with the AI Assistant')}
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <ChatMessage key={msg.id} isUser={msg.isUser}>
                      {msg.text}
                      {msg.sql && (
                        <div>
                          <SQLCodeBlock>
                            <code>{msg.sql}</code>
                          </SQLCodeBlock>
                          <div style={{ marginTop: '8px' }}>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => executeQuery(msg.id, msg.sql!)}
                              loading={msg.isExecuting}
                              disabled={msg.isExecuting}
                            >
                              {msg.isExecuting
                                ? 'Executing...'
                                : 'Execute Query'}
                            </Button>
                          </div>
                        </div>
                      )}
                      {msg.queryResults && (
                        <div style={{ marginTop: '16px' }}>
                          <div
                            style={{ marginBottom: '8px', fontWeight: 'bold' }}
                          >
                            📊 Results ({msg.queryResults.rowCount} rows):
                          </div>
                          <DataPreviewContainer>
                            <ColumnTable>
                              <thead>
                                <tr>
                                  {msg.queryResults.columns.map((col, idx) => (
                                    <th key={idx}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.queryResults.data.map((row, rowIdx) => {
                                  const results = msg.queryResults!;
                                  return (
                                    <tr key={rowIdx}>
                                      {results.columns.map((col, colIdx) => (
                                        <td key={colIdx}>
                                          {row[col] !== null &&
                                          row[col] !== undefined
                                            ? String(row[col])
                                            : '—'}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </ColumnTable>
                          </DataPreviewContainer>
                        </div>
                      )}
                    </ChatMessage>
                  ))}
                  {loadingAI && (
                    <LoadingMessage>🤖 Generating SQL query...</LoadingMessage>
                  )}
                </>
              )}
            </ChatContainer>

            <StyledTextArea
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInputValue(e.target.value)
              }
              placeholder={t('Type your message here...')}
              rows={3}
              disabled={loadingAI}
              onPressEnter={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (!e.shiftKey && !loadingAI) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <div style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                onClick={handleSendMessage}
                disabled={loadingAI || !inputValue.trim()}
                loading={loadingAI}
              >
                {t('Send')}
              </Button>
            </div>
          </StyledCard>
        </Col>

        <Col xs={24} lg={12}>
          <StyledCard title={t('Dataset Selection')} bordered={false}>
            <DatasetSelectorContainer>
              <Select
                showSearch
                value={selectedDataset}
                placeholder={t('Search and select a dataset')}
                loading={loadingDatasets}
                options={datasetOptions}
                onChange={(value: number) => setSelectedDataset(value)}
                filterOption={(input: string, option: any) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </DatasetSelectorContainer>

            {selectedDataset && datasetData && (
              <div>
                <h3>{t('Dataset Preview (Top 50 Rows)')}</h3>
                {loadingData ? (
                  <div>{t('Loading...')}</div>
                ) : (
                  <>
                    <DataPreviewContainer>
                      <ColumnTable>
                        <thead>
                          <tr>
                            {datasetData.columns.map((col, idx) => (
                              <th key={idx} title={col.description || ''}>
                                {col.name}
                                <br />
                                <small
                                  style={{
                                    fontWeight: 'normal',
                                    color: theme.colorTextTertiary,
                                  }}
                                >
                                  {col.type}
                                  {col.description && ' 📝'}
                                </small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datasetData.data.length === 0 ? (
                            <tr>
                              <td colSpan={datasetData.columns.length}>
                                {t('No data available')}
                              </td>
                            </tr>
                          ) : (
                            datasetData.data.map((row: any, rowIdx: number) => (
                              <tr key={rowIdx}>
                                {datasetData.columns.map((col, colIdx) => (
                                  <td key={colIdx}>
                                    {row[col.name] !== null &&
                                    row[col.name] !== undefined
                                      ? String(row[col.name])
                                      : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </ColumnTable>
                    </DataPreviewContainer>
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: theme.colorTextTertiary,
                      }}
                    />

                    {/* Schema info for AI context - for debugging */}
                    <div style={{ marginTop: '16px' }}>
                      <details>
                        <summary
                          style={{ cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          {t('Schema Information for AI')}
                        </summary>
                        <pre
                          style={{
                            marginTop: '8px',
                            padding: '12px',
                            backgroundColor: theme.colorBgLayout,
                            borderRadius: '4px',
                            fontSize: '12px',
                            overflow: 'auto',
                          }}
                        >
                          {buildSchemaInfo()}
                        </pre>
                      </details>
                    </div>
                  </>
                )}
              </div>
            )}
          </StyledCard>
        </Col>
      </Row>
    </PageContainer>
  );
}
