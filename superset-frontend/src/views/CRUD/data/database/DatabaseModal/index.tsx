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
import {
  t,
  SupersetTheme,
  FeatureFlag,
  isFeatureEnabled,
} from '@superset-ui/core';
import React, {
  FunctionComponent,
  useEffect,
  useState,
  useReducer,
  Reducer,
} from 'react';
import Tabs from 'src/components/Tabs';
import { Select } from 'src/common/components';
import Alert from 'src/components/Alert';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import IconButton from 'src/components/IconButton';
import InfoTooltip from 'src/components/InfoTooltip';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import {
  testDatabaseConnection,
  useSingleViewResource,
  useAvailableDatabases,
  useDatabaseValidation,
  getDatabaseImages,
  getConnectionAlert,
} from 'src/views/CRUD/hooks';
import { useCommonConf } from 'src/views/CRUD/data/database/state';
import {
  DatabaseObject,
  DatabaseForm,
  CONFIGURATION_METHOD,
} from 'src/views/CRUD/data/database/types';
import Loading from 'src/components/Loading';
import ExtraOptions from './ExtraOptions';
import SqlAlchemyForm from './SqlAlchemyForm';
import DatabaseConnectionForm from './DatabaseConnectionForm';
import {
  antDErrorAlertStyles,
  antDAlertStyles,
  StyledAlertMargin,
  antDModalNoPaddingStyles,
  antDModalStyles,
  antDTabsStyles,
  buttonLinkStyles,
  alchemyButtonLinkStyles,
  TabHeader,
  formHelperStyles,
  formStyles,
  StyledAlignment,
  SelectDatabaseStyles,
  infoTooltip,
  StyledFooterButton,
  StyledStickyHeader,
} from './styles';
import ModalHeader, { DOCUMENTATION_LINK } from './ModalHeader';

const errorAlertMapping = {
  CONNECTION_MISSING_PARAMETERS_ERROR: {
    message: 'Missing Required Fields',
    description: 'Please complete all required fields.',
  },
  CONNECTION_INVALID_HOSTNAME_ERROR: {
    message: 'Could not verify the host',
    description:
      'The host is invalid. Please verify that this field is entered correctly.',
  },
  CONNECTION_PORT_CLOSED_ERROR: {
    message: 'Port is closed',
    description: 'Please verify that port is open to connect.',
  },
  CONNECTION_INVALID_PORT_ERROR: {
    message: 'Invalid Port Number',
    description: 'The port must be a whole number less than or equal to 65535.',
  },
  CONNECTION_ACCESS_DENIED_ERROR: {
    message: 'Invalid account information',
    description: 'Either the username or password is incorrect.',
  },
  CONNECTION_INVALID_PASSWORD_ERROR: {
    message: 'Invalid account information',
    description: 'Either the username or password is incorrect.',
  },
  INVALID_PAYLOAD_SCHEMA: {
    message: 'Incorrect Fields',
    description: 'Please make sure all fields are filled out correctly',
  },
};
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
        database_name?: string;
        engine?: string;
        configuration_method: CONFIGURATION_METHOD;
      };
    }
  | {
      type: ActionType.reset;
    }
  | {
      type: ActionType.configMethodChange;
      payload: {
        database_name?: string;
        engine?: string;
        configuration_method: CONFIGURATION_METHOD;
      };
    };

