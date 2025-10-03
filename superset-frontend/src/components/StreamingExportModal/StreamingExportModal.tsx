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
import { Modal, Button, Typography, Space, Progress } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  LoadingOutlined,
  StopOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

export interface StreamingProgress {
  rowsProcessed: number;
  totalRows?: number; // total expected rows for percentage calculation
  totalSize: number; // in bytes
  speed: number; // rows per second
  mbPerSecond: number;
  elapsedTime: number; // seconds
  estimatedTimeRemaining?: number; // seconds
  status: 'streaming' | 'completed' | 'error' | 'cancelled';
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
  padding: ${({ theme }) => theme.sizeUnit * 4}px 0;
  min-height: 200px;
`;

const ProgressSection = styled.div`
  margin: ${({ theme }) => theme.sizeUnit * 6}px 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
  margin: ${({ theme }) => theme.sizeUnit * 4}px 0;
`;

const StatItem = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  background: ${({ theme }) => theme.colorFillAlter};
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: center;
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

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const formatNumber = (num: number): string =>
  new Intl.NumberFormat().format(num);

const StreamingExportModal: React.FC<StreamingExportModalProps> = ({
  visible,
  onCancel,
  onRetry,
  progress,
  exportType,
}) => {
  const {
    rowsProcessed,
    totalSize,
    speed,
    mbPerSecond,
    elapsedTime,
    estimatedTimeRemaining,
    status,
    downloadUrl,
    filename,
    error,
  } = progress;

  const getProgressPercentage = (): number => {
    if (status === 'completed') return 100;

    // Calculate actual percentage based on rows processed vs total expected rows
    if (progress.totalRows && progress.totalRows > 0) {
      // Use rows processed even if it's 0 - this allows for 0% at start
      const percentage = Math.min(
        99,
        (rowsProcessed / progress.totalRows) * 100,
      );
      const rounded = Math.round(percentage);

      // 🔍 DEBUG: Log percentage calculation
      console.log('🎯 FRONTEND MODAL PERCENTAGE:', {
        rowsProcessed,
        totalRows: progress.totalRows,
        rawPercentage: percentage.toFixed(2),
        roundedPercentage: rounded,
        status,
      });

      return rounded;
    }

    // Fallback: estimate based on time if we have estimatedTimeRemaining
    if (estimatedTimeRemaining && elapsedTime > 0) {
      const totalEstimatedTime = elapsedTime + estimatedTimeRemaining;
      const percentage = Math.min(
        95,
        Math.round((elapsedTime / totalEstimatedTime) * 100),
      );

      console.log('⏰ FRONTEND MODAL TIME-BASED:', {
        elapsedTime,
        estimatedTimeRemaining,
        totalEstimatedTime,
        percentage,
      });

      return percentage;
    }

    // Default fallback for streaming status
    const fallback = status === 'streaming' ? 10 : 0;
    console.log('🔄 FRONTEND MODAL FALLBACK:', {
      status,
      fallback,
      hasRows: rowsProcessed > 0,
      hasTotalRows: !!progress.totalRows,
      reasonForFallback: !progress.totalRows ? 'No totalRows' : 'Unknown',
    });

    return fallback;
  };

  const renderStatusIcon = () => {
    switch (status) {
      case 'streaming':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'cancelled':
        return <StopOutlined style={{ color: '#faad14' }} />;
      default:
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getTitle = () => t('CSV Export');

  const handleDownload = () => {
    if (downloadUrl && filename) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onCancel(); // Close modal after download
    }
  };

  const renderContent = () => {
    if (status === 'error') {
      return (
        <ModalContent>
          <StatusIcon>{renderStatusIcon()}</StatusIcon>
          <Text
            type="danger"
            style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}
          >
            {error || t('An error occurred during export')}
          </Text>
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
    }

    if (status === 'cancelled') {
      return (
        <ModalContent>
          <StatusIcon>{renderStatusIcon()}</StatusIcon>
          <Text
            style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}
          >
            {t('Export was cancelled')}
          </Text>
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
    }

    if (status === 'completed') {
      return (
        <ModalContent>
          <StatusIcon>{renderStatusIcon()}</StatusIcon>
          <Text
            style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}
            strong
          >
            {t(
              'Successfully exported %s rows (%s)',
              formatNumber(rowsProcessed),
              formatFileSize(totalSize),
            )}
          </Text>
          {filename && (
            <Text
              style={{
                display: 'block',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {filename}
            </Text>
          )}
          <ActionButtons>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              disabled={!downloadUrl}
            >
              {t('Download')}
            </Button>
            <Button onClick={onCancel}>{t('Close')}</Button>
          </ActionButtons>
        </ModalContent>
      );
    }

    // Streaming status
    return (
      <ModalContent>
        <ProgressSection>
          <Progress
            percent={getProgressPercentage()}
            status={status === 'streaming' ? 'active' : 'normal'}
            strokeColor="#52c41a"
            showInfo
            format={percent => `${Math.round(percent || 0)}%`}
          />
          <Text
            style={{ display: 'block', textAlign: 'center', marginTop: 16 }}
          >
            {filename
              ? t('Processing export for %s', filename)
              : t(
                  'Processing export for {dashboard_name}_{YYYY-MM-DD}_{HHMMSS}.csv',
                )}
          </Text>
        </ProgressSection>

        <ActionButtons>
          <Button type="text" style={{ color: '#52c41a' }} onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button
            type="default"
            disabled={status !== 'completed'}
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            {t('Download')}
          </Button>
        </ActionButtons>
      </ModalContent>
    );
  };

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      centered
      maskClosable={false}
      closable={status !== 'streaming'}
    >
      {renderContent()}
    </Modal>
  );
};

export default StreamingExportModal;
