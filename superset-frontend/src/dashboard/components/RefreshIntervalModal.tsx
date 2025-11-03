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
import { useState } from 'react';
import { t, styled } from '@superset-ui/core';
import { Alert, Form } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import {
  RefreshFrequencySelect,
  getRefreshWarningMessage,
} from './RefreshFrequency/RefreshFrequencySelect';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

interface RefreshIntervalModalProps {
  show: boolean;
  onHide: () => void;
  refreshFrequency: number;
  onChange: (refreshLimit: number, editMode: boolean) => void;
  editMode: boolean;
  refreshLimit?: number;
  refreshWarning?: string;
  addSuccessToast: (msg: string) => void;
}

/**
 * Simple refresh interval modal for View Mode (session-only refresh)
 * Separate from PropertiesModal to provide focused UX for temporary refresh
 */
const RefreshIntervalModal = ({
  show,
  onHide,
  refreshFrequency: initialFrequency,
  onChange,
  editMode,
  refreshLimit = 0,
  refreshWarning,
  addSuccessToast,
}: RefreshIntervalModalProps) => {
  const [refreshFrequency, setRefreshFrequency] = useState(initialFrequency);

  const handleFrequencyChange = (value: number) => {
    setRefreshFrequency(value);
  };

  const handleSave = () => {
    onChange(refreshFrequency, editMode);
    onHide();
    addSuccessToast(
      editMode
        ? t('Refresh interval saved')
        : t('Refresh interval set for this session'),
    );
  };

  const handleCancel = () => {
    setRefreshFrequency(initialFrequency);
    onHide();
  };

  const warningMessage = getRefreshWarningMessage(
    refreshFrequency,
    refreshLimit,
    refreshWarning,
  );

  return (
    <StandardModal
      show={show}
      onHide={handleCancel}
      onSave={handleSave}
      title={t('Refresh interval')}
      width={400}
      saveText={editMode ? t('Save') : t('Save for this session')}
    >
      <ModalContent>
        <Form layout="vertical">
          <Form.Item
            label={t('Refresh frequency')}
            help={
              editMode
                ? t('Set the automatic refresh frequency for this dashboard.')
                : t('Set refresh frequency for current session only.')
            }
          >
            <RefreshFrequencySelect
              value={refreshFrequency}
              onChange={handleFrequencyChange}
            />
          </Form.Item>
        </Form>

        {warningMessage && (
          <Alert
            type="warning"
            message={warningMessage}
            description={t('Are you sure you want to proceed?')}
            showIcon
          />
        )}
      </ModalContent>
    </StandardModal>
  );
};

export default RefreshIntervalModal;
