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
import { FC, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t, styled } from '@apache-superset/core';
import { css } from '@emotion/react';
import { Modal } from '@superset-ui/core/components';
import Tabs from '@superset-ui/core/components/Tabs';
import { Button, EmptyState } from '@superset-ui/core/components';
import { RootState } from 'src/dashboard/types';

const modalStyles = css`
  .ant-modal-body {
    height: 70vh;
    max-height: 800px;
    overflow: auto;
  }
`;

const ChartDataContainer = styled.div`
  margin-bottom: 24px;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 4px;
  padding: 16px;
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  overflow-y: visible;
  max-width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 4px;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.grayscale.light1};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.grayscale.light5};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const ChartTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const ChartMeta = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.grayscale.light5};
  margin-bottom: 8px;
`;

const DataTable = styled.table`
  width: 100%;
  min-width: max-content;
  border-collapse: collapse;
  font-size: 12px;

  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    white-space: nowrap;
    min-width: 100px;
  }

  th {
    background: ${({ theme }) => theme.colors.grayscale.light1};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    position: sticky;
    top: 0;
    z-index: 1;
  }

  tbody tr:hover {
    background: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const ExportButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const InfoText = styled.p`
  color: ${({ theme }) => theme.colors.grayscale.light5};
  font-size: 14px;
  margin-bottom: 24px;
`;

const EmptyStateWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
`;

interface DataBrowsingModalProps {
  dashboardId: number;
  visible: boolean;
  onClose: () => void;
}

interface ChartData {
  id: number;
  slice_name: string;
  datasource_name_text?: string;
  viz_type?: string;
  data?: any;
}

