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
import { t, styled } from '@superset-ui/core';
import React, { useState } from 'react';
import { FormGroup, FormControl, FormControlProps } from 'react-bootstrap';
import Modal from 'src/components/Modal';
import FormLabel from 'src/components/FormLabel';

const StyleFormGroup = styled(FormGroup)`
  padding-top: 8px;
  width: 50%;
  label {
    color: ${({ theme }) => theme.colors.grayscale.light1};
    text-transform: uppercase;
  }
`;

const DescriptionContainer = styled.div`
  line-height: 40px;
  padding-top: 16px;
`;

interface DeleteModalProps {
  description: React.ReactNode;
  onConfirm: () => void;
  onHide: () => void;
  open: boolean;
  title: React.ReactNode;
}

export default function DeleteModal({
  description,
  onConfirm,
  onHide,
  open,
  title,
}: DeleteModalProps) {
  const [disableChange, setDisableChange] = useState(true);

  return (
    <Modal
      disablePrimaryButton={disableChange}
      onHide={onHide}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={t('delete')}
      primaryButtonType="danger"
      show={open}
      title={title}
    >
      <DescriptionContainer>{description}</DescriptionContainer>
      <StyleFormGroup>
        <FormLabel htmlFor="delete">{t('type "delete" to confirm')}</FormLabel>
        <FormControl
          id="delete"
          type="text"
          bsSize="sm"
          onChange={(
            event: React.FormEvent<FormControl & FormControlProps>,
          ) => {
            const targetValue = (event.currentTarget?.value as string) ?? '';
            setDisableChange(targetValue.toUpperCase() !== 'DELETE');
          }}
        />
      </StyleFormGroup>
    </Modal>
  );
}
