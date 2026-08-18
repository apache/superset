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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { FormLabel } from '../Form';
import { Input, InputRef } from '../Input';
import { Modal } from '../Modal';
import type { DeleteModalProps } from './types';

const StyledDiv = styled.div`
  padding-top: 8px;
  width: 50%;
  label {
    color: ${({ theme }) => theme.colorTextLabel};
  }
`;

export function DeleteModal({
  description,
  onConfirm,
  onHide,
  open,
  title,
  name,
  recoverable = false,
}: DeleteModalProps) {
  // Recoverable (archive) deletes drop the "type DELETE to confirm" step;
  // a permanent delete keeps it.
  const showConfirmationInput = !recoverable;
  const [disableChange, setDisableChange] = useState(true);
  const [confirmation, setConfirmation] = useState<string>('');
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Re-arm the gate alongside clearing the text: resetting only the string
  // leaves disableChange=false behind, so a user who typed DELETE, cancelled,
  // and reopened would face an enabled Delete button over an empty input.
  const hide = () => {
    setConfirmation('');
    setDisableChange(true);
    onHide();
  };

  const confirm = () => {
    setConfirmation('');
    setDisableChange(true);
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
      disablePrimaryButton={showConfirmationInput ? disableChange : false}
      onHide={hide}
      onHandledPrimaryAction={confirm}
      primaryButtonName={recoverable ? t('Archive') : t('Delete')}
      primaryButtonStyle={recoverable ? 'primary' : 'danger'}
      show={open}
      name={name}
      title={title}
      centered
    >
      {description}
      {showConfirmationInput && (
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
            ref={inputRef}
          />
        </StyledDiv>
      )}
    </Modal>
  );
}

export type { DeleteModalProps };
