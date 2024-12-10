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
import { SupersetTheme } from '@superset-ui/core';
import { Form } from 'src/components/Form';
import { FormFieldOrder, FORM_FIELD_MAP } from './constants';
import { formScrollableStyles, validatedFormStyles } from '../styles';
import { DatabaseConnectionFormProps } from '../../types';

const DatabaseConnectionForm = ({
  dbModel,
  db,
  editNewDb,
  getPlaceholder,
  getValidation,
  isEditMode = false,
  onAddTableCatalog,
  onChange,
  onExtraInputChange,
  onEncryptedExtraInputChange,
  onParametersChange,
  onParametersUploadFileChange,
  onQueryChange,
  onRemoveTableCatalog,
  sslForced,
  validationErrors,
  clearValidationErrors,
}: DatabaseConnectionFormProps) => {
  const parameters = dbModel?.parameters as {
    properties: {
      [key: string]: {
        default?: any;
        description?: string;
      };
    };
    required?: string[];
  };

  return (
    <Form>
      <div
        // @ts-ignore
        css={(theme: SupersetTheme) => [
          formScrollableStyles,
          validatedFormStyles(theme),
        ]}
      >
        {parameters &&
          FormFieldOrder.filter(
            (key: string) =>
              Object.keys(parameters.properties).includes(key) ||
              key === 'database_name',
          ).map(field =>
            FORM_FIELD_MAP[field]({
              required: parameters.required?.includes(field),
              changeMethods: {
                onParametersChange,
                onChange,
                onQueryChange,
                onParametersUploadFileChange,
                onAddTableCatalog,
                onRemoveTableCatalog,
                onExtraInputChange,
                onEncryptedExtraInputChange,
              },
              validationErrors,
              getValidation,
              clearValidationErrors,
              db,
              key: field,
              field,
              default_value: parameters.properties[field]?.default,
              description: parameters.properties[field]?.description,
              isEditMode,
              sslForced,
              editNewDb,
              placeholder: getPlaceholder ? getPlaceholder(field) : undefined,
            }),
          )}
      </div>
    </Form>
  );
};
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
