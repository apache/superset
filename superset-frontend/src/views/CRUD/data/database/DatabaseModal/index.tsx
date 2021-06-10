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
import { t, SupersetTheme } from '@superset-ui/core';
import React, {
  FunctionComponent,
  useEffect,
  useState,
  useReducer,
  Reducer,
} from 'react';
import Tabs from 'src/components/Tabs';
import { Alert } from 'src/common/components';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import {
  testDatabaseConnection,
  useSingleViewResource,
  useAvailableDatabases,
  useDatabaseValidation,
} from 'src/views/CRUD/hooks';
import { useCommonConf } from 'src/views/CRUD/data/database/state';
import {
  DatabaseObject,
  DatabaseForm,
  CONFIGURATION_METHOD,
} from 'src/views/CRUD/data/database/types';
import { typeOf } from 'mathjs';
import ExtraOptions from './ExtraOptions';
import SqlAlchemyForm from './SqlAlchemyForm';

import DatabaseConnectionForm from './DatabaseConnectionForm';
import {
  antDAlertStyles,
  antDModalNoPaddingStyles,
  antDModalStyles,
  antDTabsStyles,
  buttonLinkStyles,
  TabHeader,
  CreateHeaderSubtitle,
  CreateHeaderTitle,
  EditHeaderSubtitle,
  EditHeaderTitle,
  formHelperStyles,
  formStyles,
  StyledBasicTab,
} from './styles';

const DOCUMENTATION_LINK =
  'https://superset.apache.org/docs/databases/installing-database-drivers';

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  databaseId: number | undefined; // If included, will go into edit mode
}

enum ActionType {
  configMethodChange,
  dbSelected,
  editorChange,
  fetched,
  inputChange,
  parametersChange,
  reset,
  textChange,
  extraInputChange,
  extraEditorChange,
}

interface DBReducerPayloadType {
  target?: string;
  name: string;
  json?: {};
  type?: string;
  checked?: boolean;
  value?: string;
}

type DBReducerActionType =
  | {
      type:
        | ActionType.extraEditorChange
        | ActionType.extraInputChange
        | ActionType.textChange
        | ActionType.inputChange
        | ActionType.editorChange
        | ActionType.parametersChange;
      payload: DBReducerPayloadType;
    }
  | {
      type: ActionType.fetched;
      payload: Partial<DatabaseObject>;
    }
  | {
      type: ActionType.dbSelected;
      payload: {
        engine?: string;
        configuration_method: CONFIGURATION_METHOD;
      };
    }
  | {
      type: ActionType.reset;
    }
  | {
      type: ActionType.configMethodChange;
      payload: { configuration_method: CONFIGURATION_METHOD };
    };

function dbReducer(
  state: Partial<DatabaseObject> | null,
  action: DBReducerActionType,
): Partial<DatabaseObject> | null {
  const trimmedState = {
    ...(state || {}),
  };

  switch (action.type) {
    case ActionType.extraEditorChange:
      console.log(
        'trimmedState.extra_json',
        typeOf(trimmedState.extra_json?.metadata_params),
      );
      return {
        ...trimmedState,
        extra_json: {
          ...trimmedState.extra_json,
          [action.payload.name]: action.payload.json,
        },
      };
    case ActionType.extraInputChange:
      return {
        ...trimmedState,
        extra_json: {
          ...trimmedState.extra_json,
          [action.payload.name]:
            action.payload.type === 'checkbox'
              ? action.payload.checked
              : action.payload.value,
        },
      };
    case ActionType.inputChange:
      if (action.payload.type === 'checkbox') {
        return {
          ...trimmedState,
          [action.payload.name]: action.payload.checked,
        };
      }
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case ActionType.parametersChange:
      return {
        ...trimmedState,
        parameters: {
          ...trimmedState.parameters,
          [action.payload.name]: action.payload.value,
        },
      };
    case ActionType.editorChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.json,
      };
    case ActionType.textChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case ActionType.fetched:
      console.log(action.payload.extra_json);
      return {
        engine: trimmedState.engine,
        configuration_method: trimmedState.configuration_method,
        ...action.payload,
        extra_json: {
          ...JSON.parse(action.payload.extra || ''),
        },
      };
    case ActionType.dbSelected:
    case ActionType.configMethodChange:
      return {
        ...action.payload,
      };
    case ActionType.reset:
    default:
      return {};
  }
}

