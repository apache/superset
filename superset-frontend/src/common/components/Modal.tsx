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
import { styled, t } from '@superset-ui/core';
import { Modal as BaseModal } from 'src/common/components';
import Button from 'src/components/Button';

interface ModalProps {
  className?: string;
  children: React.ReactNode;
  disablePrimaryButton?: boolean;
  onHide: () => void;
  onHandledPrimaryAction: () => void;
  primaryButtonName: string;
  primaryButtonType?: 'primary' | 'danger';
  show: boolean;
  title: React.ReactNode;
  width?: string;
  centered?: boolean;
}

const StyledModal = styled(BaseModal)`
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
      margin-bottom: 3px;
      color: ${({ theme }) => theme.colors.secondary.dark1};
      font-size: 32px;
      font-weight: ${({ theme }) => theme.typography.weights.light};
    }
  }

  .ant-modal-body {
    padding: 18px;
  }

  .ant-modal-footer {
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    padding: 16px;

    .btn {
      font-size: 12px;
      text-transform: uppercase;
    }

    .btn + .btn {
      margin-left: 8px;
    }
  }
`;

export default function Modal({
  children,
  disablePrimaryButton = false,
  onHide,
  onHandledPrimaryAction,
  primaryButtonName,
  primaryButtonType = 'primary',
  show,
  title,
  width,
  centered,
  ...rest
}: ModalProps) {
  return (
    <StyledModal
      centered={!!centered}
      onOk={onHandledPrimaryAction}
      onCancel={onHide}
      width={width || '600px'}
      visible={show}
      title={title}
      closeIcon={
        <span className="close" aria-hidden="true">
          ×
        </span>
      }
      footer={[
        <Button key="back" onClick={onHide}>
          {t('Cancel')}
        </Button>,
        <Button
          key="submit"
          disabled={disablePrimaryButton}
          onClick={onHandledPrimaryAction}
        >
          {primaryButtonName}
        </Button>,
      ]}
      {...rest}
    >
      {children}
    </StyledModal>
  );
}
