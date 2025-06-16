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
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { t, styled, css } from '@superset-ui/core';
import type { FC, ReactElement } from 'react';
import { Icons } from 'src/components/Icons';

const StyledModalTitle = styled.h1`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.l}px;
    font-weight: ${theme.typography.weights.bold};
    margin: 0;
  `}
`;

const StyledModalBody = styled.p`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.m}px;
    margin: 0;
    padding: 0 ${theme.gridUnit * 2}px;
  `}
`;

const StyledDiscardBtn = styled(Button)`
  ${({ theme }) => css`
    min-width: ${theme.gridUnit * 22}px;
    height: ${theme.gridUnit * 8}px;
  `}
`;

const StyledSaveBtn = styled(Button)`
  ${({ theme }) => css`
    min-width: ${theme.gridUnit * 17}px;
    height: ${theme.gridUnit * 8}px;
    span > :first-of-type {
      margin-right: 0;
    }
  `}
`;

const StyledWarningIcon = styled(Icons.WarningOutlined)`
  ${({ theme }) => css`
    color: ${theme.colors.warning.base};
    margin-right: ${theme.gridUnit * 2}px;
  `}
`;

export type UnsavedChangesModalProps = {
  showModal: boolean;
  onHide: () => void;
  handleSave: () => void;
  onConfirmNavigation: () => void;
  title?: string;
  body?: string;
};

const UnsavedChangesModal: FC<UnsavedChangesModalProps> = ({
  showModal,
  onHide,
  handleSave,
  onConfirmNavigation,
  title = 'Unsaved Changes',
  body = "If you don't save, changes will be lost.",
}: UnsavedChangesModalProps): ReactElement => (
  <Modal
    centered
    responsive
    onHide={onHide}
    show={showModal}
    width="444px"
    wrapProps={{ 'data-test': 'unsaved-changes-modal' }}
    title={
      <div
        css={css`
          align-items: center;
          display: flex;
        `}
      >
        <StyledWarningIcon />
        <StyledModalTitle>{t(title)}</StyledModalTitle>
      </div>
    }
    footer={
      <div
        css={css`
          display: flex;
          justify-content: flex-end;
          width: 100%;
        `}
      >
        <StyledDiscardBtn
          htmlType="button"
          buttonSize="small"
          onClick={onConfirmNavigation}
          data-test="unsaved-modal-discard-button"
        >
          {t('Discard')}
        </StyledDiscardBtn>
        <StyledSaveBtn
          data-test="unsaved-confirm-save-button"
          htmlType="button"
          buttonSize="small"
          buttonStyle="primary"
          onClick={handleSave}
        >
          {t('Save')}
        </StyledSaveBtn>
      </div>
    }
  >
    <StyledModalBody>{t(body)}</StyledModalBody>
  </Modal>
);

export default UnsavedChangesModal;
