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
import React, { FunctionComponent } from 'react';
import { styled, t } from '@superset-ui/core';

import Modal from 'src/components/Modal';
import Button from 'src/components/Button';

const StyledFilterBoxMigrationModal = styled(Modal)`
  .modal-content {
    height: 900px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .modal-header {
    flex: 0 1 auto;
  }

  .modal-body {
    flex: 1 1 auto;
    overflow: auto;
  }

  .modal-footer {
    flex: 0 1 auto;
  }

  .ant-modal-body {
    overflow: auto;
  }
`;

interface FilterBoxMigrationModalProps {
  onHide: () => void;
  onClickReview: () => void;
  onClickSnooze: () => void;
  show: boolean;
  hideFooter: boolean;
}

const FilterBoxMigrationModal: FunctionComponent<FilterBoxMigrationModalProps> =
  ({ onClickReview, onClickSnooze, onHide, show, hideFooter = false }) => (
    <StyledFilterBoxMigrationModal
      show={show}
      onHide={onHide}
      title={t('Ready to review filters in this dashboard?')}
      hideFooter={hideFooter}
      footer={
        <>
          <Button buttonSize="small" onClick={onClickSnooze}>
            {t('Remind me in 24 hours')}
          </Button>
          <Button buttonSize="small" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button
            buttonSize="small"
            buttonStyle="primary"
            onClick={onClickReview}
          >
            {t('Start Review')}
          </Button>
        </>
      }
      responsive
    >
      <div>
        {t(
          'filter_box will be deprecated ' +
            'in a future version of Superset. ' +
            'Please replace filter_box by dashboard filter components.',
        )}
      </div>
    </StyledFilterBoxMigrationModal>
  );

export default FilterBoxMigrationModal;
