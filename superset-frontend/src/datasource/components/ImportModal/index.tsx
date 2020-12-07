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
import { t } from '@superset-ui/core';

import Modal from 'src/common/components/Modal';
import {
  StyledIcon,
  StyledInputContainer,
} from 'src/views/CRUD/data/database/DatabaseModal';
import { useImportResource } from 'src/views/CRUD/hooks';
import { DatasetObject } from 'src/views/CRUD/data/dataset/types';

export interface ImportDatasetModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatasetImport: () => void;
  show: boolean;
  onHide: () => void;
  passwordFields?: string[];
  setPasswordFields?: (passwordFields: string[]) => void;
}

const ImportDatasetModal: FunctionComponent<ImportDatasetModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatasetImport,
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
  } = useImportResource<DatasetObject>('dataset', t('dataset'), handleErrorMsg);

  useEffect(() => {
    setPasswordFields(passwordsNeeded);
  }, [passwordsNeeded]);

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
        addSuccessToast(t('The datasets have been imported'));
        clearModal();
        onDatasetImport();
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
          <div className="helper">
            {t(
              'The passwords for the databases below are needed in order to ' +
                'import them together with the datasets. Please note that the ' +
                '"Secure Extra" and "Certificate" sections of ' +
                'the database configuration are not present in export files, and ' +
                'should be added manually after the import if they are needed.',
            )}
          </div>
        </StyledInputContainer>
        {passwordFields.map(fileName => (
          <StyledInputContainer key={`password-for-${fileName}`}>
            <div className="control-label">
              {fileName}
              <span className="required">*</span>
            </div>
            <input
              name={`password-${fileName}`}
              autoComplete="off"
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
      name="dataset"
      className="dataset-modal"
      disablePrimaryButton={uploadFile === null}
      onHandledPrimaryAction={onUpload}
      onHide={hide}
      primaryButtonName={t('Import')}
      width="750px"
      show={show}
      title={
        <h4>
          <StyledIcon name="table" />
          {t('Import Dataset')}
        </h4>
      }
    >
      <StyledInputContainer>
        <div className="control-label">
          <label htmlFor="datasetFile">
            {t('File')}
            <span className="required">*</span>
          </label>
        </div>
        <input
          ref={fileInputRef}
          data-test="dataset-file-input"
          name="datasetFile"
          id="datasetFile"
          type="file"
          accept=".yaml,.json,.yml,.zip"
          onChange={changeFile}
        />
      </StyledInputContainer>
      {renderPasswordFields()}
    </Modal>
  );
};

export default ImportDatasetModal;
