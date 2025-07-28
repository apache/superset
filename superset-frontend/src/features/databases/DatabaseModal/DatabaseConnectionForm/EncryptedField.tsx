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
import { useState, useEffect } from 'react';
import { SupersetTheme, css, t } from '@superset-ui/core';
import {
  Input,
  Button,
  FormLabel,
  Select,
  Upload,
  type UploadFile,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { DatabaseParameters, FieldPropTypes } from '../../types';
import { infoTooltip, CredentialInfoForm } from '../styles';

enum CredentialInfoOptions {
  JsonUpload,
  CopyPaste,
}

// These are the columns that are going to be added to encrypted extra, they differ in name based
// on the engine, however we want to use the same component for each of them. Make sure to add the
// the engine specific name here.
export const encryptedCredentialsMap = {
  gsheets: 'service_account_info',
  bigquery: 'credentials_info',
};

export const EncryptedField = ({
  changeMethods,
  isEditMode,
  db,
  editNewDb,
}: FieldPropTypes) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadOption, setUploadOption] = useState<number>(
    CredentialInfoOptions.JsonUpload.valueOf(),
  );
  const { addDangerToast } = useToasts();
  const showCredentialsInfo = !isEditMode;
  const encryptedField =
    db?.engine &&
    encryptedCredentialsMap[db.engine as keyof typeof encryptedCredentialsMap];
  const paramValue =
    db?.parameters?.[encryptedField as keyof DatabaseParameters];
  const encryptedValue =
    paramValue && typeof paramValue === 'object'
      ? JSON.stringify(paramValue)
      : paramValue;

  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  useEffect(() => {
    changeMethods.onParametersChange({
      target: {
        name: encryptedField,
        value: '',
      },
    });
  }, []);

  return (
    <CredentialInfoForm>
      {showCredentialsInfo && (
        <>
          <FormLabel>
            {t('How do you want to enter service account credentials?')}
          </FormLabel>
          <Select
            defaultValue={uploadOption}
            css={css`
              width: 100%;
            `}
            onChange={option => setUploadOption(option as number)}
            options={[
              {
                value: CredentialInfoOptions.JsonUpload,
                label: t('Upload JSON file'),
              },
              {
                value: CredentialInfoOptions.CopyPaste,
                label: t('Copy and Paste JSON credentials'),
              },
            ]}
          />
        </>
      )}
      {uploadOption === CredentialInfoOptions.CopyPaste ||
      isEditMode ||
      editNewDb ? (
        <div className="input-container">
          <FormLabel>{t('Service Account')}</FormLabel>
          <Input.TextArea
            className="input-form"
            name={encryptedField}
            value={
              typeof encryptedValue === 'boolean'
                ? String(encryptedValue)
                : encryptedValue
            }
            onChange={changeMethods.onParametersChange}
            placeholder={t(
              'Paste content of service credentials JSON file here',
            )}
          />
        </div>
      ) : (
        showCredentialsInfo && (
          <div
            className="input-container"
            css={(theme: SupersetTheme) => infoTooltip(theme)}
          >
            <Upload
              accept=".json"
              maxCount={1}
              fileList={fileList}
              // avoid automatic upload
              beforeUpload={() => false}
              onRemove={() => {
                setFileList([]);
                changeMethods.onParametersChange({
                  target: {
                    name: encryptedField,
                    value: '',
                  },
                });
                return true;
              }}
              onChange={async info => {
                const file = info.fileList?.[0]?.originFileObj;
                if (file) {
                  try {
                    const fileContent = await readTextFile(file);
                    changeMethods.onParametersChange({
                      target: {
                        type: null,
                        name: encryptedField,
                        value: fileContent,
                        checked: false,
                      },
                    });
                    setFileList(info.fileList);
                  } catch (error) {
                    setFileList([]);
                    addDangerToast(
                      t(
                        'Unable to read the file, please refresh and try again.',
                      ),
                    );
                  }
                } else {
                  changeMethods.onParametersChange({
                    target: {
                      name: encryptedField,
                      value: '',
                    },
                  });
                }
              }}
            >
              <Button icon={<Icons.LinkOutlined iconSize="m" />}>
                {t('Upload credentials')}
              </Button>
            </Upload>
          </div>
        )
      )}
    </CredentialInfoForm>
  );
};
