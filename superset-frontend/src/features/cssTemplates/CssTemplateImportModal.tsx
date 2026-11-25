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
import { FunctionComponent, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { Button, Modal } from '@superset-ui/core/components';
import {
  Upload,
  type UploadChangeParam,
  type UploadFile,
} from '@superset-ui/core/components/Upload';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { ImportErrorAlert } from 'src/components/ImportModal/ImportErrorAlert';
import { createErrorHandler } from 'src/views/CRUD/utils';

export const CSS_TEMPLATE_IMPORT_ENDPOINT = '/api/v1/css_template/import/';

const StyledContainer = styled.div`
  ${({ theme }) => css`
    padding-top: ${theme.sizeUnit * 2}px;
    padding-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

interface CssTemplateImportModalProps {
  show: boolean;
  onHide: () => void;
  onCssTemplatesImport: (message: string) => void;
}

const CssTemplateImportModal: FunctionComponent<
  CssTemplateImportModalProps
> = ({ show, onHide, onCssTemplatesImport }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const clearModal = () => {
    setFileList([]);
    setImporting(false);
    setErrorMessage('');
  };

  const hide = () => {
    clearModal();
    onHide();
  };

  const changeFiles = (info: UploadChangeParam) => {
    setErrorMessage('');
    setFileList(info.fileList.map(file => ({ ...file, status: 'done' })));
  };

  const onImport = () => {
    const files = fileList
      .map(({ originFileObj }) => originFileObj)
      .filter((file): file is NonNullable<typeof file> => file instanceof File);
    if (files.length === 0) {
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append('formData', file, file.name));

    setErrorMessage('');
    setImporting(true);
    SupersetClient.post({
      endpoint: CSS_TEMPLATE_IMPORT_ENDPOINT,
      body: formData,
      headers: { Accept: 'application/json' },
    }).then(
      ({ json = {} }) => {
        clearModal();
        onCssTemplatesImport(json.message ?? t('CSS templates imported'));
      },
      createErrorHandler(errMsg => {
        setImporting(false);
        setErrorMessage(
          t(
            'An error occurred while importing CSS templates: %s',
            typeof errMsg === 'string' ? errMsg : t('Unknown error'),
          ),
        );
      }),
    );
  };

  return (
    <Modal
      name="css-template-import"
      className="css-template-import-modal"
      disablePrimaryButton={fileList.length === 0 || importing}
      primaryButtonLoading={importing}
      onHandledPrimaryAction={onImport}
      onHide={hide}
      primaryButtonName={t('Import')}
      width="750px"
      show={show}
      title={<ModalTitleWithIcon title={t('Import CSS templates')} />}
    >
      <StyledContainer>
        <Upload
          name="cssTemplateFiles"
          id="cssTemplateFiles"
          data-test="css-template-file-input"
          accept=".css"
          multiple
          fileList={fileList}
          onChange={changeFiles}
          // upload is handled on import
          customRequest={() => {}}
          disabled={importing}
        >
          <Button loading={importing}>{t('Select files')}</Button>
        </Upload>
      </StyledContainer>
      {errorMessage && (
        <ImportErrorAlert
          errorMessage={errorMessage}
          showDbInstallInstructions={false}
        />
      )}
    </Modal>
  );
};

export default CssTemplateImportModal;
