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
import { FunctionComponent, useEffect, useState, ChangeEvent } from 'react';

import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface';
import { styled, t } from '@superset-ui/core';

import Button from 'src/components/Button';
import Modal from 'src/components/Modal';
import { Upload } from 'src/components';
import { useImportResource } from 'src/views/CRUD/hooks';
import { ImportResourceName } from 'src/views/CRUD/types';
import ErrorAlert from './ErrorAlert';

const HelperMessage = styled.div`
  display: block;
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
`;

const StyledInputContainer = styled.div`
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;

  & > div {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }

  &.extra-container {
    padding-top: 8px;
  }

  .confirm-overwrite {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
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
  resourceName: ImportResourceName;
  resourceLabel: string;
  passwordsNeededMessage: string;
  confirmOverwriteMessage: string;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onModelImport: () => void;
  show: boolean;
  onHide: () => void;
  passwordFields?: string[];
  setPasswordFields?: (passwordFields: string[]) => void;
  sshTunnelPasswordFields?: string[];
  setSSHTunnelPasswordFields?: (sshTunnelPasswordFields: string[]) => void;
  sshTunnelPrivateKeyFields?: string[];
  setSSHTunnelPrivateKeyFields?: (sshTunnelPrivateKeyFields: string[]) => void;
  sshTunnelPrivateKeyPasswordFields?: string[];
  setSSHTunnelPrivateKeyPasswordFields?: (
    sshTunnelPrivateKeyPasswordFields: string[],
  ) => void;
}

const ImportModelsModal: FunctionComponent<ImportModelsModalProps> = ({
  resourceName,
  resourceLabel,
  passwordsNeededMessage,
  confirmOverwriteMessage,
  onModelImport,
  show,
  onHide,
  passwordFields = [],
  setPasswordFields = () => {},
  sshTunnelPasswordFields = [],
  setSSHTunnelPasswordFields = () => {},
  sshTunnelPrivateKeyFields = [],
  setSSHTunnelPrivateKeyFields = () => {},
  sshTunnelPrivateKeyPasswordFields = [],
  setSSHTunnelPrivateKeyPasswordFields = () => {},
}) => {
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] =
    useState<boolean>(false);
  const [confirmedOverwrite, setConfirmedOverwrite] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importingModel, setImportingModel] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [sshTunnelPasswords, setSSHTunnelPasswords] = useState<
    Record<string, string>
  >({});
  const [sshTunnelPrivateKeys, setSSHTunnelPrivateKeys] = useState<
    Record<string, string>
  >({});
  const [sshTunnelPrivateKeyPasswords, setSSHTunnelPrivateKeyPasswords] =
    useState<Record<string, string>>({});

  const clearModal = () => {
    setFileList([]);
    setPasswordFields([]);
    setPasswords({});
    setNeedsOverwriteConfirm(false);
    setConfirmedOverwrite(false);
    setImportingModel(false);
    setErrorMessage('');
    setSSHTunnelPasswordFields([]);
    setSSHTunnelPrivateKeyFields([]);
    setSSHTunnelPrivateKeyPasswordFields([]);
    setSSHTunnelPasswords({});
    setSSHTunnelPrivateKeys({});
    setSSHTunnelPrivateKeyPasswords({});
  };

  const handleErrorMsg = (msg: string) => {
    setErrorMessage(msg);
  };

  const {
    state: {
      alreadyExists,
      passwordsNeeded,
      sshPasswordNeeded,
      sshPrivateKeyNeeded,
      sshPrivateKeyPasswordNeeded,
    },
    importResource,
  } = useImportResource(resourceName, resourceLabel, handleErrorMsg);

  useEffect(() => {
    setPasswordFields(passwordsNeeded);
    if (passwordsNeeded.length > 0) {
      setImportingModel(false);
    }
  }, [passwordsNeeded, setPasswordFields]);

  useEffect(() => {
    setNeedsOverwriteConfirm(alreadyExists.length > 0);
    if (alreadyExists.length > 0) {
      setImportingModel(false);
    }
  }, [alreadyExists, setNeedsOverwriteConfirm]);

  useEffect(() => {
    setSSHTunnelPasswordFields(sshPasswordNeeded);
    if (sshPasswordNeeded.length > 0) {
      setImportingModel(false);
    }
  }, [sshPasswordNeeded, setSSHTunnelPasswordFields]);

  useEffect(() => {
    setSSHTunnelPrivateKeyFields(sshPrivateKeyNeeded);
    if (sshPrivateKeyNeeded.length > 0) {
      setImportingModel(false);
    }
  }, [sshPrivateKeyNeeded, setSSHTunnelPrivateKeyFields]);

  useEffect(() => {
    setSSHTunnelPrivateKeyPasswordFields(sshPrivateKeyPasswordNeeded);
    if (sshPrivateKeyPasswordNeeded.length > 0) {
      setImportingModel(false);
    }
  }, [sshPrivateKeyPasswordNeeded, setSSHTunnelPrivateKeyPasswordFields]);

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
    clearModal();
  };

  const onUpload = () => {
    if (!(fileList[0]?.originFileObj instanceof File)) {
      return;
    }

    setImportingModel(true);
    importResource(
      fileList[0].originFileObj,
      passwords,
      sshTunnelPasswords,
      sshTunnelPrivateKeys,
      sshTunnelPrivateKeyPasswords,
      confirmedOverwrite,
    ).then(result => {
      if (result) {
        clearModal();
        onModelImport();
      }
    });
  };

  const changeFile = (info: UploadChangeParam) => {
    setFileList([
      {
        ...info.file,
        status: 'done',
      },
    ]);
  };

  const removeFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    return false;
  };

  const confirmOverwrite = (event: ChangeEvent<HTMLInputElement>) => {
    const targetValue = (event.currentTarget?.value as string) ?? '';
    setConfirmedOverwrite(targetValue.toUpperCase() === t('OVERWRITE'));
  };

  const renderPasswordFields = () => {
    if (
      passwordFields.length === 0 &&
      sshTunnelPasswordFields.length === 0 &&
      sshTunnelPrivateKeyFields.length === 0 &&
      sshTunnelPrivateKeyPasswordFields.length === 0
    ) {
      return null;
    }

    const files = [
      ...new Set([
        ...passwordFields,
        ...sshTunnelPasswordFields,
        ...sshTunnelPrivateKeyFields,
        ...sshTunnelPrivateKeyPasswordFields,
      ]),
    ];

    return (
      <>
        <h5>{t('Database passwords')}</h5>
        <HelperMessage>{passwordsNeededMessage}</HelperMessage>
        {files.map(fileName => (
          <>
            {passwordFields?.indexOf(fileName) >= 0 && (
              <StyledInputContainer key={`password-for-${fileName}`}>
                <div className="control-label">
                  {t('%s PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <input
                  name={`password-${fileName}`}
                  autoComplete={`password-${fileName}`}
                  type="password"
                  value={passwords[fileName]}
                  onChange={event =>
                    setPasswords({
                      ...passwords,
                      [fileName]: event.target.value,
                    })
                  }
                />
              </StyledInputContainer>
            )}
            {sshTunnelPasswordFields?.indexOf(fileName) >= 0 && (
              <StyledInputContainer key={`ssh_tunnel_password-for-${fileName}`}>
                <div className="control-label">
                  {t('%s SSH TUNNEL PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <input
                  name={`ssh_tunnel_password-${fileName}`}
                  autoComplete={`ssh_tunnel_password-${fileName}`}
                  type="password"
                  value={sshTunnelPasswords[fileName]}
                  onChange={event =>
                    setSSHTunnelPasswords({
                      ...sshTunnelPasswords,
                      [fileName]: event.target.value,
                    })
                  }
                  data-test="ssh_tunnel_password"
                />
              </StyledInputContainer>
            )}
            {sshTunnelPrivateKeyFields?.indexOf(fileName) >= 0 && (
              <StyledInputContainer
                key={`ssh_tunnel_private_key-for-${fileName}`}
              >
                <div className="control-label">
                  {t('%s SSH TUNNEL PRIVATE KEY', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <textarea
                  name={`ssh_tunnel_private_key-${fileName}`}
                  autoComplete={`ssh_tunnel_private_key-${fileName}`}
                  value={sshTunnelPrivateKeys[fileName]}
                  onChange={event =>
                    setSSHTunnelPrivateKeys({
                      ...sshTunnelPrivateKeys,
                      [fileName]: event.target.value,
                    })
                  }
                  data-test="ssh_tunnel_private_key"
                />
              </StyledInputContainer>
            )}
            {sshTunnelPrivateKeyPasswordFields?.indexOf(fileName) >= 0 && (
              <StyledInputContainer
                key={`ssh_tunnel_private_key_password-for-${fileName}`}
              >
                <div className="control-label">
                  {t('%s SSH TUNNEL PRIVATE KEY PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <input
                  name={`ssh_tunnel_private_key_password-${fileName}`}
                  autoComplete={`ssh_tunnel_private_key_password-${fileName}`}
                  type="password"
                  value={sshTunnelPrivateKeyPasswords[fileName]}
                  onChange={event =>
                    setSSHTunnelPrivateKeyPasswords({
                      ...sshTunnelPrivateKeyPasswords,
                      [fileName]: event.target.value,
                    })
                  }
                  data-test="ssh_tunnel_private_key_password"
                />
              </StyledInputContainer>
            )}
          </>
        ))}
      </>
    );
  };

  const renderOverwriteConfirmation = () => {
    if (!needsOverwriteConfirm) {
      return null;
    }

    return (
      <>
        <StyledInputContainer>
          <div className="confirm-overwrite">{confirmOverwriteMessage}</div>
          <div className="control-label">
            {t('Type "%s" to confirm', t('OVERWRITE'))}
          </div>
          <input
            data-test="overwrite-modal-input"
            id="overwrite"
            type="text"
            onChange={confirmOverwrite}
          />
        </StyledInputContainer>
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
      disablePrimaryButton={
        fileList.length === 0 ||
        (needsOverwriteConfirm && !confirmedOverwrite) ||
        importingModel
      }
      onHandledPrimaryAction={onUpload}
      onHide={hide}
      primaryButtonName={needsOverwriteConfirm ? t('Overwrite') : t('Import')}
      primaryButtonType={needsOverwriteConfirm ? 'danger' : 'primary'}
      width="750px"
      show={show}
      title={<h4>{t('Import %s', resourceLabel)}</h4>}
    >
      <StyledInputContainer>
        <Upload
          name="modelFile"
          id="modelFile"
          data-test="model-file-input"
          accept=".yaml,.json,.yml,.zip"
          fileList={fileList}
          onChange={changeFile}
          onRemove={removeFile}
          // upload is handled by hook
          customRequest={() => {}}
          disabled={importingModel}
        >
          <Button loading={importingModel}>{t('Select file')}</Button>
        </Upload>
      </StyledInputContainer>
      {errorMessage && (
        <ErrorAlert
          errorMessage={errorMessage}
          showDbInstallInstructions={
            passwordFields.length > 0 ||
            sshTunnelPasswordFields.length > 0 ||
            sshTunnelPrivateKeyFields.length > 0 ||
            sshTunnelPrivateKeyPasswordFields.length > 0
          }
        />
      )}
      {renderPasswordFields()}
      {renderOverwriteConfirmation()}
    </Modal>
  );
};

export default ImportModelsModal;
