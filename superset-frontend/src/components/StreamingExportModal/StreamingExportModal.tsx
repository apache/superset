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
/* eslint-disable theme-colors/no-literal-colors */
import { styled, t } from '@superset-ui/core';
import { Modal, Button, Typography, Progress } from 'antd';
import { Icons } from '@superset-ui/core/components/Icons';

const { Text } = Typography;

export enum ExportStatus {
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export interface StreamingProgress {
  totalRows?: number;
  rowsProcessed: number;
  totalSize: number;
  status: ExportStatus;
  downloadUrl?: string;
  error?: string;
  filename?: string;
  speed?: number;
  mbPerSecond?: number;
  elapsedTime?: number;
}

interface StreamingExportModalProps {
  visible: boolean;
  onCancel: () => void;
  onRetry?: () => void;
  progress: StreamingProgress;
  exportType: 'csv' | 'xlsx';
}

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px 0
    ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ProgressSection = styled.div`
  margin: ${({ theme }) => theme.sizeUnit * 6}px 0;
  position: relative;
`;

const ProgressWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const SuccessIcon = styled(Icons.CheckCircleFilled)`
  color: #52c41a;
  font-size: 24px;
  flex-shrink: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  justify-content: flex-end;
`;

const ProgressText = styled(Text)`
  display: block;
  text-align: center;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const ErrorText = styled(Text)`
  display: block;
  text-align: center;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const CancelButton = styled(Button)`
  background-color: #f0fff8;
  color: #1c997a;
  border-color: #f0fff8;

  &:hover {
    background-color: #f0fff8;
    color: #1c997a;
    border-color: #1c997a;
  }

  &:focus {
    background-color: #f0fff8;
    color: #1c997a;
    border-color: #1c997a;
  }
`;

const DownloadButton = styled(Button)`
  &.ant-btn-primary {
    background-color: #2ec196;
    border-color: #2ec196;
    color: #ffffff;

    &:hover:not(:disabled) {
      background-color: #26a880;
      border-color: #26a880;
      color: #ffffff;
    }

    &:focus:not(:disabled) {
      background-color: #2ec196;
      border-color: #2ec196;
      color: #ffffff;
    }

    &:disabled {
      background-color: #f2f2f2;
      border-color: #f2f2f2;
      color: #b5b5b5;
    }
  }
`;

const StreamingExportModal = ({
  visible,
  onCancel,
  onRetry,
  progress,
}: StreamingExportModalProps) => {
  const { status, downloadUrl, filename, error } = progress;

  const getProgressPercentage = (): number => {
    if (status === ExportStatus.COMPLETED) return 100;
    if (progress.totalRows && progress.totalRows > 0) {
      const percentage = Math.min(
        99,
        (progress.rowsProcessed / progress.totalRows) * 100,
      );
      return Math.round(percentage);
    }
    return 0;
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onCancel();
    }
  };

  let content;
  if (status === ExportStatus.ERROR) {
    content = (
      <ModalContent>
        <ProgressSection>
          <Progress percent={0} status="exception" showInfo={false} />
          <ErrorText type="danger">{error || t('Export failed')}</ErrorText>
        </ProgressSection>
        <ActionButtons>
          <CancelButton onClick={onCancel}>{t('Close')}</CancelButton>
          {onRetry && (
            <DownloadButton type="primary" onClick={onRetry}>
              {t('Retry')}
            </DownloadButton>
          )}
        </ActionButtons>
      </ModalContent>
    );
  } else if (status === ExportStatus.CANCELLED) {
    content = (
      <ModalContent>
        <ProgressSection>
          <Progress
            percent={getProgressPercentage()}
            status="exception"
            showInfo={false}
          />
          <ProgressText>{t('Export cancelled')}</ProgressText>
        </ProgressSection>
        <ActionButtons>
          <CancelButton onClick={onCancel}>{t('Close')}</CancelButton>
          {onRetry && (
            <DownloadButton type="primary" onClick={onRetry}>
              {t('Retry')}
            </DownloadButton>
          )}
        </ActionButtons>
      </ModalContent>
    );
  } else if (status === ExportStatus.COMPLETED) {
    content = (
      <ModalContent>
        <ProgressSection>
          <ProgressWrapper>
            <Progress
              percent={100}
              status="success"
              showInfo={false}
              style={{ flex: 1 }}
            />
            <SuccessIcon />
          </ProgressWrapper>
          <ProgressText>
            {t('Export successful: %s', filename || 'export.csv')}
          </ProgressText>
        </ProgressSection>
        <ActionButtons>
          <CancelButton onClick={onCancel}>{t('Close')}</CancelButton>
          <DownloadButton
            type="primary"
            onClick={handleDownload}
            disabled={!downloadUrl}
          >
            {t('Download')}
          </DownloadButton>
        </ActionButtons>
      </ModalContent>
    );
  } else {
    content = (
      <ModalContent>
        <ProgressSection>
          <Progress
            percent={getProgressPercentage()}
            status="normal"
            strokeColor="#52c41a"
            showInfo
            format={percent => `${Math.round(percent || 0)}%`}
          />
          <ProgressText>
            {filename
              ? t('Processing export for %s', filename)
              : t('Processing export...')}
          </ProgressText>
        </ProgressSection>
        <ActionButtons>
          <CancelButton onClick={onCancel}>{t('Cancel')}</CancelButton>
          <DownloadButton type="primary" disabled>
            {t('Download')}
          </DownloadButton>
        </ActionButtons>
      </ModalContent>
    );
  }

  return (
    <Modal
      title={t('Exporting Data')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      maskClosable={false}
      centered
    >
      {content}
    </Modal>
  );
};

export default StreamingExportModal;
