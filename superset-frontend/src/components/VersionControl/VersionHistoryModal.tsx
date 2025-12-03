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

import { useState, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';
import { Modal, Input, Button, Loading } from '@superset-ui/core/components';

const VersionCard = styled.div<{ selected?: boolean }>`
  ${({ theme, selected }) => `
    border: 1px solid ${theme.colorBorder};
    padding: ${theme.paddingSM}px;
    margin-bottom: ${theme.marginXS}px;
    cursor: pointer;
    border-radius: ${theme.borderRadius}px;
    background: ${selected ? theme.colorPrimaryBg : theme.colorBgContainer};

    &:hover {
      border-color: ${theme.colorPrimary};
    }
  `}
`;

interface Version {
  version_number: number;
  description: string;
  created_by: string;
  created_on: string;
  commit_sha?: string;
}

interface Props {
  visible: boolean;
  assetType: 'chart' | 'dashboard' | 'dataset';
  assetId: number;
  assetName: string;
  onCancel: () => void;
}

export const VersionHistoryModal: React.FC<Props> = ({
  visible,
  assetType,
  assetId,
  assetName,
  onCancel,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadVersions();
    }
  }, [visible]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/version/${assetType}/${assetId}/list`,
      });
      setVersions(response.json.result.versions);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load versions';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    setLoading(true);
    try {
      await SupersetClient.post({
        endpoint: `/api/v1/version/${assetType}/${assetId}/save`,
        jsonPayload: { description },
      });
      setSuccess('Version saved successfully');
      setDescription('');
      setShowSaveModal(false);
      loadVersions();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save version';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Restore to Version ${selectedVersion}?`)) return;

    setLoading(true);
    try {
      await SupersetClient.post({
        endpoint: `/api/v1/version/${assetType}/${assetId}/restore`,
        jsonPayload: { version_number: selectedVersion },
      });
      setSuccess('Version restored - reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to restore version';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  if (showSaveModal) {
    return (
      <Modal
        title={t('Save Version')}
        show
        onHide={() => setShowSaveModal(false)}
        onHandledPrimaryAction={handleSave}
        primaryButtonName={t('Save')}
        primaryButtonLoading={loading}
        width="600px"
      >
        <p>Save a version of &quot;{assetName}&quot;</p>
        <Input.TextArea
          placeholder="Describe what changed..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          showCount
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={`Version History - ${assetName}`}
      show={visible}
      onHide={onCancel}
      width="700px"
      footer={
        <>
          <Button
            htmlType="button"
            buttonSize="small"
            onClick={() => setShowSaveModal(true)}
            cta
          >
            {t('Save Version')}
          </Button>
          {selectedVersion && (
            <Button
              htmlType="button"
              buttonSize="small"
              buttonStyle="primary"
              onClick={handleRestore}
              cta
            >
              {t('Restore version')}
            </Button>
          )}
          <Button htmlType="button" buttonSize="small" onClick={onCancel} cta>
            {t('Close')}
          </Button>
        </>
      }
    >
      {error && <Alert type="error" message={error} closable />}
      {success && <Alert type="success" message={success} closable />}

      {loading && <Loading />}

      {!loading && versions.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          No versions yet. Click &quot;Save Version&quot; to create one.
        </div>
      )}

      {!loading &&
        versions.map(v => (
          <VersionCard
            key={v.version_number}
            selected={selectedVersion === v.version_number}
            onClick={() => setSelectedVersion(v.version_number)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Version {v.version_number}</strong>
              <span style={{ fontSize: 12, color: '#666' }}>
                {formatDate(v.created_on)}
              </span>
            </div>
            <div style={{ margin: '8px 0' }}>{v.description}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              By {v.created_by}
              {v.commit_sha && ` • ${v.commit_sha.substring(0, 7)}`}
            </div>
          </VersionCard>
        ))}
    </Modal>
  );
};
