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
import { Modal as BaseModal } from 'react-bootstrap';
import Button from 'src/components/Button';

interface ModalProps {
  children: React.ReactNode;
  disablePrimaryButton?: boolean;
  onHide: () => void;
  onHandledPrimaryAction: () => void;
  primaryButtonName: string;
  primaryButtonType?: 'primary' | 'danger';
  show: boolean;
  title: React.ReactNode;
  bsSize?: 'small' | 'large'; // react-bootstrap also supports 'sm', 'lg' but we're keeping it simple.
}

const StyledModal = styled(BaseModal)`
  .modal-header {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
    border-radius: ${({ theme }) => theme.borderRadius}px
      ${({ theme }) => theme.borderRadius}px 0 0;
    .close {
      color: ${({ theme }) => theme.colors.secondary.dark1};
      font-size: 32px;
      font-weight: ${({ theme }) => theme.typography.weights.light};
      margin-top: -3px;
    }
  }

  .modal-body {
    padding: 18px;
  }

  .modal-footer {
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    padding: 16px;
  }
`;

const Title = styled.div`
  color: ${({ theme }) => theme.colors.secondary.dark2};
  display: flex;
  justify-items: center;
`;

export default function Modal({
  children,
  disablePrimaryButton = false,
  onHandledPrimaryAction,
  onHide,
  primaryButtonName,
  primaryButtonType = 'primary',
  show,
  title,
}: ModalProps) {
  return (
    <StyledModal show={show} onHide={onHide} data-test={`${title}-modal`}>
      <BaseModal.Header data-test={`${title}-modal-header`} closeButton>
        <BaseModal.Title>
          <Title>{title}</Title>
        </BaseModal.Title>
      </BaseModal.Header>
      <BaseModal.Body data-test={`${title}-modal-body`}>
        {children}
      </BaseModal.Body>
      <BaseModal.Footer data-test={`${title}-modal-footer`}>
        <span className="float-right">
          <Button data-test="modal-cancel-button" onClick={onHide} cta>
            {t('Cancel')}
          </Button>
          <Button
            data-test="modal-delete-button"
            buttonStyle={primaryButtonType}
            disabled={disablePrimaryButton}
            onClick={onHandledPrimaryAction}
            cta
          >
            {primaryButtonName}
          </Button>
        </span>
      </BaseModal.Footer>
    </StyledModal>
  );
}
