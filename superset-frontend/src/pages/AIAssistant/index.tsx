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
import { styled } from '@apache-superset/core/ui';
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
  min-height: 400px;
  max-height: 400px;
  overflow-y: auto;
  padding: 32px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background-color: #f5f5f5;
  margin-bottom: 32px;
`;

const ChatMessage = styled.div<{ isUser?: boolean }>`
  padding: 24px;
  margin-bottom: 16px;
  border-radius: 8px;
  background-color: ${(props: { isUser?: boolean }) =>
    props.isUser ? '#e6f7ff' : '#ffffff'};
  max-width: 80%;
  ${(props: { isUser?: boolean }) =>
    props.isUser ? 'margin-left: auto;' : 'margin-right: auto;'}
`;

const DatasetSelectorContainer = styled.div`
  margin-bottom: 32px;
`;

const StyledTextArea = styled(TextArea)`
  margin-bottom: 16px;
`;

const DataPreviewContainer = styled.div`
  max-height: 500px;
  overflow: auto;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  margin-top: 16px;
`;

const ColumnTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #d9d9d9;
    white-space: nowrap;
  }

  th {
    font-weight: 600;
    background-color: #fafafa;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tr:hover {
    background-color: #f5f5f5;
  }
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
}

interface DatasetData {
  columns: Array<{ name: string; type: string }>;
  data: Array<Record<string, any>>;
}

export default function AIAssistant() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [datasetData, setDatasetData] = useState<DatasetData | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
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

      // Get column information
      const columns = dataset.columns?.map((col: any) => ({
        name: col.column_name,
        type: col.type,
      })) || [];

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
      const columns = dataset.columns?.map((col: any) => ({
        name: col.column_name,
        type: col.type,
      })) || [];
      setDatasetData({
        columns,
        data: [],
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: ChatMessageType = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        text: 'AI response functionality will be implemented in the next phase. For now, you can select a dataset to view its structure.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 500);
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
                <div style={{ textAlign: 'center', color: '#999', marginTop: '150px' }}>
                  {t('Start a conversation with the AI Assistant')}
                </div>
              ) : (
                messages.map(msg => (
                  <ChatMessage key={msg.id} isUser={msg.isUser}>
                    {msg.text}
                  </ChatMessage>
                ))
              )}
            </ChatContainer>

            <StyledTextArea
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInputValue(e.target.value)
              }
              placeholder={t('Type your message here...')}
              rows={3}
              onPressEnter={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <div style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={handleSendMessage}>
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
                              <th key={idx}>
                                {col.name}
                                <br />
                                <small style={{ fontWeight: 'normal', color: '#888' }}>
                                  {col.type}
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
                                    {row[col.name] !== null && row[col.name] !== undefined
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
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                      {t('Showing {{count}} rows', { count: datasetData.data.length })}
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
