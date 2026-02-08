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
import { styled, t } from '@apache-superset/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { BulkExportProgress } from './useBulkExport';

const Container = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px 0;
  `}
`;

const ProgressHeader = styled.div`
  ${({ theme }) => `
    text-align: center;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const ProgressText = styled.div`
  ${({ theme }) => `
    font-size: ${theme.sizeUnit * 4}px;
    font-weight: 500;
    color: ${theme.colorText};
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const ProgressSubtext = styled.div`
  ${({ theme }) => `
    font-size: ${theme.sizeUnit * 3.5}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const ProgressBarContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: ${theme.sizeUnit * 2}px;
    background-color: ${theme.colorFillSecondary};
    border-radius: ${theme.sizeUnit}px;
    overflow: hidden;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const ProgressBarFill = styled.div<{ progress: number }>`
  ${({ theme, progress }) => `
    height: 100%;
    width: ${progress}%;
    background-color: ${theme.colorPrimary};
    transition: width 0.3s ease;
  `}
`;

const ChartStatusList = styled.div`
  ${({ theme }) => `
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.sizeUnit}px;
  `}
`;

const ChartStatusItem = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    &:last-child {
      border-bottom: none;
    }
  `}
`;

const StatusIcon = styled.div<{ status: string }>`
  ${({ theme, status }) => `
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 5}px;
    margin-right: ${theme.sizeUnit * 2}px;
    color: ${
      status === 'success'
        ? theme.colorSuccess
        : status === 'error'
          ? theme.colorError
          : status === 'exporting'
            ? theme.colorPrimary
            : theme.colorTextSecondary
    };
  `}
`;

const ChartNameText = styled.span`
  ${({ theme }) => `
    flex: 1;
    font-size: ${theme.sizeUnit * 3.5}px;
  `}
`;

const StatusText = styled.span<{ status: string }>`
  ${({ theme, status }) => `
    font-size: ${theme.sizeUnit * 3}px;
    color: ${
      status === 'success'
        ? theme.colorSuccess
        : status === 'error'
          ? theme.colorError
          : theme.colorTextSecondary
    };
  `}
`;

const ErrorMessage = styled.div`
  ${({ theme }) => `
    font-size: ${theme.sizeUnit * 3}px;
    color: ${theme.colorError};
    margin-top: ${theme.sizeUnit}px;
    padding-left: ${theme.sizeUnit * 7}px;
  `}
`;

export interface ExportProgressProps {
  progress: BulkExportProgress;
}

export const ExportProgress = ({ progress }: ExportProgressProps) => {
  const { current, total, charts } = progress;
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Icons.CheckCircleOutlined iconSize="l" />;
      case 'error':
        return <Icons.CloseCircleOutlined iconSize="l" />;
      case 'exporting':
        return <Icons.LoadingOutlined iconSize="l" spin />;
      default:
        return <Icons.ClockCircleOutlined iconSize="l" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return t('Completed');
      case 'error':
        return t('Failed');
      case 'exporting':
        return t('Exporting...');
      default:
        return t('Pending');
    }
  };

  return (
    <Container>
      <ProgressHeader>
        <ProgressText>
          {t('Exporting chart %s of %s', current, total)}
        </ProgressText>
        <ProgressSubtext>
          {t('Please wait while we export your dashboard data')}
        </ProgressSubtext>
      </ProgressHeader>

      <ProgressBarContainer>
        <ProgressBarFill progress={progressPercent} />
      </ProgressBarContainer>

      <ChartStatusList>
        {charts.map(chart => (
          <div key={chart.chartId}>
            <ChartStatusItem>
              <StatusIcon status={chart.status}>
                {getStatusIcon(chart.status)}
              </StatusIcon>
              <ChartNameText>{chart.chartName}</ChartNameText>
              <StatusText status={chart.status}>
                {getStatusText(chart.status)}
              </StatusText>
            </ChartStatusItem>
            {chart.error && <ErrorMessage>{chart.error}</ErrorMessage>}
          </div>
        ))}
      </ChartStatusList>
    </Container>
  );
};
