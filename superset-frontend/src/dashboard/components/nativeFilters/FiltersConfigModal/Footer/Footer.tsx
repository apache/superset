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
import React, { FC } from 'react';
import Button, { OnClickHandler } from 'src/components/Button';
import { t } from '@superset-ui/core';
import { CancelConfirmationAlert } from './CancelConfirmationAlert';

type FooterProps = {
  onCancel: OnClickHandler;
  handleSave: OnClickHandler;
  onConfirmCancel: OnClickHandler;
  onDismiss: OnClickHandler;
  saveAlertVisible: boolean;
  canSave?: boolean;
};

const Footer: FC<FooterProps> = ({
  canSave = true,
  onCancel,
  handleSave,
  onDismiss,
  onConfirmCancel,
  saveAlertVisible,
}) => {
  if (saveAlertVisible) {
    return (
      <CancelConfirmationAlert
        key="cancel-confirm"
        title={t('There are unsaved changes.')}
        onConfirm={onConfirmCancel}
        onDismiss={onDismiss}
      >
        {t(`Are you sure you want to cancel?`)}
      </CancelConfirmationAlert>
    );
  }

  return (
    <>
      <Button
        key="cancel"
        buttonStyle="secondary"
        data-test="native-filter-modal-cancel-button"
        onClick={onCancel}
      >
        {t('Cancel')}
      </Button>
      <Button
        disabled={!canSave}
        key="submit"
        buttonStyle="primary"
        onClick={handleSave}
        data-test="native-filter-modal-save-button"
      >
        {t('Save')}
      </Button>
    </>
  );
};

export default Footer;