const DEFAULT_TAB_KEY = '1';
const FALSY_FORM_VALUES = [undefined, null, ''];

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  databaseId,
}) => {
  const [db, setDB] = useReducer<
    Reducer<Partial<DatabaseObject> | null, DBReducerActionType>
  >(dbReducer, null);
  const [tabKey, setTabKey] = useState<string>(DEFAULT_TAB_KEY);
  const [availableDbs, getAvailableDbs] = useAvailableDatabases();
  const [validationErrors, getValidation] = useDatabaseValidation();
  const [hasConnectedDb, setHasConnectedDb] = useState<boolean>(false);
  const [dbName, setDbName] = useState('');
  const conf = useCommonConf();

  const isEditMode = !!databaseId;
  const useSqlAlchemyForm =
    db?.configuration_method === CONFIGURATION_METHOD.SQLALCHEMY_URI;
  const useTabLayout = isEditMode || useSqlAlchemyForm;

  // Database fetch logic
  const {
    state: { loading: dbLoading, resource: dbFetched },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );

  // Test Connection logic
  const testConnection = () => {
    if (!db?.sqlalchemy_uri) {
      addDangerToast(t('Please enter a SQLAlchemy URI to test'));
      return;
    }

    const connection = {
      sqlalchemy_uri: db?.sqlalchemy_uri || '',
      database_name: db?.database_name?.trim() || undefined,
      impersonate_user: db?.extra_json?.impersonate_user || undefined,
      extra: db?.extra || undefined,
      encrypted_extra: db?.encrypted_extra || undefined,
      server_cert: db?.server_cert || undefined,
    };

    testDatabaseConnection(connection, addDangerToast, addSuccessToast);
  };

  const onClose = () => {
    setDB({ type: ActionType.reset });
    setHasConnectedDb(false);
    onHide();
  };

  const onSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...update } = db || {};
    if (db?.id) {
      if (db.sqlalchemy_uri) {
        // don't pass parameters if using the sqlalchemy uri
        delete update.parameters;
      }

      // const extraValues = {
      //   metadata_cache_timeout: {
      //     schema_cache_timeout:
      //       db?.extra_json?.metadata_cache_timeout?.schema_cache_timeout || '',
      //     table_cache_timeout:
      //       db?.extra_json?.metadata_cache_timeout?.table_cache_timeout || '',
      //   },
      //   cost_query_enabled: db?.extra_json?.cost_query_enabled || undefined,
      //   allows_virtual_table_explore:
      //     db?.extra_json?.allows_virtual_table_explore || undefined,
      //   schemas_allowed_for_csv_upload:
      //     db?.extra_json?.schemas_allowed_for_csv_upload || '',
      //   impersonate_user: db?.extra_json?.impersonate_user || undefined,
      //   allow_csv_upload: db?.extra_json?.allow_csv_upload || undefined,
      //   version: db?.extra_json?.version || '',
      //   metadata_params: db?.extra_json?.metadata_params || {},
      //   engine_params: db?.extra_json?.engine_params || {},
      // };

      // console.log('extraValues', extraValues);

      // Structure extra_json
      // const extraValuesStructured = {
      //   ...extraValues,
      //   ...db?.extra_json,
      // };

      // console.log('extraValuesStructured', extraValuesStructured);

      console.log(
        'db?.extra_json',
        JSON.parse(db?.extra_json?.metadata_params),
      );

      const updateExtraMDP = JSON.parse(db?.extra_json?.metadata_params);
      // update?.extra_json?.metadata_params = updateExtraMDP;
      console.log(updateExtraMDP);

      // Add values back to extra field
      update.extra = JSON.stringify(
        { ...db?.extra_json, metadata_params: updateExtraMDP },
        null,
        '  ',
      );
      console.log('update.extra', update.extra);

      const result = await updateResource(
        db.id as number,
        update as DatabaseObject,
      );
      if (result) {
        if (onDatabaseAdd) {
          onDatabaseAdd();
        }
        onClose();
      }
    } else if (db) {
      // Create
      const dbId = await createResource(update as DatabaseObject);
      if (dbId) {
        setHasConnectedDb(true);
        if (onDatabaseAdd) {
          onDatabaseAdd();
        }
        if (useTabLayout) {
          // tab layout only has one step
          // so it should close immediately on save
          onClose();
        }
      }
    }
  };

  const onChange = (type: any, payload: any) => {
    setDB({ type, payload } as DBReducerActionType);
  };

  // Initialize
  const fetchDB = () => {
    if (isEditMode && databaseId) {
      if (!dbLoading) {
        fetchResource(databaseId).catch(e =>
          addDangerToast(
            t(
              'Sorry there was an error fetching database information: %s',
              e.message,
            ),
          ),
        );
      }
    }
  };

  useEffect(() => {
    if (show) {
      setTabKey(DEFAULT_TAB_KEY);
      getAvailableDbs();
      setDB({
        type: ActionType.dbSelected,
        payload: {
          configuration_method: CONFIGURATION_METHOD.SQLALCHEMY_URI,
        }, // todo hook this up to step 1
      });
    }
    if (databaseId && show) {
      fetchDB();
    }
  }, [show, databaseId]);

  useEffect(() => {
    if (dbFetched) {
      setDB({
        type: ActionType.fetched,
        payload: dbFetched,
      });
      // keep a copy of the name separate for display purposes
      // because it shouldn't change when the form is updated
      setDbName(dbFetched.database_name);
    }
  }, [dbFetched]);

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  const dbModel: DatabaseForm =
    availableDbs?.databases?.find(
      (available: { engine: string | undefined }) =>
        available.engine === db?.engine,
    ) || {};

  const disableSave =
    !hasConnectedDb &&
    (useSqlAlchemyForm
      ? !(db?.database_name?.trim() && db?.sqlalchemy_uri)
      : // disable the button if there is no dbModel.parameters or if
        // any required fields are falsy
        !dbModel?.parameters ||
        !!dbModel.parameters.required.filter(field =>
          FALSY_FORM_VALUES.includes(db?.parameters?.[field]),
        ).length);

  return useTabLayout ? (
    <Modal
      css={(theme: SupersetTheme) => [
        antDTabsStyles,
        antDModalStyles(theme),
        antDModalNoPaddingStyles,
        formHelperStyles(theme),
      ]}
      name="database"
      disablePrimaryButton={disableSave}
      data-test="database-modal"
      height="600px"
      onHandledPrimaryAction={onSave}
      onHide={onClose}
      primaryButtonName={isEditMode ? t('Finish') : t('Connect')}
      width="500px"
      show={show}
      title={
        <h4>{isEditMode ? t('Edit database') : t('Connect a database')}</h4>
      }
    >
      {isEditMode ? (
        <TabHeader>
          <EditHeaderTitle>{db?.backend}</EditHeaderTitle>
          <EditHeaderSubtitle>{dbName}</EditHeaderSubtitle>
        </TabHeader>
      ) : (
        <TabHeader>
          <CreateHeaderTitle>Enter Primary Credentials</CreateHeaderTitle>
          <CreateHeaderSubtitle>
            Need help? Learn how to connect your database{' '}
            <a
              href={DOCUMENTATION_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              here
            </a>
            .
          </CreateHeaderSubtitle>
        </TabHeader>
      )}
      <hr />
      <Tabs
        defaultActiveKey={DEFAULT_TAB_KEY}
        activeKey={tabKey}
        onTabClick={tabChange}
        animated={{ inkBar: true, tabPane: true }}
      >
        <StyledBasicTab tab={<span>{t('Basic')}</span>} key="1">
          {useSqlAlchemyForm ? (
            <SqlAlchemyForm
              db={db as DatabaseObject}
              onInputChange={({ target }: { target: HTMLInputElement }) =>
                onChange(ActionType.inputChange, {
                  type: target.type,
                  name: target.name,
                  checked: target.checked,
                  value: target.value,
                })
              }
              conf={conf}
              testConnection={testConnection}
            />
          ) : (
            <div>
              <p>TODO: form</p>
            </div>
          )}
          <Alert
            css={(theme: SupersetTheme) => antDAlertStyles(theme)}
            message="Additional fields may be required"
            description={
              <>
                Select databases require additional fields to be completed in
                the Advanced tab to successfully connect the database. Learn
                what requirements your databases has{' '}
                <a
                  href={DOCUMENTATION_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  here
                </a>
                .
              </>
            }
            type="info"
            showIcon
          />
        </StyledBasicTab>
        <Tabs.TabPane tab={<span>{t('Advanced')}</span>} key="2">
          <ExtraOptions
            db={db as DatabaseObject}
            onInputChange={({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.inputChange, {
                type: target.type,
                name: target.name,
                checked: target.checked,
                value: target.value,
              })
            }
            onTextChange={({ target }: { target: HTMLTextAreaElement }) =>
              onChange(ActionType.textChange, {
                name: target.name,
                value: target.value,
              })
            }
            onEditorChange={(payload: { name: string; json: any }) =>
              onChange(ActionType.editorChange, payload)
            }
            onExtraInputChange={({ target }: { target: HTMLInputElement }) => {
              onChange(ActionType.extraInputChange, {
                type: target.type,
                name: target.name,
                checked: target.checked,
                value: target.value,
              });
            }}
            onExtraEditorChange={(payload: { name: string; json: any }) => {
              console.log('payload in onExtraEditorChange', payload);
              onChange(ActionType.extraEditorChange, payload);
            }}
          />
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  ) : (
    <Modal
      css={(theme: SupersetTheme) => [
        antDModalNoPaddingStyles,
        antDModalStyles(theme),
        formHelperStyles(theme),
        formStyles(theme),
      ]}
      name="database"
      disablePrimaryButton={disableSave}
      height="600px"
      onHandledPrimaryAction={onSave}
      onHide={onClose}
      primaryButtonName={hasConnectedDb ? t('Finish') : t('Connect')}
      width="500px"
      show={show}
      title={<h4>{t('Connect a database')}</h4>}
    >
      {hasConnectedDb ? (
        <ExtraOptions
          db={db as DatabaseObject}
          onInputChange={({ target }: { target: HTMLInputElement }) =>
            onChange(ActionType.inputChange, {
              type: target.type,
              name: target.name,
              checked: target.checked,
              value: target.value,
            })
          }
          onTextChange={({ target }: { target: HTMLTextAreaElement }) =>
            onChange(ActionType.textChange, {
              name: target.name,
              value: target.value,
            })
          }
          onEditorChange={(payload: { name: string; json: any }) =>
            onChange(ActionType.editorChange, payload)
          }
          onExtraInputChange={({ target }: { target: HTMLInputElement }) => {
            onChange(ActionType.extraInputChange, {
              type: target.type,
              name: target.name,
              checked: target.checked,
              value: target.value,
            });
          }}
          onExtraEditorChange={(payload: { name: string; json: any }) =>
            onChange(ActionType.extraEditorChange, payload)
          }
        />
      ) : (
        <>
          <DatabaseConnectionForm
            dbModel={dbModel}
            onParametersChange={({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.parametersChange, {
                type: target.type,
                name: target.name,
                checked: target.checked,
                value: target.value,
              })
            }
            onChange={({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.textChange, {
                name: target.name,
                value: target.value,
              })
            }
            getValidation={() => getValidation(db)}
            validationErrors={validationErrors}
          />
          <Button
            buttonStyle="link"
            onClick={() =>
              setDB({
                type: ActionType.configMethodChange,
                payload: {
                  configuration_method: CONFIGURATION_METHOD.SQLALCHEMY_URI,
                },
              })
            }
            css={buttonLinkStyles}
          >
            Connect this database with a SQLAlchemy URI string instead
          </Button>
        </>
      )}
    </Modal>
  );
};

export default withToasts(DatabaseModal);
