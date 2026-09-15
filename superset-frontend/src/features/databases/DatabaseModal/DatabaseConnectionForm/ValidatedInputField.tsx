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
import { t } from '@apache-superset/core/translation';
import { LabeledErrorBoundInput as ValidatedInput } from '@superset-ui/core/components';
import { DatabaseParameters, FieldPropTypes } from '../../types';

const FIELD_TEXT_MAP = {
  account: {
    label: t('Account'),
    helpText: t(
      'Copy the identifier of the account you are trying to connect to.',
    ),
    placeholder: t('e.g. xy12345.us-east-2.aws'),
  },
  warehouse: {
    label: t('Warehouse'),
    placeholder: t('e.g. compute_wh'),
    className: 'form-group-w-50',
  },
  role: {
    label: t('Role'),
    placeholder: t('e.g. AccountAdmin'),
    className: 'form-group-w-50',
  },
  aws_access_key_id: {
    label: t('AWS Access Key ID'),
    placeholder: t('e.g. AKIAIOSFODNN7EXAMPLE'),
  },
  aws_secret_access_key: {
    label: t('AWS Secret Access Key'),
    placeholder: t('e.g. ********'),
    visibilityToggle: true,
  },
  region_name: {
    label: t('Region'),
    placeholder: t('e.g. us-east-1'),
    className: 'form-group-w-50',
  },
  s3_staging_dir: {
    label: t('S3 Staging Directory'),
    placeholder: t('e.g. s3://my-bucket/staging/'),
  },
  schema_name: {
    label: t('Schema'),
    placeholder: t('e.g. default'),
    className: 'form-group-w-50',
  },
  work_group: {
    label: t('Work Group'),
    placeholder: t('e.g. primary'),
    className: 'form-group-w-50',
  },
};

type FieldTextMapKey = keyof typeof FIELD_TEXT_MAP;

export const validatedInputField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  field,
  isValidating,
  isEditMode,
}: FieldPropTypes) => (
  <ValidatedInput
    id={field}
    name={field}
    required={required}
    isValidating={isValidating}
    // Mask secret fields (render as a password input). In edit mode the value
    // is the server-side mask, so the visibility toggle is disabled to match
    // the `passwordField` behavior.
    visibilityToggle={
      FIELD_TEXT_MAP[field as 'aws_secret_access_key']?.visibilityToggle
        ? !isEditMode
        : undefined
    }
    value={db?.parameters?.[field as keyof DatabaseParameters]}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.[field]}
    placeholder={FIELD_TEXT_MAP[field as FieldTextMapKey].placeholder}
    helpText={FIELD_TEXT_MAP[field as 'account']?.helpText}
    label={FIELD_TEXT_MAP[field as FieldTextMapKey].label || field}
    onChange={changeMethods.onParametersChange}
    className={FIELD_TEXT_MAP[field as 'warehouse' | 'role'].className || field}
  />
);
