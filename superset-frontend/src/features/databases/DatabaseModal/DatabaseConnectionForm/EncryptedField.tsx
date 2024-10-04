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
import { useState } from 'react';
import { SupersetTheme, t } from '@superset-ui/core';
import { Button, AntdSelect } from 'src/components';
import InfoTooltip from 'src/components/InfoTooltip';
import FormLabel from 'src/components/Form/FormLabel';
import Icons from 'src/components/Icons';
import { FieldPropTypes } from '../../types';
import { infoTooltip, labelMarginBottom, CredentialInfoForm } from '../styles';

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

const castStringToBoolean = (optionValue: string) => optionValue === 'true';

export const EncryptedField = ({
  changeMethods,
  isEditMode,
  db,
  editNewDb,
}: FieldPropTypes) => {
  const [uploadOption, setUploadOption] = useState<number>(
    CredentialInfoOptions.JsonUpload.valueOf(),
  );
  const [fileToUpload, setFileToUpload] = useState<string | null | undefined>(
    null,
  );
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const showCredentialsInfo =
    db?.engine === 'gsheets' ? !isEditMode && !isPublic : !isEditMode;
  const isEncrypted = isEditMode && db?.masked_encrypted_extra !== '{}';
  const encryptedField = db?.engine && encryptedCredentialsMap[db.engine];
  const encryptedValue =
    typeof db?.parameters?.[encryptedField] === 'object'
      ? JSON.stringify(db?.parameters?.[encryptedField])
      : db?.parameters?.[encryptedField];
  return (
    <CredentialInfoForm>
      {db?.engine === 'gsheets' && (
        <div className="catalog-type-select">
          <FormLabel
            css={(theme: SupersetTheme) => labelMarginBottom(theme)}
            required
          >
            {t('Type of Google Sheets allowed')}
          </FormLabel>
          <AntdSelect
            style={{ width: '100%' }}
            defaultValue={isEncrypted ? 'false' : 'true'}
            onChange={(value: string) =>
              setIsPublic(castStringToBoolean(value))
            }
          >
            <AntdSelect.Option value="true" key={1}>
              {t('Publicly shared sheets only')}
            </AntdSelect.Option>
            <AntdSelect.Option value="false" key={2}>
              {t('Public and privately shared sheets')}
            </AntdSelect.Option>
          </AntdSelect>
        </div>
      )}
      {showCredentialsInfo && (
        <>
          <FormLabel required>
            {t('How do you want to enter service account credentials?')}
          </FormLabel>
          <AntdSelect
            defaultValue={uploadOption}
            style={{ width: '100%' }}
            onChange={option => setUploadOption(option)}
          >
            <AntdSelect.Option value={CredentialInfoOptions.JsonUpload}>
              {t('Upload JSON file')}
            </AntdSelect.Option>

            <AntdSelect.Option value={CredentialInfoOptions.CopyPaste}>
              {t('Copy and Paste JSON credentials')}
            </AntdSelect.Option>
          </AntdSelect>
        </>
      )}
      {uploadOption === CredentialInfoOptions.CopyPaste ||
      isEditMode ||
      editNewDb ? (
        <div className="input-container">
          <FormLabel required>{t('Service Account')}</FormLabel>
          <textarea
            className="input-form"
            name={encryptedField}
            value={encryptedValue}
            onChange={changeMethods.onParametersChange}
            placeholder={t(
              'Paste content of service credentials JSON file here',
            )}
          />
          <span className="label-paste">
            {t('Copy and paste the entire service account .json file here')}
          </span>
        </div>
      ) : (
        showCredentialsInfo && (
          <div
            className="input-container"
            css={(theme: SupersetTheme) => infoTooltip(theme)}
          >
            <div css={{ display: 'flex', alignItems: 'center' }}>
              <FormLabel required>{t('Upload Credentials')}</FormLabel>
              <InfoTooltip
                tooltip={t(
                  'Use the JSON file you automatically downloaded when creating your service account.',
                )}
                viewBox="0 0 24 24"
              />
            </div>

            {!fileToUpload && (
              <Button
                className="input-upload-btn"
                onClick={() =>
                  document?.getElementById('selectedFile')?.click()
                }
              >
                {t('Choose File')}
              </Button>
            )}
            {fileToUpload && (
              <div className="input-upload-current">
                {fileToUpload}
                <Icons.DeleteFilled
                  iconSize="m"
                  onClick={() => {
                    setFileToUpload(null);
                    changeMethods.onParametersChange({
                      target: {
                        name: encryptedField,
                        value: '',
                      },
                    });
                  }}
                />
              </div>
            )}

            <input
              id="selectedFile"
              accept=".json"
              className="input-upload"
              type="file"
              onChange={async event => {
                let file;
                if (event.target.files) {
                  file = event.target.files[0];
                }
                setFileToUpload(file?.name);
                changeMethods.onParametersChange({
                  target: {
                    type: null,
                    name: encryptedField,
                    value: await file?.text(),
                    checked: false,
                  },
                });
                (
                  document.getElementById('selectedFile') as HTMLInputElement
                ).value = null as any;
              }}
            />
          </div>
        )
      )}
    </CredentialInfoForm>
  );
};
