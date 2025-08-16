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
import { Alert, Input } from '@superset-ui/core/components';
import { StandardModal, ModalFormField } from 'src/components/Modal';
import {
  RefreshFrequencySelect,
  getRefreshWarningMessage,
} from './RefreshFrequency/RefreshFrequencySelect';

const StyledDiv = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-top: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const CustomInputContainer = styled.div`
  flex: 1;
  text-align: center;
`;

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
  const [customMode, setCustomMode] = useState(false);
  const [customHour, setCustomHour] = useState(0);
  const [customMin, setCustomMin] = useState(0);
  const [customSec, setCustomSec] = useState(0);

  const handleFrequencyChange = (value: number) => {
    if (value === -1) {
      setCustomMode(true);
      setCustomHour(0);
      setCustomMin(0);
      setCustomSec(0);
    } else {
      setCustomMode(false);
      setRefreshFrequency(value);
    }
  };

  const handleSave = () => {
    let finalFrequency = refreshFrequency;

    if (customMode) {
      // Convert custom time to seconds
      finalFrequency = customHour * 3600 + customMin * 60 + customSec;

      if (finalFrequency <= 0) {
        addSuccessToast(t('Please enter a positive time value'));
        return;
      }
    }

    onChange(finalFrequency, editMode);
    onHide();
    addSuccessToast(
      editMode
        ? t('Refresh interval saved')
        : t('Refresh interval set for this session'),
    );
  };

  const handleCancel = () => {
    setRefreshFrequency(initialFrequency);
    setCustomMode(false);
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
        <ModalFormField
          label={t('Refresh frequency')}
          helperText={
            editMode
              ? t('Set the automatic refresh frequency for this dashboard.')
              : t('Set refresh frequency for current session only.')
          }
        >
          <RefreshFrequencySelect
            value={customMode ? -1 : refreshFrequency}
            onChange={handleFrequencyChange}
            includeCustomOption
          />
        </ModalFormField>

        {customMode && (
          <ModalFormField
            label={t('Custom refresh interval')}
            helperText={t(
              'Enter hours, minutes, and seconds for a custom refresh interval.',
            )}
          >
            <StyledDiv>
              <CustomInputContainer>
                <div>{t('Hours')}</div>
                <Input
                  type="number"
                  min="0"
                  value={customHour}
                  onChange={e => setCustomHour(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </CustomInputContainer>
              <CustomInputContainer>
                <div>{t('Minutes')}</div>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={customMin}
                  onChange={e => setCustomMin(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </CustomInputContainer>
              <CustomInputContainer>
                <div>{t('Seconds')}</div>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={customSec}
                  onChange={e => setCustomSec(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </CustomInputContainer>
            </StyledDiv>
          </ModalFormField>
        )}

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
