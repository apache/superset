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
import { ReactNode } from 'react';
import { styled, t } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';

interface StandardModalProps {
  width?: number;
  title: string;
  icon?: ReactNode;
  show: boolean;
  onHide: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveText?: string;
  cancelText?: string;
  errorTooltip?: ReactNode;
  children: ReactNode;
  isEditMode?: boolean;
  centered?: boolean;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
  wrapProps?: object;
}

// Standard modal widths
export const MODAL_STANDARD_WIDTH = 500;
export const MODAL_MEDIUM_WIDTH = 600;
export const MODAL_LARGE_WIDTH = 900;

const StyledModal = styled(Modal)`
  .ant-modal-body {
    max-height: 60vh;
    height: auto;
    overflow-y: auto;
    padding: 0;
  }

  .ant-modal-header {
    padding: ${({ theme }) => theme.sizeUnit * 3}px
      ${({ theme }) => theme.sizeUnit * 4}px
      ${({ theme }) => theme.sizeUnit * 3}px;
    margin-bottom: 0;
    border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
  }

  .ant-modal-footer {
    height: ${({ theme }) => theme.sizeUnit * 16.25}px;
  }

  .control-label {
    margin-top: ${({ theme }) => theme.sizeUnit}px;
  }

  /* Remove top margin from collapse component */
  .ant-collapse {
    border: none;

    > .ant-collapse-item:first-child {
      border-top: none;
    }

    /* Remove margin from collapse headers */
    .ant-collapse-header {
      padding-bottom: 0 !important;

      /* Remove margin from the CollapseLabelInModal component */
      > div {
        margin-bottom: 0;
      }
    }
  }

  /* Ensure collapse sections have proper padding */
  .ant-collapse-content-box {
    padding: ${({ theme }) => theme.sizeUnit * 4}px;
  }
`;

export function StandardModal({
  width = MODAL_STANDARD_WIDTH,
  title,
  icon,
  show,
  onHide,
  onSave,
  saveDisabled = false,
  saveText,
  cancelText,
  errorTooltip,
  children,
  isEditMode = false,
  centered = true,
  destroyOnClose = true,
  maskClosable = false,
  wrapProps,
}: StandardModalProps) {
  const primaryButtonName = saveText || (isEditMode ? t('Save') : t('Add'));

  return (
    <StyledModal
      disablePrimaryButton={saveDisabled}
      primaryTooltipMessage={errorTooltip}
      onHandledPrimaryAction={onSave}
      onHide={onHide}
      primaryButtonName={primaryButtonName}
      show={show}
      width={`${width}px`}
      wrapProps={wrapProps}
      title={
        icon ? (
          <ModalTitleWithIcon
            isEditMode={isEditMode}
            title={title}
            data-test="standard-modal-title"
          />
        ) : (
          title
        )
      }
    >
      {children}
    </StyledModal>
  );
}