export const DataBrowsingModal: FC<DataBrowsingModalProps> = ({
  dashboardId,
  visible,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('data');

  // Get charts from dashboard state
  const sliceIds = useSelector(
    (state: RootState) => state.dashboardState?.sliceIds || [],
  );

  const sliceEntities = useSelector(
    (state: RootState) => state.sliceEntities?.slices || {},
  );

  const charts = useSelector((state: RootState) => state.charts || {});

  // Get chart information
  const dashboardCharts = useMemo(
    () =>
      sliceIds
        .map(id => {
          const sliceEntity = sliceEntities[id];
          const chartState = charts[id];
          return {
            id,
            slice_name: sliceEntity?.slice_name || `Chart ${id}`,
            datasource_name_text: sliceEntity?.datasource_name,
            viz_type: sliceEntity?.viz_type,
            data: chartState?.queriesResponse?.[0]?.data || null,
            colnames: chartState?.queriesResponse?.[0]?.colnames || [],
            rowcount: chartState?.queriesResponse?.[0]?.rowcount || 0,
          };
        })
        .filter(chart => chart !== null) as ChartData[],
    [sliceIds, sliceEntities, charts]
  );

  const exportChartData = (chart: ChartData, format: 'csv' | 'json') => {
    if (!chart.data) return;

    const data = chart.data;
    let content: string;
    let mimeType: string;
    let fileName: string;

    if (format === 'csv') {
      // Convert to CSV
      const colnames = (chart as any).colnames || [];
      const csvRows = [];
      csvRows.push(colnames.join(','));

      data.forEach((row: any) => {
        const values = colnames.map((col: string) => {
          const val = row[col];
          return typeof val === 'string' && val.includes(',')
            ? `"${val}"`
            : val;
        });
        csvRows.push(values.join(','));
      });

      content = csvRows.join('\n');
      mimeType = 'text/csv;charset=utf-8;';
      fileName = `${chart.slice_name.replace(/[^a-z0-9]/gi, '_')}_data.csv`;
    } else {
      // JSON format
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      fileName = `${chart.slice_name.replace(/[^a-z0-9]/gi, '_')}_data.json`;
    }

    // Create download link
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderChartData = (chart: ChartData) => {
    const data = chart.data;
    const colnames = (chart as any).colnames || [];

    if (!data || data.length === 0) {
      return (
        <EmptyState
          image="empty.svg"
          title={t('No data available for this chart')}
        />
      );
    }

    // Limit to first 100 rows for display
    const displayData = data.slice(0, 100);
    const hasMore = data.length > 100;

    return (
      <>
        <TableWrapper>
          <DataTable>
            <thead>
              <tr>
                {colnames.map((col: string) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row: any, idx: number) => (
                <tr key={idx}>
                  {colnames.map((col: string) => (
                    <td key={col}>{row[col]?.toString() || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrapper>
        {hasMore && (
          <InfoText>
            {t('Showing first 100 rows of %s total rows', data.length)}
          </InfoText>
        )}
      </>
    );
  };

  const dataTabContent = (
    <div>
      <InfoText>{t('Browse and export data from dashboard charts')}</InfoText>

      {dashboardCharts.length === 0 ? (
        <EmptyStateWrapper>
          <EmptyState
            image="empty.svg"
            title={t('No charts found')}
            description={t('This dashboard has no charts with data')}
          />
        </EmptyStateWrapper>
      ) : (
        dashboardCharts.map(chart => (
          <ChartDataContainer key={chart.id}>
            <ChartHeader>
              <div>
                <ChartTitle>📊 {chart.slice_name}</ChartTitle>
                <ChartMeta>
                  {chart.datasource_name_text && (
                    <span>💾 {chart.datasource_name_text}</span>
                  )}
                  {chart.viz_type && <span>📈 {chart.viz_type}</span>}
                  {(chart as any).rowcount > 0 && (
                    <span>
                      📋 {(chart as any).rowcount} {t('rows')}
                    </span>
                  )}
                </ChartMeta>
              </div>
              <ExportButtonGroup>
                <Button
                  buttonSize="small"
                  onClick={() => exportChartData(chart, 'csv')}
                  disabled={!chart.data || chart.data.length === 0}
                >
                  📄 CSV
                </Button>
                <Button
                  buttonSize="small"
                  onClick={() => exportChartData(chart, 'json')}
                  disabled={!chart.data || chart.data.length === 0}
                >
                  📄 JSON
                </Button>
              </ExportButtonGroup>
            </ChartHeader>
            {renderChartData(chart)}
          </ChartDataContainer>
        ))
      )}
    </div>
  );

  const exportTabContent = (
    <div>
      <InfoText>{t('Quick export options for dashboard data')}</InfoText>
      <ChartDataContainer>
        <h4>{t('Export All Chart Data')}</h4>
        <p>{t('Download data from all charts in the dashboard')}</p>
        <ExportButtonGroup>
          <Button
            buttonStyle="primary"
            onClick={() => {
              dashboardCharts.forEach(chart => {
                if (chart.data && chart.data.length > 0) {
                  exportChartData(chart, 'csv');
                }
              });
            }}
            disabled={dashboardCharts.length === 0}
          >
            ⬇️ {t('Export All as CSV')}
          </Button>
          <Button
            onClick={() => {
              dashboardCharts.forEach(chart => {
                if (chart.data && chart.data.length > 0) {
                  exportChartData(chart, 'json');
                }
              });
            }}
            disabled={dashboardCharts.length === 0}
          >
            ⬇️ {t('Export All as JSON')}
          </Button>
        </ExportButtonGroup>
      </ChartDataContainer>

      <ChartDataContainer>
        <h4>{t('Dashboard Exports')}</h4>
        <p>
          {t(
            'Export the dashboard as image or PDF (uses existing functionality)',
          )}
        </p>
        <InfoText>
          {t(
            'Use the "Download" option in the dashboard menu for PDF and PNG exports',
          )}
        </InfoText>
      </ChartDataContainer>
    </div>
  );

  const tabItems = [
    {
      key: 'data',
      label: t('Dashboard Data'),
      children: dataTabContent,
    },
    {
      key: 'export',
      label: t('Export Options'),
      children: exportTabContent,
    },
  ];

  return (
    <Modal
      title={t('Browse Dashboard Data')}
      show={visible}
      onHide={onClose}
      width="90%"
      maxWidth="1600px"
      responsive
      footer={
        <Button key="close" onClick={onClose}>
          {t('Close')}
        </Button>
      }
    >
      <div css={modalStyles}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {tabItems.map(tab => (
            <Tabs.TabPane key={tab.key} tab={tab.label}>
              {tab.children}
            </Tabs.TabPane>
          ))}
        </Tabs>
      </div>
    </Modal>
  );
};

export default DataBrowsingModal;
