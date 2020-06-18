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
import styled from '@superset-ui/style';
import { Modal as BaseModal } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import Button from './Button';

type Callback = (...args: any[]) => void;

interface Props {
  children: React.ReactNode;
  disableSave: boolean;
  onHide: Callback;
  onSave: Callback;
  show: boolean;
  title: string | React.ReactNode;
}

const StyledModal = styled(BaseModal)`
  .modal-content {
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }
`;

const StyledModalHeader = styled(BaseModal.Header)`
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  border-radius: ${({ theme }) => theme.borderRadius}px
    ${({ theme }) => theme.borderRadius}px 0 0;
  .close {
    color: ${({ theme }) => theme.colors.secondary.dark1};
    font-size: 32px;
    font-weight: ${({ theme }) => theme.typography.weights.light};
    margin-top: -3px;
  }
`;

const StyledModalBody = styled(BaseModal.Body)`
  padding: 18px 0 340px 18px;
  width: 65%;
`;

const StyledModalFooter = styled(BaseModal.Footer)`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: 16px;
  .btn + .btn {
    margin-left: 8px;
  }
`;

const Title = styled.div`
  color: ${({ theme }) => theme.colors.secondary.dark2};
  display: flex;
  justify-items: center;
`;

export default function Modal({
  children,
  disableSave,
  onHide,
  onSave,
  show,
  title,
}: Props) {
  return (
    <StyledModal show={show} onHide={onHide} bsSize="lg">
      <StyledModalHeader closeButton>
        <BaseModal.Title>
          <Title>{title}</Title>
        </BaseModal.Title>
      </StyledModalHeader>
      <StyledModalBody>{children}</StyledModalBody>
      <StyledModalFooter>
        <span className="float-right">
          <Button title={t('Cancel')} bsStyle="secondary" onClick={onHide} />
          <Button
            bsStyle="primary"
            disabled={disableSave}
            onClick={onSave}
            title={t('Add')}
          />
        </span>
      </StyledModalFooter>
    </StyledModal>
  );
}
