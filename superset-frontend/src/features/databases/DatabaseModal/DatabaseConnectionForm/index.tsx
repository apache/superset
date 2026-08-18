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
import { useEffect, useState } from 'react';
import { SupersetTheme } from '@apache-superset/core/theme';
import { Form } from '@superset-ui/core/components';
import { FormFieldOrder, FORM_FIELD_MAP } from './constants';
import { formScrollableStyles, validatedFormStyles } from '../styles';
import {
  DatabaseConnectionFormProps,
  DatabaseObject,
  Engines,
} from '../../types';

export const computeInitialIsPublic = (
  database: Partial<DatabaseObject> | null | undefined,
): boolean => {
  if (!database || database.engine !== Engines.GSheet) return true;
  if (
    database.masked_encrypted_extra &&
    database.masked_encrypted_extra !== '{}'
  ) {
    return false;
  }
  if (database.parameters?.service_account_info) return false;
  // OAuth2-only gsheets connections store creds under
  // `parameters.oauth2_client_info` rather than (or in addition to)
  // `masked_encrypted_extra` during edit; respect that too.
  if (
    (database.parameters as { oauth2_client_info?: unknown })
      ?.oauth2_client_info
  ) {
    return false;
  }
  return true;
};

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
  onClearEncryptedExtraKey,
  onParametersChange,
  onParametersUploadFileChange,
  onQueryChange,
  onRemoveTableCatalog,
  sslForced,
  validationErrors,
  clearValidationErrors,
  isValidating,
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

  const [isPublic, setIsPublic] = useState<boolean>(() =>
    computeInitialIsPublic(db),
  );

  // Re-derive when switching to a different database, when the engine
  // changes, or when any of the credential fields read by
  // computeInitialIsPublic arrive async on edit load. The setter is a no-op
  // when the result is unchanged, so over-running this effect is harmless.
  useEffect(() => {
    setIsPublic(computeInitialIsPublic(db));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `db` identity
    // alone churns on every reducer dispatch; the dep list below tracks each
    // field that computeInitialIsPublic actually reads.
  }, [db?.id, db?.engine, db?.masked_encrypted_extra, db?.parameters]);

  return (
    <Form>
      <div
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
          ).map(field => {
            // Render as JSX so each field's hooks live on its own fiber.
            // Calling the component as a function (e.g. FORM_FIELD_MAP[field]({...}))
            // makes the field's hooks register against this parent's fiber and
            // breaks the rules of hooks once the parent owns its own state.
            // @ts-expect-error TODO: fix ComponentClass for SSHTunnelSwitchComponent not having call signature.
            const FieldComponent = FORM_FIELD_MAP[field];
            return (
              <FieldComponent
                key={field}
                required={parameters.required?.includes(field)}
                changeMethods={{
                  onParametersChange,
                  onChange,
                  onQueryChange,
                  onParametersUploadFileChange,
                  onAddTableCatalog,
                  onRemoveTableCatalog,
                  onExtraInputChange,
                  onEncryptedExtraInputChange,
                  onClearEncryptedExtraKey,
                }}
                validationErrors={validationErrors}
                getValidation={getValidation}
                clearValidationErrors={clearValidationErrors}
                db={db}
                field={field}
                default_value={parameters.properties[field]?.default}
                description={parameters.properties[field]?.description}
                isEditMode={isEditMode}
                sslForced={sslForced}
                editNewDb={editNewDb}
                isValidating={isValidating}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                placeholder={getPlaceholder ? getPlaceholder(field) : undefined}
              />
            );
          })}
      </div>
    </Form>
  );
};
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