function dbReducer(
  state: Partial<DatabaseObject> | null,
  action: DBReducerActionType,
): Partial<DatabaseObject> | null {
  const trimmedState = {
    ...(state || {}),
  };
  let query = '';
  switch (action.type) {
    case ActionType.extraEditorChange:
      return {
        ...trimmedState,
        extra_json: {
          ...trimmedState.extra_json,
          [action.payload.name]: action.payload.json,
        },
      };
    case ActionType.extraInputChange:
      if (
        action.payload.name === 'schema_cache_timeout' ||
        action.payload.name === 'table_cache_timeout'
      ) {
        return {
          ...trimmedState,
          extra_json: {
            ...trimmedState.extra_json,
            metadata_cache_timeout: {
              ...trimmedState.extra_json?.metadata_cache_timeout,
              [action.payload.name]: action.payload.value,
            },
          },
        };
      }
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
      // convert all the keys in this payload into strings
      // eslint-disable-next-line no-case-declarations
      let deserializeExtraJSON = {};
      if (action.payload.extra) {
        const extra_json = {
          ...JSON.parse(action.payload.extra || ''),
        } as DatabaseObject['extra_json'];

        deserializeExtraJSON = {
          ...JSON.parse(action.payload.extra || ''),
          metadata_params: JSON.stringify(extra_json?.metadata_params),
          engine_params: JSON.stringify(extra_json?.engine_params),
          schemas_allowed_for_csv_upload: JSON.stringify(
            extra_json?.schemas_allowed_for_csv_upload,
          ),
        };
      }

      if (action.payload?.parameters?.query) {
        // convert query into URI params string
        query = new URLSearchParams(
          action.payload.parameters.query as string,
        ).toString();
      }

      if (
        action.payload.backend === 'bigquery' &&
        action.payload.configuration_method ===
          CONFIGURATION_METHOD.DYNAMIC_FORM
      ) {
        return {
          ...action.payload,
          engine: action.payload.backend,
          configuration_method: action.payload.configuration_method,
          extra_json: deserializeExtraJSON,
          parameters: {
            query,
            credentials_info: JSON.stringify(
              action.payload?.parameters?.credentials_info || '',
            ),
          },
        };
      }

      return {
        ...action.payload,
        encrypted_extra: action.payload.encrypted_extra || '',
        engine: action.payload.backend || trimmedState.engine,
        configuration_method: action.payload.configuration_method,
        extra_json: deserializeExtraJSON,
        parameters: {
          ...action.payload.parameters,
          query,
        },
      };
    case ActionType.dbSelected:
      return {
        ...action.payload,
      };
    case ActionType.configMethodChange:
      return {
        ...action.payload,
      };
    case ActionType.reset:
    default:
      return null;
  }
}

