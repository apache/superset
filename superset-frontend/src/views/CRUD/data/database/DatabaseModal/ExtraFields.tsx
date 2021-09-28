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
import React, { useState } from 'react';
import { SupersetTheme, t } from '@superset-ui/core';
import { FieldPropTypes } from 'src/views/CRUD/data/database/DatabaseModal/DatabaseConnectionForm';
import { Select, Button } from 'src/common/components';
import InfoTooltip from 'src/components/InfoTooltip';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import FormLabel from 'src/components/Form/FormLabel';
import { DeleteFilled, CloseOutlined } from '@ant-design/icons';
import {
  StyledFooterButton,
  StyledCatalogTable,
  CredentialInfoForm,
  infoTooltip,
} from './styles';
import { CatalogObject } from '../types';

enum CredentialInfoOptions {
  jsonUpload,
  copyPaste,
}

export const accountField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="account"
    name="account"
    required={required}
    value={db?.parameters?.account}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.account}
    placeholder="e.g. world_population"
    label="Account"
    onChange={changeMethods.onParametersChange}
    helpText={t(
      'Copy the account name of that database you are trying to connect to.',
    )}
  />
);

export const warehouseField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="warehouse"
    name="warehouse"
    required={required}
    value={db?.parameters?.warehouse}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.warehouse}
    placeholder="e.g. compute_wh"
    label="Warehouse"
    onChange={changeMethods.onParametersChange}
    className="form-group-w-50"
  />
);

export const roleField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="role"
    name="role"
    required={required}
    value={db?.parameters?.role}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.role}
    placeholder="e.g. AccountAdmin"
    label="Role"
    onChange={changeMethods.onParametersChange}
    className="form-group-w-50"
  />
);

export const TableCatalog = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => {
  const tableCatalog = db?.catalog || [];
  const catalogError = validationErrors || {};
  return (
    <StyledCatalogTable>
      <div className="catalog-type-select">
        <FormLabel required>{t('Type of Google Sheets Allowed')}</FormLabel>
        <Select style={{ width: '100%' }} defaultValue="true" disabled>
          <Select.Option value="true" key={1}>
            {t('Publicly shared sheets only')}
          </Select.Option>
        </Select>
      </div>
      <h4 className="gsheet-title">
        {t('Connect Google Sheets as tables to this database')}
      </h4>
      <div>
        {tableCatalog?.map((sheet: CatalogObject, idx: number) => (
          <>
            <FormLabel className="catalog-label" required>
              {t('Google Sheet Name and URL')}
            </FormLabel>
            <div className="catalog-name">
              <ValidatedInput
                className="catalog-name-input"
                required={required}
                validationMethods={{ onBlur: getValidation }}
                errorMessage={catalogError[idx]?.name}
                placeholder={t('Enter a name for this sheet')}
                onChange={(e: { target: { value: any } }) => {
                  changeMethods.onParametersChange({
                    target: {
                      type: `catalog-${idx}`,
                      name: 'name',
                      value: e.target.value,
                    },
                  });
                }}
                value={sheet.name}
              />
              {tableCatalog?.length > 1 && (
                <CloseOutlined
                  className="catalog-delete"
                  onClick={() => changeMethods.onRemoveTableCatalog(idx)}
                />
              )}
            </div>
            <ValidatedInput
              className="catalog-name-url"
              required={required}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={catalogError[idx]?.url}
              placeholder={t('Paste the shareable Google Sheet URL here')}
              onChange={(e: { target: { value: any } }) =>
                changeMethods.onParametersChange({
                  target: {
                    type: `catalog-${idx}`,
                    name: 'value',
                    value: e.target.value,
                  },
                })
              }
              value={sheet.value}
            />
          </>
        ))}
        <StyledFooterButton
          className="catalog-add-btn"
          onClick={() => {
            changeMethods.onAddTableCatalog();
          }}
        >
          + {t('Add sheet')}
        </StyledFooterButton>
      </div>
    </StyledCatalogTable>
  );
};

export const CredentialsInfo = ({
  changeMethods,
  isEditMode,
  db,
  editNewDb,
}: FieldPropTypes) => {
  const [uploadOption, setUploadOption] = useState<number>(
    CredentialInfoOptions.jsonUpload.valueOf(),
  );
  const [fileToUpload, setFileToUpload] = useState<string | null | undefined>(
    null,
  );
  return (
    <CredentialInfoForm>
      {!isEditMode && (
        <>
          <FormLabel required>
            {t('How do you want to enter service account credentials?')}
          </FormLabel>
          <Select
            defaultValue={uploadOption}
            style={{ width: '100%' }}
            onChange={option => setUploadOption(option)}
          >
            <Select.Option value={CredentialInfoOptions.jsonUpload}>
              {t('Upload JSON file')}
            </Select.Option>

            <Select.Option value={CredentialInfoOptions.copyPaste}>
              {t('Copy and Paste JSON credentials')}
            </Select.Option>
          </Select>
        </>
      )}
      {uploadOption === CredentialInfoOptions.copyPaste ||
      isEditMode ||
      editNewDb ? (
        <div className="input-container">
          <FormLabel required>{t('Service Account')}</FormLabel>
          <textarea
            className="input-form"
            name="credentials_info"
            value={db?.parameters?.credentials_info}
            onChange={changeMethods.onParametersChange}
            placeholder="Paste content of service credentials JSON file here"
          />
          <span className="label-paste">
            {t('Copy and paste the entire service account .json file here')}
          </span>
        </div>
      ) : (
        <div
          className="input-container"
          css={(theme: SupersetTheme) => infoTooltip(theme)}
        >
          <div css={{ display: 'flex', alignItems: 'center' }}>
            <FormLabel required>{t('Upload Credentials')}</FormLabel>
            <InfoTooltip
              tooltip={t(
                'Use the JSON file you automatically downloaded when creating your service account in Google BigQuery.',
              )}
              viewBox="0 0 24 24"
            />
          </div>

          {!fileToUpload && (
            <Button
              className="input-upload-btn"
              onClick={() => document?.getElementById('selectedFile')?.click()}
            >
              {t('Choose File')}
            </Button>
          )}
          {fileToUpload && (
            <div className="input-upload-current">
              {fileToUpload}
              <DeleteFilled
                onClick={() => {
                  setFileToUpload(null);
                  changeMethods.onParametersChange({
                    target: {
                      name: 'credentials_info',
                      value: '',
                    },
                  });
                }}
              />
            </div>
          )}

          <input
            id="selectedFile"
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
                  name: 'credentials_info',
                  value: await file?.text(),
                  checked: false,
                },
              });
              (document.getElementById(
                'selectedFile',
              ) as HTMLInputElement).value = null as any;
            }}
          />
        </div>
      )}
    </CredentialInfoForm>
  );
};
