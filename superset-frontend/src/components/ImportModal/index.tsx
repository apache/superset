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
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { styled, t } from '@superset-ui/core';

import Icon from 'src//components/Icon';
import Modal from 'src/common/components/Modal';
import { useImportResource } from 'src/views/CRUD/hooks';

export const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledInputContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

  &.extra-container {
    padding-top: 8px;
  }

  .helper {
    display: block;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
    text-align: left;

    .required {
      margin-left: ${({ theme }) => theme.gridUnit / 2}px;
      color: ${({ theme }) => theme.colors.error.base};
    }
  }

  .input-container {
    display: flex;
    align-items: center;

    label {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }

    i {
      margin: 0 ${({ theme }) => theme.gridUnit}px;
    }
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='name'] {
      flex: 0 1 auto;
      width: 40%;
    }

    &[name='sqlalchemy_uri'] {
      margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    }
  }
`;

export interface ImportModelsModalProps {
  resourceName: string;
  resourceLabel: string;
  icon: React.ReactNode;
  passwordsNeededMessage: string;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onModelImport: () => void;
  show: boolean;
  onHide: () => void;
  passwordFields?: string[];
  setPasswordFields?: (passwordFields: string[]) => void;
}

const ImportModelsModal: FunctionComponent<ImportModelsModalProps> = ({
  resourceName,
  resourceLabel,
  icon,
  passwordsNeededMessage,
  addDangerToast,
  addSuccessToast,
  onModelImport,
  show,
  onHide,
  passwordFields = [],
  setPasswordFields = () => {},
}) => {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearModal = () => {
    setUploadFile(null);
    setPasswordFields([]);
    setPasswords({});
    if (fileInputRef && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleErrorMsg = (msg: string) => {
    clearModal();
    addDangerToast(msg);
  };

  const {
    state: { passwordsNeeded },
    importResource,
  } = useImportResource<any>(resourceName, resourceLabel, handleErrorMsg);

  useEffect(() => {
    setPasswordFields(passwordsNeeded);
  }, [passwordsNeeded, setPasswordFields]);

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onUpload = () => {
    if (uploadFile === null) {
      return;
    }

    importResource(uploadFile, passwords).then(result => {
      if (result) {
        addSuccessToast(t('The import was successful'));
        clearModal();
        onModelImport();
      }
    });
  };

  const changeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target as HTMLInputElement;
    setUploadFile((files && files[0]) || null);
  };

  const renderPasswordFields = () => {
    if (passwordFields.length === 0) {
      return null;
    }

    return (
      <>
        <h5>Database passwords</h5>
        <StyledInputContainer>
          <div className="helper">{passwordsNeededMessage}</div>
        </StyledInputContainer>
        {passwordFields.map(fileName => (
          <StyledInputContainer key={`password-for-${fileName}`}>
            <div className="control-label">
              {fileName}
              <span className="required">*</span>
            </div>
            <input
              name={`password-${fileName}`}
              autoComplete={`password-${fileName}`}
              type="password"
              value={passwords[fileName]}
              onChange={event =>
                setPasswords({ ...passwords, [fileName]: event.target.value })
              }
            />
          </StyledInputContainer>
        ))}
      </>
    );
  };

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      name="model"
      className="import-model-modal"
      disablePrimaryButton={uploadFile === null}
      onHandledPrimaryAction={onUpload}
      onHide={hide}
      primaryButtonName={t('Import')}
      width="750px"
      show={show}
      title={
        <h4>
          {icon}
          {t('Import %s', resourceLabel)}
        </h4>
      }
    >
      <StyledInputContainer>
        <div className="control-label">
          <label htmlFor="modelFile">
            {t('File')}
            <span className="required">*</span>
          </label>
        </div>
        <input
          ref={fileInputRef}
          data-test="model-file-input"
          name="modelFile"
          id="modelFile"
          type="file"
          accept=".yaml,.json,.yml,.zip"
          onChange={changeFile}
        />
      </StyledInputContainer>
      {renderPasswordFields()}
    </Modal>
  );
};

export default ImportModelsModal;
