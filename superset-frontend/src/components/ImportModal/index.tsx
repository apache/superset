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
import React, { FunctionComponent, useEffect, useState } from 'react';
import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface';
import { styled, t } from '@superset-ui/core';
import Checkbox, { CheckboxChangeEvent } from 'antd/lib/checkbox';

import Button from 'src/components/Button';
import Modal from 'src/components/Modal';
import Alert from 'src/components/Alert';
import Collapse from 'src/components/Collapse';
import { Upload } from 'src/components';
import { useImportResource } from 'src/views/CRUD/hooks';
import { ImportResourceName } from 'src/views/CRUD/types';

const HelperMessage = styled.div`
  display: block;
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
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
  configOverwriteFields?: string[];
}

const ImportModelsModal: FunctionComponent<ImportModelsModalProps> = ({
  resourceName,
  resourceLabel,
  passwordsNeededMessage,
  confirmOverwriteMessage,
  addDangerToast,
  onModelImport,
  show,
  onHide,
  configOverwriteFields = [],
  passwordFields = [],
  setPasswordFields = () => {},
}) => {
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] =
    useState<boolean>(false);
  const [confirmedOverwrite, setConfirmedOverwrite] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importingModel, setImportingModel] = useState<boolean>(false);
  const defaultFields = configOverwriteFields.reduce((obj, currentField) => {
    // eslint-disable-next-line no-param-reassign
    obj[currentField] = false;
    return obj;
  }, {});

  const [configOverwriteStatus, setConfigOverwriteStatus] =
    useState<Record<string, boolean>>(defaultFields);
  const [confirmedConfigOverwriteTxt, setConfirmedConfigOverwriteTxt] =
    useState<string>('');

  const clearModal = () => {
    setFileList([]);
    setPasswordFields([]);
    setPasswords({});
    setNeedsOverwriteConfirm(false);
    setConfirmedOverwrite(false);
    setImportingModel(false);
    setConfigOverwriteStatus(defaultFields);
    setConfirmedConfigOverwriteTxt('');
  };

  const handleErrorMsg = (msg: string) => {
    clearModal();
    addDangerToast(msg);
  };

  const {
    state: { alreadyExists, passwordsNeeded },
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
    const configOverwrite =
      confirmedConfigOverwriteTxt.toUpperCase() === t('CONFIRM')
        ? configOverwriteStatus
        : {};
    importResource(
      fileList[0].originFileObj,
      passwords,
      confirmedOverwrite,
      configOverwrite,
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

  const confirmOverwrite = (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetValue = (event.currentTarget?.value as string) ?? '';
    setConfirmedOverwrite(targetValue.toUpperCase() === t('OVERWRITE'));
  };

  const handleCheckbox = (event: CheckboxChangeEvent) => {
    const field = event.target?.id || '';
    setConfigOverwriteStatus({
      ...configOverwriteStatus,
      [field]: event.target.checked,
    });
  };

  const renderPasswordFields = () => {
    if (passwordFields.length === 0) {
      return null;
    }

    return (
      <>
        <h5>Database passwords</h5>
        <HelperMessage>{passwordsNeededMessage}</HelperMessage>
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

  const isAnyOverwriteFieldSelected = (): boolean =>
    Object.values(configOverwriteStatus).some(status => status);

  const confirmOverwriteConfigByTyping = (): JSX.Element => {
    const expectedInput = `${t('CONFIRM')}`;

    return (
      <StyledInputContainer>
        <div className="control-label">
          {t(
            `Type "${expectedInput}" to confirm loading the config, ` +
              `otherwise the configuration will not loaded`,
          )}
        </div>
        <input
          data-test="confirm-config-overwrite"
          type="text"
          placeholder={expectedInput}
          value={confirmedConfigOverwriteTxt}
          onChange={e => {
            setConfirmedConfigOverwriteTxt(e.target.value);
          }}
        />
      </StyledInputContainer>
    );
  };

  const overwriteFieldCheckbox = (field: string): JSX.Element => (
    <Checkbox
      onChange={handleCheckbox}
      id={field}
      key={field}
      checked={configOverwriteStatus[field]}
    >
      {`Overwrite ${field}`}
    </Checkbox>
  );

  const advancedOptions = (): null | JSX.Element => {
    if (configOverwriteFields.length === 0) {
      return null;
    }

    return (
      <Collapse bordered expandIconPosition="right" ghost>
        <Collapse.Panel
          header={<span className="header">{t('Advanced settings')}</span>}
          key="advanced"
        >
          {warningConfig()}
          {configOverwriteFields.map(overwriteFieldCheckbox)}
          {confirmOverwriteConfigByTyping()}
        </Collapse.Panel>
      </Collapse>
    );
  };

  const warningConfig = (): JSX.Element => (
    <Alert
      css={theme => ({ marginBottom: theme.gridUnit * 4 })}
      type="warning"
      message={
        <>
          <strong>{t('Be careful.')} </strong>
          {t(
            'Overwriting might cause you to lose some of your work. Are you' +
              'sure you want to overwrite?',
          )}
        </>
      }
    />
  );

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  const isLoadingConfigOverwrite = (): boolean =>
    confirmedConfigOverwriteTxt.toUpperCase() === t('CONFIRM') &&
    isAnyOverwriteFieldSelected();

  const isInOverwritingMode = (): boolean =>
    needsOverwriteConfirm || isLoadingConfigOverwrite();

  const getButtonType = () => (isInOverwritingMode() ? 'danger' : 'primary');

  const getButtonName = () =>
    isInOverwritingMode() ? t('Overwrite') : t('Import');

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
      primaryButtonName={getButtonName()}
      primaryButtonType={getButtonType()}
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
        >
          <Button loading={importingModel}>Select file</Button>
        </Upload>
      </StyledInputContainer>
      {advancedOptions()}
      {renderPasswordFields()}
      {renderOverwriteConfirmation()}
    </Modal>
  );
};

export default ImportModelsModal;
