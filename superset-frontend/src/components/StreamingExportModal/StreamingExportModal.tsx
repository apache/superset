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
import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Modal, Button, Typography, Progress, theme } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  StopOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export enum ExportStatus {
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export interface StreamingProgress {
  rowsProcessed: number;
  totalRows?: number;
  totalSize: number;
  speed: number;
  mbPerSecond: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  status: ExportStatus;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

interface StreamingExportModalProps {
  visible: boolean;
  onCancel: () => void;
  onRetry?: () => void;
  progress: StreamingProgress;
  exportType: 'csv' | 'xlsx';
}

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px 0 ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ProgressSection = styled.div`
  margin: ${({ theme }) => theme.sizeUnit * 6}px 0;
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 6}px;
`;

const StatusIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;

  .anticon {
    font-size: 48px;
  }
`;

const StyledIcon = styled.span<{ color: string }>`
  color: ${({ color }) => color};
`;

const CenteredText = styled(Text)`
  display: block;
  text-align: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const ProgressText = styled(Text)`
  display: block;
  text-align: center;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const CancelButton = styled(Button)`
  background-color: #f0fff8;
  color: ${({ theme }) => theme.colorSuccess};
  border-color: transparent;

  &:hover {
    background-color: #d9f7e8;
    color: ${({ theme }) => theme.colorSuccess};
    border-color: transparent;
  }
`;

const DownloadButton = styled(Button)`
  background-color: #2fc096;
  color: white;
  border-color: #2fc096;

  &:hover {
    background-color: #26a77e;
    border-color: #26a77e;
  }

  &:disabled {
    background-color: #f5f5f5;
    color: rgba(0, 0, 0, 0.25);
    border-color: #d9d9d9;
  }
`;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatNumber = (num: number): string =>
  new Intl.NumberFormat().format(num);

interface StatusIconProps {
  status: ExportStatus;
}

const StatusIconComponent: React.FC<StatusIconProps> = ({ status }) => {
  const { token } = theme.useToken();

  const iconMap = {
    [ExportStatus.STREAMING]: { Icon: LoadingOutlined, color: token.colorPrimary },
    [ExportStatus.COMPLETED]: { Icon: CheckCircleOutlined, color: token.colorSuccess },
    [ExportStatus.ERROR]: { Icon: CloseCircleOutlined, color: token.colorError },
    [ExportStatus.CANCELLED]: { Icon: StopOutlined, color: token.colorWarning },
  };

  const { Icon, color } = iconMap[status] || iconMap[ExportStatus.STREAMING];
  return (
    <StatusIcon>
      <StyledIcon color={color}>
        <Icon />
      </StyledIcon>
    </StatusIcon>
  );
};

interface ErrorContentProps {
  error?: string;
  onRetry?: () => void;
  onCancel: () => void;
}

const ErrorContent: React.FC<ErrorContentProps> = ({
  error,
  onRetry,
  onCancel,
}) => (
  <ModalContent>
    <StatusIconComponent status={ExportStatus.ERROR} />
    <CenteredText type="danger">
      {error || t('An error occurred during export')}
    </CenteredText>
    <ActionButtons>
      {onRetry && (
        <Button type="primary" onClick={onRetry}>
          {t('Retry')}
        </Button>
      )}
      <Button onClick={onCancel}>{t('Close')}</Button>
    </ActionButtons>
  </ModalContent>
);

interface CancelledContentProps {
  onRetry?: () => void;
  onCancel: () => void;
}

const CancelledContent: React.FC<CancelledContentProps> = ({
  onRetry,
  onCancel,
}) => (
  <ModalContent>
    <StatusIconComponent status={ExportStatus.CANCELLED} />
    <CenteredText>{t('Export was cancelled')}</CenteredText>
    <ActionButtons>
      {onRetry && (
        <Button type="primary" onClick={onRetry}>
          {t('Restart Export')}
        </Button>
      )}
      <Button onClick={onCancel}>{t('Close')}</Button>
    </ActionButtons>
  </ModalContent>
);

interface CompletedContentProps {
  totalRows?: number;
  rowsProcessed: number;
  totalSize: number;
  filename?: string;
  downloadUrl?: string;
  onDownload: () => void;
  onCancel: () => void;
}

const CompletedContent: React.FC<CompletedContentProps> = ({
  totalRows,
  rowsProcessed,
  totalSize,
  filename,
  downloadUrl,
  onDownload,
  onCancel,
}) => {
  const { token } = theme.useToken();

  return (
    <ModalContent>
      <ProgressSection>
        <Progress
          percent={100}
          status="success"
          strokeColor={token.colorSuccess}
          showInfo={false}
        />
        <ProgressText>
          {t('Export successful %s', filename || 'export.csv')}
        </ProgressText>
      </ProgressSection>

      <ActionButtons>
        <CancelButton onClick={onCancel}>
          {t('Cancel')}
        </CancelButton>
        <DownloadButton
          onClick={onDownload}
          disabled={!downloadUrl}
        >
          {t('Download')}
        </DownloadButton>
      </ActionButtons>
    </ModalContent>
  );
};

interface StreamingContentProps {
  percentage: number;
  filename?: string;
  onCancel: () => void;
}

const StreamingContent: React.FC<StreamingContentProps> = ({
  percentage,
  filename,
  onCancel,
}) => {
  const { token } = theme.useToken();

  return (
    <ModalContent>
      <ProgressSection>
        <Progress
          percent={percentage}
          status="active"
          strokeColor={token.colorSuccess}
          showInfo
          format={percent => `${Math.round(percent || 0)}%`}
        />
        <ProgressText>
          {filename
            ? t('Processing export for %s', filename)
            : t('Processing export for {dashboard_name}_{YYYY-MM-DD}_{HHMMSS}.csv')}
        </ProgressText>
      </ProgressSection>

      <ActionButtons>
        <CancelButton onClick={onCancel}>
          {t('Cancel')}
        </CancelButton>
        <DownloadButton disabled>
          {t('Download')}
        </DownloadButton>
      </ActionButtons>
    </ModalContent>
  );
};

const StreamingExportModal: React.FC<StreamingExportModalProps> = ({
  visible,
  onCancel,
  onRetry,
  progress,
}) => {
  const { totalRows, rowsProcessed, totalSize, status, downloadUrl, filename, error } =
    progress;

  const getProgressPercentage = (): number => {
    if (status === ExportStatus.COMPLETED) return 100;

    if (totalRows && totalRows > 0) {
      const percentage = Math.min(99, (rowsProcessed / totalRows) * 100);
      return Math.round(percentage);
    }

    return status === ExportStatus.STREAMING ? 10 : 0;
  };

  const handleDownload = () => {
    if (downloadUrl && filename) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onCancel();
    }
  };

  let content;
  switch (status) {
    case ExportStatus.ERROR:
      content = <ErrorContent error={error} onRetry={onRetry} onCancel={onCancel} />;
      break;
    case ExportStatus.CANCELLED:
      content = <CancelledContent onRetry={onRetry} onCancel={onCancel} />;
      break;
    case ExportStatus.COMPLETED:
      content = (
        <CompletedContent
          totalRows={totalRows}
          rowsProcessed={rowsProcessed}
          totalSize={totalSize}
          filename={filename}
          downloadUrl={downloadUrl}
          onDownload={handleDownload}
          onCancel={onCancel}
        />
      );
      break;
    default:
      content = (
        <StreamingContent
          percentage={getProgressPercentage()}
          filename={filename}
          onCancel={onCancel}
        />
      );
  }

  return (
    <Modal
      title={t('CSV Export')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      centered
      maskClosable={false}
      closable={status !== ExportStatus.STREAMING}
    >
      {content}
    </Modal>
  );
};

export default StreamingExportModal;