const DEFAULT_TAB_KEY = '1';

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
  const [
    validationErrors,
    getValidation,
    setValidationErrors,
  ] = useDatabaseValidation();
  const [hasConnectedDb, setHasConnectedDb] = useState<boolean>(false);
  const [dbName, setDbName] = useState('');
  const [editNewDb, setEditNewDb] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const conf = useCommonConf();
  const dbImages = getDatabaseImages();
  const connectionAlert = getConnectionAlert();
  const isEditMode = !!databaseId;
  const sslForced = isFeatureEnabled(
    FeatureFlag.FORCE_DATABASE_CONNECTIONS_SSL,
  );
  const useSqlAlchemyForm =
    db?.configuration_method === CONFIGURATION_METHOD.SQLALCHEMY_URI;
  const useTabLayout = isEditMode || useSqlAlchemyForm;

  // Database fetch logic
  const {
    state: { loading: dbLoading, resource: dbFetched, error: dbErrors },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );

  const isDynamic = (engine: string | undefined) =>
    availableDbs?.databases.filter(
      (DB: DatabaseObject) => DB.backend === engine || DB.engine === engine,
    )[0].parameters !== undefined;
  const showDBError = validationErrors || dbErrors;
  const isEmpty = (data?: Object | null) =>
    data && Object.keys(data).length === 0;

  const dbModel: DatabaseForm =
    availableDbs?.databases?.find(
      (available: { engine: string | undefined }) =>
        // TODO: we need a centralized engine in one place
        available.engine === (isEditMode ? db?.backend : db?.engine),
    ) || {};

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
      encrypted_extra: db?.encrypted_extra || '',
      server_cert: db?.server_cert || undefined,
    };

    testDatabaseConnection(connection, addDangerToast, addSuccessToast);
  };

  const onClose = () => {
    setDB({ type: ActionType.reset });
    setHasConnectedDb(false);
    setValidationErrors(null); // reset validation errors on close
    setEditNewDb(false);
    onHide();
  };

  const onSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...update } = db || {};

    // Clone DB object
    const dbToUpdate = JSON.parse(JSON.stringify(update));

    if (dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM) {
      // Validate DB before saving
      await getValidation(dbToUpdate, true);
      if (validationErrors && !isEmpty(validationErrors)) {
        return;
      }

      if (dbToUpdate?.parameters?.query) {
        // convert query params into dictionary
        dbToUpdate.parameters.query = JSON.parse(
          `{"${decodeURI((dbToUpdate?.parameters?.query as string) || '')
            .replace(/"/g, '\\"')
            .replace(/&/g, '","')
            .replace(/=/g, '":"')}"}`,
        );
      } else if (dbToUpdate?.parameters?.query === '') {
        dbToUpdate.parameters.query = {};
      }

      const engine = dbToUpdate.backend || dbToUpdate.engine;
      if (engine === 'bigquery' && dbToUpdate.parameters?.credentials_info) {
        // wrap encrypted_extra in credentials_info only for BigQuery
        if (
          dbToUpdate.parameters?.credentials_info &&
          typeof dbToUpdate.parameters?.credentials_info === 'object' &&
          dbToUpdate.parameters?.credentials_info.constructor === Object
        ) {
          // Don't cast if object
          dbToUpdate.encrypted_extra = JSON.stringify({
            credentials_info: dbToUpdate.parameters?.credentials_info,
          });

          // Convert credentials info string before updating
          dbToUpdate.parameters.credentials_info = JSON.stringify(
            dbToUpdate.parameters.credentials_info,
          );
        } else {
          dbToUpdate.encrypted_extra = JSON.stringify({
            credentials_info: JSON.parse(
              dbToUpdate.parameters?.credentials_info,
            ),
          });
        }
      }
    }

    if (dbToUpdate?.extra_json) {
      // convert extra_json to back to string
      dbToUpdate.extra = JSON.stringify({
        ...dbToUpdate.extra_json,
        metadata_params: JSON.parse(
          (dbToUpdate?.extra_json?.metadata_params as string) || '{}',
        ),
        engine_params: JSON.parse(
          (dbToUpdate?.extra_json?.engine_params as string) || '{}',
        ),
        schemas_allowed_for_csv_upload:
          (dbToUpdate?.extra_json?.schemas_allowed_for_csv_upload as string) ||
          '[]',
      });
    }

    if (db?.id) {
      setLoading(true);
      const result = await updateResource(
        db.id as number,
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM, // onShow toast on SQLA Forms
      );
      if (result) {
        if (onDatabaseAdd) {
          onDatabaseAdd();
        }
        if (!editNewDb) {
          onClose();
        }
      }
    } else if (db) {
      // Create
      setLoading(true);
      const dbId = await createResource(
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM, // onShow toast on SQLA Forms
      );
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
    setEditNewDb(false);
    setLoading(false);
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

  const setDatabaseModel = (engine: string) => {
    const selectedDbModel = availableDbs?.databases.filter(
      (db: DatabaseObject) => db.engine === engine,
    )[0];
    const { name, parameters } = selectedDbModel;
    const isDynamic = parameters !== undefined;
    setDB({
      type: ActionType.dbSelected,
      payload: {
        database_name: name,
        configuration_method: isDynamic
          ? CONFIGURATION_METHOD.DYNAMIC_FORM
          : CONFIGURATION_METHOD.SQLALCHEMY_URI,
        engine,
      },
    });
  };

  const renderAvailableSelector = () => (
    <div className="available">
      <h4 className="available-label">
        Or choose from a list of other databases we support:
      </h4>
      <div className="control-label">Supported databases</div>
      <Select
        className="available-select"
        onChange={setDatabaseModel}
        placeholder="Choose a database..."
      >
        {availableDbs?.databases
          ?.sort((a: DatabaseForm, b: DatabaseForm) =>
            a.name.localeCompare(b.name),
          )
          .map((database: DatabaseForm) => (
            <Select.Option value={database.engine} key={database.engine}>
              {database.name}
            </Select.Option>
          ))}
      </Select>
      <Alert
        showIcon
        closable={false}
        css={(theme: SupersetTheme) => antDAlertStyles(theme)}
        type="info"
        message={
          connectionAlert?.ADD_DATABASE?.message ||
          t('Want to add a new database?')
        }
        description={
          connectionAlert?.ADD_DATABASE ? (
            <>
              Any databases that allow connections via SQL Alchemy URIs can be
              added.{' '}
              <a
                href={connectionAlert?.ADD_DATABASE.contact_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {connectionAlert?.ADD_DATABASE.contact_description_link}
              </a>{' '}
              {connectionAlert?.ADD_DATABASE.description}
            </>
          ) : (
            <>
              Any databases that allow connections via SQL Alchemy URIs can be
              added. Learn about how to connect a database driver{' '}
              <a
                href={DOCUMENTATION_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                here
              </a>
              .
            </>
          )
        }
      />
    </div>
  );

  const renderPreferredSelector = () => (
    <div className="preferred">
      {availableDbs?.databases
        ?.filter((db: DatabaseForm) => db.preferred)
        .map((database: DatabaseForm) => (
          <IconButton
            className="preferred-item"
            onClick={() => setDatabaseModel(database.engine)}
            buttonText={database.name}
            icon={dbImages?.[database.engine]}
          />
        ))}
    </div>
  );

  const handleBackButtonOnFinish = () => {
    if (dbFetched) {
      fetchResource(dbFetched.id as number);
    }
    setEditNewDb(true);
  };

  const handleBackButtonOnConnect = () => {
    if (editNewDb) {
      setHasConnectedDb(false);
    }
    setDB({ type: ActionType.reset });
  };

  const renderModalFooter = () => {
    if (db) {
      // if db show back + connenct
      if (!hasConnectedDb || editNewDb) {
        return (
          <>
            <StyledFooterButton key="back" onClick={handleBackButtonOnConnect}>
              Back
            </StyledFooterButton>
            <StyledFooterButton
              key="submit"
              buttonStyle="primary"
              onClick={onSave}
            >
              Connect
            </StyledFooterButton>
          </>
        );
      }

      return (
        <>
          <StyledFooterButton key="back" onClick={handleBackButtonOnFinish}>
            Back
          </StyledFooterButton>
          <StyledFooterButton
            key="submit"
            buttonStyle="primary"
            onClick={onSave}
            data-test="modal-confirm-button"
          >
            Finish
          </StyledFooterButton>
        </>
      );
    }
    return [];
  };

  const renderEditModalFooter = () => (
    <>
      <StyledFooterButton key="close" onClick={onClose}>
        Close
      </StyledFooterButton>
      <StyledFooterButton key="submit" buttonStyle="primary" onClick={onSave}>
        Finish
      </StyledFooterButton>
    </>
  );
  useEffect(() => {
    if (show) {
      setTabKey(DEFAULT_TAB_KEY);
      getAvailableDbs();
      setLoading(true);
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

  useEffect(() => {
    if (isLoading) {
      setLoading(false);
    }
  }, [availableDbs]);

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  const errorAlert = () => {
    if (
      isEmpty(dbErrors) ||
      (isEmpty(validationErrors) &&
        !(validationErrors?.error_type in errorAlertMapping))
    ) {
      return <></>;
    }

    if (validationErrors) {
      return (
        <Alert
          type="error"
          css={(theme: SupersetTheme) => antDErrorAlertStyles(theme)}
          message={
            errorAlertMapping[validationErrors?.error_type]?.message ||
            validationErrors?.error_type
          }
          description={
            errorAlertMapping[validationErrors?.error_type]?.description ||
            JSON.stringify(validationErrors)
          }
          showIcon
          closable={false}
        />
      );
    }

    const message: Array<string> = Object.values(dbErrors);
    return (
      <Alert
        type="error"
        css={(theme: SupersetTheme) => antDErrorAlertStyles(theme)}
        message="Database Creation Error"
        description={message[0]}
      />
    );
  };

  const renderFinishState = () => {
    if (!editNewDb) {
      return (
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
      );
    }
    return (
      <DatabaseConnectionForm
        isEditMode
        sslForced={sslForced}
        dbModel={dbModel}
        db={db as DatabaseObject}
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
    );
  };

  return useTabLayout ? (
    <Modal
      css={(theme: SupersetTheme) => [
        antDTabsStyles,
        antDModalNoPaddingStyles,
        antDModalStyles(theme),
        formHelperStyles(theme),
        formStyles(theme),
      ]}
      name="database"
      data-test="database-modal"
      onHandledPrimaryAction={onSave}
      onHide={onClose}
      primaryButtonName={isEditMode ? t('Save') : t('Connect')}
      width="500px"
      centered
      show={show}
      title={
        <h4>{isEditMode ? t('Edit database') : t('Connect a database')}</h4>
      }
      footer={isEditMode ? renderEditModalFooter() : renderModalFooter()}
    >
      <StyledStickyHeader>
        <TabHeader>
          <ModalHeader
            isLoading={isLoading}
            isEditMode={isEditMode}
            useSqlAlchemyForm={useSqlAlchemyForm}
            hasConnectedDb={hasConnectedDb}
            db={db}
            dbName={dbName}
            dbModel={dbModel}
          />
        </TabHeader>
      </StyledStickyHeader>
      <Tabs
        defaultActiveKey={DEFAULT_TAB_KEY}
        activeKey={tabKey}
        onTabClick={tabChange}
        animated={{ inkBar: true, tabPane: true }}
      >
        <Tabs.TabPane tab={<span>{t('Basic')}</span>} key="1">
          {useSqlAlchemyForm ? (
            <StyledAlignment>
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
                isEditMode={isEditMode}
              />
              {isDynamic(db?.backend || db?.engine) && !isEditMode && (
                <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
                  <Button
                    buttonStyle="link"
                    onClick={() =>
                      setDB({
                        type: ActionType.configMethodChange,
                        payload: {
                          database_name: db?.database_name,
                          configuration_method:
                            CONFIGURATION_METHOD.DYNAMIC_FORM,
                          engine: db?.engine,
                        },
                      })
                    }
                    css={theme => alchemyButtonLinkStyles(theme)}
                  >
                    Connect this database using the dynamic form instead
                  </Button>
                  <InfoTooltip
                    tooltip={t(
                      'Click this link to switch to an alternate form that exposes only the required fields needed to connect this database.',
                    )}
                    viewBox="0 0 24 24"
                  />
                </div>
              )}
            </StyledAlignment>
          ) : (
            <DatabaseConnectionForm
              isEditMode
              sslForced={sslForced}
              dbModel={dbModel}
              db={db as DatabaseObject}
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
          )}
          {!isEditMode && (
            <Alert
              closable={false}
              css={(theme: SupersetTheme) => antDAlertStyles(theme)}
              message="Additional fields may be required"
              showIcon
              description={
                <>
                  Select databases require additional fields to be completed in
                  the Advanced tab to successfully connect the database. Learn
                  what requirements your databases has{' '}
                  <a
                    href={DOCUMENTATION_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="additional-fields-alert-description"
                  >
                    here
                  </a>
                  .
                </>
              }
              type="info"
            />
          )}
        </Tabs.TabPane>
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
              onChange(ActionType.extraEditorChange, payload);
            }}
          />
          {showDBError && errorAlert()}
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
      onHandledPrimaryAction={onSave}
      onHide={onClose}
      primaryButtonName={hasConnectedDb ? t('Finish') : t('Connect')}
      width="500px"
      centered
      show={show}
      title={<h4>{t('Connect a database')}</h4>}
      footer={renderModalFooter()}
    >
      {hasConnectedDb ? (
        <>
          <ModalHeader
            isLoading={isLoading}
            isEditMode={isEditMode}
            useSqlAlchemyForm={useSqlAlchemyForm}
            hasConnectedDb={hasConnectedDb}
            db={db}
            dbName={dbName}
            dbModel={dbModel}
            editNewDb={editNewDb}
          />
          {renderFinishState()}
        </>
      ) : (
        <>
          {/* Step 1 */}
          {!isLoading &&
            (!db ? (
              <SelectDatabaseStyles>
                <ModalHeader
                  isLoading={isLoading}
                  isEditMode={isEditMode}
                  useSqlAlchemyForm={useSqlAlchemyForm}
                  hasConnectedDb={hasConnectedDb}
                  db={db}
                  dbName={dbName}
                  dbModel={dbModel}
                />
                {renderPreferredSelector()}
                {renderAvailableSelector()}
              </SelectDatabaseStyles>
            ) : (
              <>
                <ModalHeader
                  isLoading={isLoading}
                  isEditMode={isEditMode}
                  useSqlAlchemyForm={useSqlAlchemyForm}
                  hasConnectedDb={hasConnectedDb}
                  db={db}
                  dbName={dbName}
                  dbModel={dbModel}
                />
                {connectionAlert && (
                  <StyledAlertMargin>
                    <Alert
                      closable={false}
                      css={(theme: SupersetTheme) => antDAlertStyles(theme)}
                      type="info"
                      showIcon
                      message={t('IP Allowlist')}
                      description={connectionAlert.ALLOWED_IPS}
                    />
                  </StyledAlertMargin>
                )}
                <DatabaseConnectionForm
                  db={db}
                  sslForced={sslForced}
                  dbModel={dbModel}
                  onParametersChange={({
                    target,
                  }: {
                    target: HTMLInputElement;
                  }) =>
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
                <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
                  <Button
                    data-test="sqla-connect-btn"
                    buttonStyle="link"
                    onClick={() =>
                      setDB({
                        type: ActionType.configMethodChange,
                        payload: {
                          engine: db.engine,
                          configuration_method:
                            CONFIGURATION_METHOD.SQLALCHEMY_URI,
                          database_name: db.database_name,
                        },
                      })
                    }
                    css={buttonLinkStyles}
                  >
                    Connect this database with a SQLAlchemy URI string instead
                  </Button>
                  <InfoTooltip
                    tooltip={t(
                      'Click this link to switch to an alternate form that allows you to input the SQLAlchemy URL for this database manually.',
                    )}
                    viewBox="6 4 24 24"
                  />
                </div>
                {/* Step 2 */}
                {showDBError && errorAlert()}
              </>
            ))}
        </>
      )}
      {isLoading && <Loading />}
    </Modal>
  );
};

export default withToasts(DatabaseModal);
