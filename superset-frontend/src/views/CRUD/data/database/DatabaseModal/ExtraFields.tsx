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
import React from 'react';
import { t } from '@superset-ui/core';
import { FieldPropTypes } from 'src/views/CRUD/data/database/DatabaseModal/DatabaseConnectionForm';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';

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
