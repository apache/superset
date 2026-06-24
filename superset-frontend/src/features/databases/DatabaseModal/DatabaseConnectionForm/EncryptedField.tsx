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
import { t } from '@apache-superset/core/translation';
import { SupersetTheme } from '@apache-superset/core/theme';
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
import { DatabaseParameters, Engines, FieldPropTypes } from '../../types';
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
  datastore: 'credentials_info',
};

export const EncryptedField = ({
  changeMethods,
  isEditMode,
  db,
  editNewDb,
  isPublic = true,
  setIsPublic,
}: FieldPropTypes) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadOption, setUploadOption] = useState<number>(
    CredentialInfoOptions.JsonUpload.valueOf(),
  );
  const { addDangerToast } = useToasts();
  const isGSheets = db?.engine === Engines.GSheet;
  const showCredentialsInfo = !isEditMode && (!isGSheets || !isPublic);
  const showCredentialsSection = !isGSheets || !isPublic;
  const encryptedField =
    db?.engine &&
    encryptedCredentialsMap[db.engine as keyof typeof encryptedCredentialsMap];
  const paramValue =
    db?.parameters?.[encryptedField as keyof DatabaseParameters];
  // In edit mode the backend may return the existing (masked) credential in
  // the parameters. Do not surface any pre-existing value in the field; the
  // user must re-enter credentials to change them. This also matches the
  // mount effect below, which resets the parameter to an empty string.
  const encryptedValue =
    isEditMode || paramValue == null
      ? ''
      : typeof paramValue === 'object'
        ? JSON.stringify(paramValue)
        : paramValue;

  const handlePublicToggle = (value: string) => {
    const nextIsPublic = value === 'true';
    setIsPublic?.(nextIsPublic);
    if (nextIsPublic) {
      // Clear in-flight `parameters.*` so the save-time merge in
      // DatabaseModal/index.tsx doesn't write them into masked_encrypted_extra.
      changeMethods.onParametersChange({
        target: { name: 'service_account_info', value: '' },
      });
      changeMethods.onParametersChange({
        target: { name: 'oauth2_client_info', value: '' },
      });
      // Also delete any previously-stored values from masked_encrypted_extra
      // itself (loaded in edit mode), since the save-time merge preserves
      // existing keys and only overwrites them when `parameters.*` is truthy.
      // Use the dedicated `ClearEncryptedExtraKey` action so the generic
      // `EncryptedExtraInputChange` handler keeps its master semantics (store
      // empty strings, never delete) for any other caller.
      changeMethods.onClearEncryptedExtraKey('service_account_info');
      changeMethods.onClearEncryptedExtraKey('oauth2_client_info');
    }
  };

  const readTextFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  useEffect(() => {
    // Skip the initial clear when there's no engine-specific field name yet
    // (e.g. the db prop hasn't finished loading): writing the falsy
    // `encryptedField` as a key would pollute parameters with `false: ''`,
    // and racing the async credential load isn't useful anyway.
    if (!encryptedField) return;
    changeMethods.onParametersChange({
      target: {
        name: encryptedField,
        value: '',
      },
    });
  }, []);

  return (
    <CredentialInfoForm>
      {isGSheets && (
        <>
          <FormLabel required>{t('Type of Google Sheets allowed')}</FormLabel>
          <Select
            value={isPublic ? 'true' : 'false'}
            css={{ width: '100%' }}
            onChange={value => handlePublicToggle(value as string)}
            options={[
              { value: 'true', label: t('Publicly shared sheets only') },
              {
                value: 'false',
                label: t('Public and privately shared sheets'),
              },
            ]}
          />
        </>
      )}
      {showCredentialsInfo && (
        <>
          <FormLabel>
            {t('How do you want to enter service account credentials?')}
          </FormLabel>
          <Select
            defaultValue={uploadOption}
            css={{ width: '100%' }}
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
      {showCredentialsSection &&
      (uploadOption === CredentialInfoOptions.CopyPaste ||
        isEditMode ||
        editNewDb) ? (
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
                  } catch {
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
