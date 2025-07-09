/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { useState, FC } from 'react';

import { t, SupersetClient } from '@superset-ui/core';
import Chart from 'src/types/Chart';
import { Dashboard } from 'src/pages/DashboardList';
import { Input, Modal, Button ,FormLabel, Col, Row } from '@superset-ui/core/components';

interface BulkCertifyModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  resourceName: 'chart' | 'dashboard';
  resourceLabel: string;
  selected: Chart[] | Dashboard[];
}

const BulkCertifyModal: FC<BulkCertifyModalProps> = ({
  show,
  selected = [],
  resourceName,
  resourceLabel,
  onHide,
  refreshData,
  addSuccessToast,
  addDangerToast,
}) => {
  const [certifiedBy, setCertifiedBy] = useState<string>('');
  const [certificationDetails, setCertificationDetails] = useState<string>('');

  const resourceLabelPlural = t(
    '%s',
    selected.length > 1 ? `${resourceLabel}s` : resourceLabel,
  );

  const onSave = async () => {
    if (!certifiedBy) {
      addDangerToast(t('Please enter who certified these items'));
      return;
    }

    Promise.all(
      selected.map(item => {
        const url = `/api/v1/${resourceName}/${item.id}`;
        const payload = {
          certified_by: certifiedBy,
          certification_details: certificationDetails,
        };

        return SupersetClient.put({
          url,
          headers: { 'Content-Type': 'application/json' },
          jsonPayload: payload,
        });
      }),
    )
      .then(() => {
        addSuccessToast(t('Successfully certified %s', resourceLabelPlural));
      })
      .catch(() => {
        addDangerToast(t('Failed to certify %s', resourceLabelPlural));
      });

    refreshData();
    onHide();
    setCertifiedBy('');
    setCertificationDetails('');
  };

  return (
    <Modal
      title={<h4>{t('Bulk certify %s', resourceLabelPlural)}</h4>}
      show={show}
      onHide={() => {
        setCertifiedBy('');
        setCertificationDetails('');
        onHide();
      }}
      footer={
        <div>
          <Button
            data-test="modal-cancel-certify-button"
            buttonStyle="secondary"
            onClick={onHide}
          >
            {t('Cancel')}
          </Button>
          <Button
            data-test="modal-save-certify-button"
            buttonStyle="primary"
            onClick={onSave}
            disabled={!certifiedBy}
          >
            {t('Certify')}
          </Button>
        </div>
      }
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <div className="bulk-certify-text">
            {t(
              'You are certifying %s %s',
              selected.length,
              resourceLabelPlural,
            )}
          </div>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <FormLabel>{t('Certified by')}</FormLabel>
          <Input
            value={certifiedBy}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setCertifiedBy(event.target.value)
            }
            placeholder={t('e.g., Data Governance Team')}
          />
        </Col>
        <Col xs={24} md={12}>
          <FormLabel>{t('Certification details')} (optional)</FormLabel>
          <Input.TextArea
            rows={1}
            value={certificationDetails}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCertificationDetails(event.target.value)
            }
            placeholder={t('Optional details about the certification')}
          />
        </Col>
      </Row>
    </Modal>
  );
};

export default BulkCertifyModal;
