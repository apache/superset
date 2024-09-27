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
import { t } from '@superset-ui/core';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import { FieldPropTypes } from '../../types';

const FIELD_TEXT_MAP = {
  account: {
    label: 'Account',
    helpText: t(
      'Copy the identifier of the account you are trying to connect to.',
    ),
    placeholder: t('e.g. xy12345.us-east-2.aws'),
  },
  warehouse: {
    label: 'Warehouse',
    placeholder: t('e.g. compute_wh'),
    className: 'form-group-w-50',
  },
  role: {
    label: 'Role',
    placeholder: t('e.g. AccountAdmin'),
    className: 'form-group-w-50',
  },
};

export const validatedInputField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  field,
}: FieldPropTypes) => (
  <ValidatedInput
    id={field}
    name={field}
    required={required}
    value={db?.parameters?.[field]}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.[field]}
    placeholder={FIELD_TEXT_MAP[field].placeholder}
    helpText={FIELD_TEXT_MAP[field].helpText}
    label={FIELD_TEXT_MAP[field].label || field}
    onChange={changeMethods.onParametersChange}
    className={FIELD_TEXT_MAP[field].className || field}
  />
);
