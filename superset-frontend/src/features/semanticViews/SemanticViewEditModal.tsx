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
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { SupersetClient } from '@superset-ui/core';
import { Input, InputNumber } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  StandardModal,
  ModalFormField,
  MODAL_STANDARD_WIDTH,
} from 'src/components/Modal';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

interface SemanticViewEditModalProps {
  show: boolean;
  onHide: () => void;
  onSave: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  semanticView: {
    id: number;
    table_name: string;
    description?: string | null;
    cache_timeout?: number | null;
  } | null;
}

export default function SemanticViewEditModal({
  show,
  onHide,
  onSave,
  addDangerToast,
  addSuccessToast,
  semanticView,
}: SemanticViewEditModalProps) {
  const [description, setDescription] = useState<string>('');
  const [cacheTimeout, setCacheTimeout] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (semanticView) {
      setDescription(semanticView.description || '');
      setCacheTimeout(semanticView.cache_timeout ?? null);
    }
  }, [semanticView]);

  const handleSave = async () => {
    if (!semanticView) return;
    setSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/semantic_view/${semanticView.id}`,
        jsonPayload: {
          description: description || null,
          cache_timeout: cacheTimeout,
        },
      });
      addSuccessToast(t('Semantic view updated'));
      onSave();
      onHide();
    } catch {
      addDangerToast(t('An error occurred while saving the semantic view'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={t('Edit %s', semanticView?.table_name || '')}
      icon={<Icons.EditOutlined />}
      isEditMode
      width={MODAL_STANDARD_WIDTH}
      saveLoading={saving}
    >
      <ModalContent>
        <ModalFormField label={t('Description')}>
          <Input.TextArea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />
        </ModalFormField>
        <ModalFormField label={t('Cache timeout')}>
          <InputNumber
            value={cacheTimeout}
            onChange={value => setCacheTimeout(value as number | null)}
            min={0}
            placeholder={t('Duration in seconds')}
            style={{ width: '100%' }}
          />
        </ModalFormField>
      </ModalContent>
    </StandardModal>
  );
}
