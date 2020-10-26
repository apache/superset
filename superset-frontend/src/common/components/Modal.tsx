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
import React from 'react';
import { isNil } from 'lodash';
import { styled, SupersetThemeProps, t } from '@superset-ui/core';
import { Modal as BaseModal } from 'src/common/components';
import Button from 'src/components/Button';
import { css } from '@emotion/core';

interface ModalProps {
  className?: string;
  children: React.ReactNode;
  disablePrimaryButton?: boolean;
  onHide: () => void;
  onHandledPrimaryAction?: () => void;
  primaryButtonName?: string;
  primaryButtonType?: 'primary' | 'danger';
  show: boolean;
  title: React.ReactNode;
  width?: string;
  maxWidth?: string;
  responsive?: boolean;
  hideFooter?: boolean;
  centered?: boolean;
  footer?: React.ReactNode;
}

interface StyledModalProps extends SupersetThemeProps {
  maxWidth?: string;
  responsive?: boolean;
}

const StyledModal = styled(BaseModal)<StyledModalProps>`
  ${({ responsive, maxWidth }) =>
    responsive &&
    css`
      max-width: ${maxWidth ?? '900px'};
    `}

  .ant-modal-header {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    border-radius: ${({ theme }) => theme.borderRadius}px
      ${({ theme }) => theme.borderRadius}px 0 0;

    .ant-modal-title h4 {
      display: flex;
      margin: 0;
      align-items: center;
    }
  }

  .ant-modal-close-x {
    display: flex;
    align-items: center;

    .close {
      flex: 1 1 auto;
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
      color: ${({ theme }) => theme.colors.secondary.dark1};
      font-size: 32px;
      font-weight: ${({ theme }) => theme.typography.weights.light};
    }
  }

  .ant-modal-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .ant-modal-footer {
    border-top: ${({ theme }) => theme.gridUnit / 4}px solid
      ${({ theme }) => theme.colors.grayscale.light2};
    padding: ${({ theme }) => theme.gridUnit * 4}px;

    .btn {
      font-size: 12px;
      text-transform: uppercase;
    }

    .btn + .btn {
      margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }

  // styling for Tabs component
  .ant-tabs {
    margin-top: -${({ theme }) => theme.gridUnit * 4}px;
  }
`;

export default function Modal({
  children,
  disablePrimaryButton = false,
  onHide,
  onHandledPrimaryAction,
  primaryButtonName = t('OK'),
  primaryButtonType = 'primary',
  show,
  title,
  width,
  maxWidth,
  responsive = false,
  centered,
  footer,
  hideFooter,
  ...rest
}: ModalProps) {
  const modalFooter = isNil(footer)
    ? [
        <Button key="back" onClick={onHide} cta>
          {t('Cancel')}
        </Button>,
        <Button
          key="submit"
          buttonStyle={primaryButtonType}
          disabled={disablePrimaryButton}
          onClick={onHandledPrimaryAction}
          cta
        >
          {primaryButtonName}
        </Button>,
      ]
    : footer;

  const modalWidth = width || responsive ? 'calc(100vw - 24px)' : '600px';
  return (
    <StyledModal
      centered={!!centered}
      onOk={onHandledPrimaryAction}
      onCancel={onHide}
      width={modalWidth}
      maxWidth={maxWidth}
      responsive={responsive}
      visible={show}
      title={title}
      closeIcon={
        <span className="close" aria-hidden="true">
          ×
        </span>
      }
      footer={!hideFooter ? modalFooter : null}
      {...rest}
    >
      {children}
    </StyledModal>
  );
}
