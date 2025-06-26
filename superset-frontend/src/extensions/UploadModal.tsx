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
import { css, SupersetClient, t } from '@superset-ui/core';
import {
  Alert,
  Button,
  Icons,
  Modal,
  Upload,
  UploadChangeParam,
  UploadFile,
} from '@superset-ui/core/components';
import { useState } from 'react';

type UploadProps = {
  show: boolean;
  onHide: () => void;
  onUploadSuccess: () => void;
};

const UploadModal = ({ show, onHide, onUploadSuccess }: UploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onChangeFile = async (info: UploadChangeParam<any>) => {
    setFileLoading(true);
    setError(null);
    setFileList([
      {
        ...info.file,
        status: 'done',
      },
    ]);
    setFileLoading(false);
  };

  const onUpload = async () => {
    setIsUploading(true);
    try {
      const file: File = fileList[0].originFileObj as File;
      const formData = new FormData();
      formData.append('bundle', file);
      await SupersetClient.post({
        endpoint: '/api/v1/extensions/import/',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      // TODO: We need to load a single extension from the backend and
      // initialize it in the ExtensionsManager
      // to make it available in the frontend.

      onUploadSuccess();
    } catch (err) {
      setError(t('Failed to upload the extension. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  const onRemoveFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    setError(null);
    return false;
  };

  const handleHide = () => {
    setFileList([]);
    setError(null);
    onHide();
  };

  return (
    <Modal
      primaryButtonLoading={isUploading}
      onHandledPrimaryAction={onUpload}
      onHide={handleHide}
      width="500px"
      primaryButtonName="Upload"
      centered
      show={show}
      title={t('Upload Extension')}
    >
      <Upload
        name="modelFile"
        id="modelFile"
        data-test="model-file-input"
        accept=".supx"
        fileList={fileList}
        onChange={onChangeFile}
        onRemove={onRemoveFile}
        // upload is not handled by the Upload component
        customRequest={() => {}}
      >
        <Button
          css={css`
            margin-right: 16px;
          `}
          aria-label={t('Select')}
          icon={<Icons.UploadOutlined />}
          loading={fileLoading}
        >
          {t('Select')}
        </Button>
        {t('Upload a .supx file containing the extension bundle.')}
      </Upload>
      {error && (
        <Alert
          css={css`
            margin-top: 16px;
          `}
          type="error"
          closable={false}
        >
          {error}
        </Alert>
      )}
    </Modal>
  );
};

export default UploadModal;
