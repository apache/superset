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
import { useState, ReactNode, ChangeEvent } from 'react';
import { Input } from 'src/components/Input';
import Modal from 'src/components/Modal';
import { FormLabel } from 'src/components/Form';

const StyledDiv = styled.div`
  padding-top: 8px;
  width: 50%;
  label {
    color: ${({ theme }) => theme.colors.grayscale.base};
    text-transform: uppercase;
  }
`;

const DescriptionContainer = styled.div`
  line-height: ${({ theme }) => theme.gridUnit * 4}px;
  padding-top: 16px;
`;

interface DeleteModalProps {
  description: ReactNode;
  onConfirm: () => void;
  onHide: () => void;
  open: boolean;
  title: ReactNode;
}

export default function DeleteModal({
  description,
  onConfirm,
  onHide,
  open,
  title,
}: DeleteModalProps) {
  const [disableChange, setDisableChange] = useState(true);
  const [confirmation, setConfirmation] = useState<string>('');

  const hide = () => {
    setConfirmation('');
    onHide();
  };

  const confirm = () => {
    setConfirmation('');
    onConfirm();
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const targetValue = event.target.value ?? '';
    setDisableChange(targetValue.toUpperCase() !== t('DELETE'));
    setConfirmation(targetValue);
  };

  const onPressEnter = () => {
    if (!disableChange) {
      confirm();
    }
  };

  return (
    <Modal
      disablePrimaryButton={disableChange}
      onHide={hide}
      onHandledPrimaryAction={confirm}
      primaryButtonName={t('Delete')}
      primaryButtonType="danger"
      show={open}
      title={title}
    >
      <DescriptionContainer>{description}</DescriptionContainer>
      <StyledDiv>
        <FormLabel htmlFor="delete">
          {t('Type "%s" to confirm', t('DELETE'))}
        </FormLabel>
        <Input
          data-test="delete-modal-input"
          type="text"
          id="delete"
          autoComplete="off"
          value={confirmation}
          onChange={onChange}
          onPressEnter={onPressEnter}
        />
      </StyledDiv>
    </Modal>
  );
}
