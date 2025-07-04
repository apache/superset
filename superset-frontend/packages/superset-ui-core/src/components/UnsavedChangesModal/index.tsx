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
import { t, styled, css } from '@superset-ui/core';
import { Icons, Modal, Typography } from '@superset-ui/core/components';
import { Button } from '@superset-ui/core/components/Button';
import type { FC, ReactElement } from 'react';

const StyledModalTitle = styled(Typography.Title)`
  && {
    font-weight: 600;
    margin: 0;
  }
`;

const StyledModalBody = styled(Typography.Text)`
  ${({ theme }) => css`
    padding: 0 ${theme.sizeUnit * 2}px;

    && {
      margin: 0;
    }
  `}
`;

const StyledDiscardBtn = styled(Button)`
  ${({ theme }) => css`
    min-width: ${theme.sizeUnit * 22}px;
    height: ${theme.sizeUnit * 8}px;
  `}
`;

const StyledSaveBtn = styled(Button)`
  ${({ theme }) => css`
    min-width: ${theme.sizeUnit * 17}px;
    height: ${theme.sizeUnit * 8}px;
    span > :first-of-type {
      margin-right: 0;
    }
  `}
`;

const StyledWarningIcon = styled(Icons.WarningOutlined)`
  ${({ theme }) => css`
    color: ${theme.colorWarning};
    margin-right: ${theme.sizeUnit * 4}px;
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

export const UnsavedChangesModal: FC<UnsavedChangesModalProps> = ({
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
    title={
      <div
        css={css`
          align-items: center;
          display: flex;
        `}
      >
        <StyledWarningIcon iconSize="xl" />
        <StyledModalTitle type="secondary" level={5}>
          {title}
        </StyledModalTitle>
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
        >
          {t('Discard')}
        </StyledDiscardBtn>
        <StyledSaveBtn
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
    <StyledModalBody type="secondary">{body}</StyledModalBody>
  </Modal>
);
