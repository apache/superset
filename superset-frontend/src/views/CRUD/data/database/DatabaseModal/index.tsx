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
} from 'src/views/CRUD/hooks';
import { useCommonConf } from 'src/views/CRUD/data/database/state';
import {
  DatabaseObject,
  DatabaseForm,
  CONFIGURATION_METHOD,
} from 'src/views/CRUD/data/database/types';
import ExtraOptions from './ExtraOptions';
import SqlAlchemyForm from './SqlAlchemyForm';

import DatabaseConnectionForm from './DatabaseConnectionForm';
import {
  antDAlertStyles,
  antDModalNoPaddingStyles,
  antDModalStyles,
  antDTabsStyles,
  buttonLinkStyles,
  CreateHeader,
  CreateHeaderSubtitle,
  CreateHeaderTitle,
  EditHeader,
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
        parameters: { engine?: string };
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
    database_name: state?.database_name?.trim() || '',
    sqlalchemy_uri: state?.sqlalchemy_uri || '',
  };

  switch (action.type) {
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
      return {
        parameters: {
          engine: trimmedState.parameters?.engine,
        },
        configuration_method: trimmedState.configuration_method,
        ...action.payload,
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
  const [hasConnectedDb, setHasConnectedDb] = useState<boolean>(false);
  const conf = useCommonConf();

  const isEditMode = !!databaseId;
  const useSqlAlchemyForm =
    db?.configuration_method === CONFIGURATION_METHOD.SQLALCHEMY_URI;

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
      impersonate_user: db?.impersonate_user || undefined,
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

  const onSave = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...update } = db || {};
    if (db?.id) {
      if (db.sqlalchemy_uri) {
        // don't pass parameters if using the sqlalchemy uri
        delete update.parameters;
      }
      updateResource(db.id as number, update as DatabaseObject).then(result => {
        if (result) {
          if (onDatabaseAdd) {
            onDatabaseAdd();
          }
          onClose();
        }
      });
    } else if (db) {
      // Create
      createResource(update as DatabaseObject).then(dbId => {
        if (dbId) {
          setHasConnectedDb(true);
          if (onDatabaseAdd) {
            onDatabaseAdd();
          }
        }
      });
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
          parameters: {},
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
    }
  }, [dbFetched]);

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  const dbModel: DatabaseForm =
    availableDbs?.databases?.find(
      (available: { engine: string | undefined }) =>
        available.engine === db?.parameters?.engine,
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

  return isEditMode || useSqlAlchemyForm ? (
    <Modal
      css={(theme: SupersetTheme) => [
        antDTabsStyles,
        antDModalStyles(theme),
        antDModalNoPaddingStyles,
        formHelperStyles(theme),
      ]}
      name="database"
      disablePrimaryButton={disableSave}
      height="600px"
      onHandledPrimaryAction={onSave}
      onHide={onClose}
      primaryButtonName={isEditMode ? t('Save') : t('Connect')}
      width="500px"
      show={show}
      title={
        <h4>{isEditMode ? t('Edit database') : t('Connect a database')}</h4>
      }
    >
      {isEditMode ? (
        <EditHeader>
          <EditHeaderTitle>{db?.backend}</EditHeaderTitle>
          <EditHeaderSubtitle>{db?.database_name}</EditHeaderSubtitle>
        </EditHeader>
      ) : (
        <CreateHeader>
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
        </CreateHeader>
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
