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
import { styled, t } from '@superset-ui/core';
import { Button, Modal, Checkbox } from '@superset-ui/core/components';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding: 24px;
  }
`;

const WarningContent = styled.div`
  margin: 16px 0;
  font-size: 14px;
  line-height: 1.5;
`;

const DetailsSection = styled.div`
  margin: 16px 0;
  padding: 12px;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  border-radius: 4px;
  font-size: 12px;
`;

const CheckboxWrapper = styled.div`
  margin: 16px 0;
`;

interface CostWarningModalProps {
  visible: boolean;
  onHide: () => void;
  onProceed: () => void;
  warningMessage: string | null;
  thresholdInfo?: {
    bytes_threshold?: number;
    estimated_bytes?: number;
    cost_threshold?: number;
    estimated_cost?: number;
  };
}

export default function CostWarningModal({
  visible,
  onHide,
  onProceed,
  warningMessage,
  thresholdInfo,
}: CostWarningModalProps) {
  const [proceedAnyway, setProceedAnyway] = useState(false);

  const handleProceed = () => {
    if (proceedAnyway) {
      onProceed();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes < 1024 ** 5) return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
    return `${(bytes / 1024 ** 5).toFixed(1)} PB`;
  };

  const renderThresholdDetails = () => {
    if (!thresholdInfo) return null;

    const details = [];

    if (thresholdInfo.bytes_threshold && thresholdInfo.estimated_bytes) {
      details.push(
        <div key="bytes">
          <strong>{t('Data to scan:')}</strong> {formatBytes(thresholdInfo.estimated_bytes)}
          <br />
          <strong>{t('Threshold:')}</strong> {formatBytes(thresholdInfo.bytes_threshold)}
        </div>
      );
    }

    if (thresholdInfo.cost_threshold && thresholdInfo.estimated_cost) {
      details.push(
        <div key="cost">
          <strong>{t('Estimated cost:')}</strong> {thresholdInfo.estimated_cost}
          <br />
          <strong>{t('Cost threshold:')}</strong> {thresholdInfo.cost_threshold}
        </div>
      );
    }

    return details.length > 0 ? (
      <DetailsSection>
        <div style={{ marginBottom: '8px' }}>
          <strong>{t('Threshold Details:')}</strong>
        </div>
        {details.map((detail, index) => (
          <div key={index} style={{ marginBottom: index < details.length - 1 ? '8px' : '0' }}>
            {detail}
          </div>
        ))}
      </DetailsSection>
    ) : null;
  };

  return (
    <StyledModal
      show={visible}
      onHide={onHide}
      title={
        <ModalTitleWithIcon
          icon="exclamation-triangle"
          title={t('Query Cost Warning')}
        />
      }
      footer={
        <>
          <Button onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            onClick={handleProceed}
            disabled={!proceedAnyway}
          >
            {t('Run Query Anyway')}
          </Button>
        </>
      }
    >
      <WarningContent>
        {warningMessage || t('This query may be expensive to run.')}
      </WarningContent>

      {renderThresholdDetails()}

      <CheckboxWrapper>
        <Checkbox
          checked={proceedAnyway}
          onChange={(e) => setProceedAnyway(e.target.checked)}
        >
          {t('I understand the cost implications and want to proceed anyway')}
        </Checkbox>
      </CheckboxWrapper>
    </StyledModal>
  );
}
