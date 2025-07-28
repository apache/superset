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
import { styled, t, css } from '@superset-ui/core';
import { useImportResource } from 'src/views/CRUD/hooks';
import {
  Upload,
  type UploadChangeParam,
  type UploadFile,
} from '@superset-ui/core/components/Upload';
import { Button, Input, Modal } from '@superset-ui/core/components';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { ImportErrorAlert } from './ImportErrorAlert';
import type { ImportModelsModalProps } from './types';

const HelperMessage = styled.div`
  display: block;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const StyledContainer = styled.div`
  ${({ theme }) => css`
    padding-top: ${theme.sizeUnit * 2}px;
    padding-bottom: ${theme.sizeUnit * 2}px;

    & > div {
      margin: ${theme.sizeUnit}px 0;
    }

    .confirm-overwrite {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }
    input[type='text'],
    input[type='number'] {
      &[name='name'] {
        flex: 0 1 auto;
        width: 40%;
      }

      &[name='sqlalchemy_uri'] {
        margin-right: ${theme.sizeUnit * 3}px;
      }
    }
  `}
`;

export const ImportModal: FunctionComponent<ImportModelsModalProps> = ({
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
              <StyledContainer key={`password-for-${fileName}`}>
                <div className="control-label">
                  {t('%s PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <Input
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
              </StyledContainer>
            )}
            {sshTunnelPasswordFields?.indexOf(fileName) >= 0 && (
              <StyledContainer key={`ssh_tunnel_password-for-${fileName}`}>
                <div className="control-label">
                  {t('%s SSH TUNNEL PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <Input
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
              </StyledContainer>
            )}
            {sshTunnelPrivateKeyFields?.indexOf(fileName) >= 0 && (
              <StyledContainer key={`ssh_tunnel_private_key-for-${fileName}`}>
                <div className="control-label">
                  {t('%s SSH TUNNEL PRIVATE KEY', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <Input.TextArea
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
              </StyledContainer>
            )}
            {sshTunnelPrivateKeyPasswordFields?.indexOf(fileName) >= 0 && (
              <StyledContainer
                key={`ssh_tunnel_private_key_password-for-${fileName}`}
              >
                <div className="control-label">
                  {t('%s SSH TUNNEL PRIVATE KEY PASSWORD', fileName.slice(10))}
                  <span className="required">*</span>
                </div>
                <Input
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
              </StyledContainer>
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
        <StyledContainer>
          <div className="confirm-overwrite">{confirmOverwriteMessage}</div>
          <div className="control-label">
            {t('Type "%s" to confirm', t('OVERWRITE'))}
          </div>
          <Input
            data-test="overwrite-modal-input"
            id="overwrite"
            type="text"
            onChange={confirmOverwrite}
          />
        </StyledContainer>
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
      primaryButtonStyle={needsOverwriteConfirm ? 'danger' : 'primary'}
      width="750px"
      show={show}
      title={<ModalTitleWithIcon title={t('Import %s', resourceLabel)} />}
    >
      <StyledContainer>
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
      </StyledContainer>
      {errorMessage && (
        <ImportErrorAlert
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

export type { ImportModelsModalProps };
