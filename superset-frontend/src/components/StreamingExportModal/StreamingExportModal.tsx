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
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import {
  Modal,
  Button,
  Typography,
  Progress,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

const { Text } = Typography;

export enum ExportStatus {
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

const COMPLETED_PERCENT = 100;

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
  retryCount?: number;
}

interface StreamingExportModalProps {
  visible: boolean;
  onCancel: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  progress: StreamingProgress;
}

const ModalContent = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px 0 ${theme.sizeUnit * 2}px;
  `}
`;

const ProgressSection = styled.div`
  ${({ theme }) => `
    margin: ${theme.sizeUnit * 6}px 0;
    position: relative;
  `}
`;

const ProgressWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const StyledProgress = styled(Progress)`
  flex: 1;
`;

const SuccessIcon = styled(Icons.CheckCircleFilled)`
  ${({ theme }) => `
    color: ${theme.colorSuccess};
    font-size: ${theme.sizeUnit * 6}px;
    flex-shrink: 0;
  `}
`;

const ErrorIconWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${theme.sizeUnit * 4}px;
    height: ${theme.sizeUnit * 4}px;
    background-color: ${theme.colorError};
    border-radius: 50%;
    flex-shrink: 0;
  `}
`;

const ErrorIconStyled = styled(Icons.CloseOutlined)`
  ${({ theme }) => `
    color: ${theme.colorWhite};
    font-size: ${theme.sizeUnit * 2.5}px;
  `}
`;

const ActionButtons = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    justify-content: flex-end;
  `}
`;

const CenteredText = styled(Text)`
  ${({ theme }) => `
    display: block;
    text-align: center;
    margin-top: ${theme.sizeUnit * 4}px;
  `}
`;

const ErrorText = styled(CenteredText)`
  ${({ theme }) => `
    color: ${theme.colorError};
  `}
`;

const CancelButton = styled(Button)`
  ${({ theme }) => `
    background-color: ${theme.colorSuccessBg};
    color: ${theme.colorSuccess};
    border-color: ${theme.colorSuccessBg};

    &:hover {
      background-color: ${theme.colorSuccessBg};
      color: ${theme.colorSuccess};
      border-color: ${theme.colorSuccess};
    }

    &:focus {
      background-color: ${theme.colorSuccessBg};
      color: ${theme.colorSuccess};
      border-color: ${theme.colorSuccess};
    }
  `}
`;

const DownloadButton = styled(Button)`
  ${({ theme }) => `
    background-color: ${theme.colorSuccess};
    border-color: ${theme.colorSuccess};
    color: ${theme.colorWhite};

    &:hover:not(:disabled) {
      background-color: ${theme.colorSuccessActive};
      border-color: ${theme.colorSuccessActive};
      color: ${theme.colorWhite};
    }

    &:focus:not(:disabled) {
      background-color: ${theme.colorSuccess};
      border-color: ${theme.colorSuccess};
      color: ${theme.colorWhite};
    }

    &:disabled {
      background-color: ${theme.colorBgContainerDisabled};
      border-color: ${theme.colorBgContainerDisabled};
      color: ${theme.colorTextDisabled};
    }
  `}
`;

const triggerFileDownload = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const calculateProgressPercentage = (
  status: ExportStatus,
  totalRows?: number,
  rowsProcessed?: number,
): number => {
  if (status === ExportStatus.COMPLETED) return COMPLETED_PERCENT;

  if (!totalRows || totalRows <= 0 || !rowsProcessed) return 0;

  const percentage = (rowsProcessed / totalRows) * 100;
  return Math.floor(percentage);
};

const getProgressStatus = (
  status: ExportStatus,
): 'success' | 'exception' | 'normal' => {
  switch (status) {
    case ExportStatus.COMPLETED:
      return 'success';
    case ExportStatus.ERROR:
    case ExportStatus.CANCELLED:
      return 'exception';
    case ExportStatus.STREAMING:
    default:
      return 'normal';
  }
};

const getMessageText = (
  status: ExportStatus,
  filename?: string,
  error?: string,
): string => {
  switch (status) {
    case ExportStatus.ERROR:
      return error || t('Export failed');
    case ExportStatus.CANCELLED:
      return t('Export cancelled');
    case ExportStatus.COMPLETED:
      return t('Export successful: %s', filename || 'export');
    case ExportStatus.STREAMING:
    default:
      return filename
        ? t('Processing export for %s', filename)
        : t('Processing export...');
  }
};

const getButtonText = (status: ExportStatus): string => {
  switch (status) {
    case ExportStatus.ERROR:
    case ExportStatus.CANCELLED:
    case ExportStatus.COMPLETED:
      return t('Close');
    case ExportStatus.STREAMING:
    default:
      return t('Cancel');
  }
};

interface ModalStateContentProps {
  status: ExportStatus;
  progress: StreamingProgress;
  onCancel: () => void;
  onRetry?: () => void;
  onDownload: () => void;
  getProgressPercentage: () => number;
}

const ModalStateContent = ({
  status,
  progress,
  onCancel,
  onRetry,
  onDownload,
  getProgressPercentage,
}: ModalStateContentProps) => {
  const theme = useTheme();
  const { downloadUrl, filename, error } = progress;

  const isError = status === ExportStatus.ERROR;
  const isCancelled = status === ExportStatus.CANCELLED;
  const isCompleted = status === ExportStatus.COMPLETED;
  const isStreaming = status === ExportStatus.STREAMING;

  const hasIcon = isError || isCompleted;
  const shouldShowRetry = (isError || isCancelled) && onRetry;

  const progressStatus = getProgressStatus(status);
  const progressPercent = isCompleted ? 100 : getProgressPercentage();
  const messageText = getMessageText(status, filename, error);
  const buttonText = getButtonText(status);

  const progressProps = {
    percent: progressPercent,
    status: progressStatus,
    showInfo: isStreaming,
    ...(isStreaming && {
      strokeColor: theme.colorSuccess,
      format: (percent?: number) => `${Math.round(percent || 0)}%`,
    }),
  };

  return (
    <ModalContent>
      <ProgressSection>
        {hasIcon ? (
          <ProgressWrapper>
            <StyledProgress {...progressProps} />
            {isError && (
              <ErrorIconWrapper>
                <ErrorIconStyled />
              </ErrorIconWrapper>
            )}
            {isCompleted && <SuccessIcon />}
          </ProgressWrapper>
        ) : (
          <Progress {...progressProps} />
        )}
        {isError ? (
          <ErrorText>{messageText}</ErrorText>
        ) : (
          <CenteredText>{messageText}</CenteredText>
        )}
      </ProgressSection>
      <ActionButtons>
        <CancelButton onClick={onCancel}>{buttonText}</CancelButton>
        {shouldShowRetry ? (
          <DownloadButton onClick={onRetry}>{t('Retry')}</DownloadButton>
        ) : (
          <DownloadButton
            onClick={onDownload}
            disabled={!isCompleted || !downloadUrl}
          >
            {t('Download')}
          </DownloadButton>
        )}
      </ActionButtons>
    </ModalContent>
  );
};

const StreamingExportModal = ({
  visible,
  onCancel,
  onRetry,
  onDownload,
  progress,
}: StreamingExportModalProps) => {
  const { status, downloadUrl, filename } = progress;

  const getProgressPercentage = (): number =>
    calculateProgressPercentage(
      status,
      progress.totalRows,
      progress.rowsProcessed,
    );

  const handleDownload = () => {
    if (downloadUrl && filename) {
      triggerFileDownload(downloadUrl, filename);
      onDownload?.(); // Call onDownload callback if provided
      onCancel();
    }
  };

  return (
    <Modal
      title={t('CSV Export')}
      show={visible}
      onHide={onCancel}
      hideFooter
      width={600}
      maskClosable={false}
      centered
    >
      <ModalStateContent
        status={status}
        progress={progress}
        onCancel={onCancel}
        onRetry={onRetry}
        onDownload={handleDownload}
        getProgressPercentage={getProgressPercentage}
      />
    </Modal>
  );
};

export default StreamingExportModal;
