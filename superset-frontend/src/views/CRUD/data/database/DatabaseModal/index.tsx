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
import { AntdSelect } from 'src/components';
import Alert from 'src/components/Alert';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import IconButton from 'src/components/IconButton';
import InfoTooltip from 'src/components/InfoTooltip';
import withToasts from 'src/components/MessageToasts/withToasts';
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
  CatalogObject,
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

const engineSpecificAlertMapping = {
  gsheets: {
    message: 'Why do I need to create a database?',
    description:
      'To begin using your Google Sheets, you need to create a database first. ' +
      'Databases are used as a way to identify ' +
      'your data so that it can be queried and visualized. This ' +
      'database will hold all of your individual Google Sheets ' +
      'you choose to connect here.',
  },
};

const errorAlertMapping = {
  CONNECTION_MISSING_PARAMETERS_ERROR: {
    message: t('Missing Required Fields'),
    description: t('Please complete all required fields.'),
  },
  CONNECTION_INVALID_HOSTNAME_ERROR: {
    message: t('Could not verify the host'),
    description: t(
      'The host is invalid. Please verify that this field is entered correctly.',
    ),
  },
  CONNECTION_PORT_CLOSED_ERROR: {
    message: t('Port is closed'),
    description: t('Please verify that port is open to connect.'),
  },
  CONNECTION_INVALID_PORT_ERROR: {
    message: t('Invalid Port Number'),
    description: t(
      'The port must be a whole number less than or equal to 65535.',
    ),
  },
  CONNECTION_ACCESS_DENIED_ERROR: {
    message: t('Invalid account information'),
    description: t('Either the username or password is incorrect.'),
  },
  CONNECTION_INVALID_PASSWORD_ERROR: {
    message: t('Invalid account information'),
    description: t('Either the username or password is incorrect.'),
  },
  INVALID_PAYLOAD_SCHEMA_ERROR: {
    message: t('Incorrect Fields'),
    description: t('Please make sure all fields are filled out correctly'),
  },
  TABLE_DOES_NOT_EXIST_ERROR: {
    message: t('URL could not be identified'),
    description: t(
      'The URL could not be identified. Please check for typos and make sure that "Type of google sheet allowed" selection matches the input',
    ),
  },
};
interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  databaseId: number | undefined; // If included, will go into edit mode
  dbEngine: string | undefined; // if included goto step 2 with engine already set
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
  addTableCatalogSheet,
  removeTableCatalogSheet,
  queryChange,
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
        | ActionType.queryChange
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
      type: ActionType.reset | ActionType.addTableCatalogSheet;
    }
  | {
      type: ActionType.removeTableCatalogSheet;
      payload: {
        indexToDelete: number;
      };
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
  let query = {};
  let query_input = '';
  let deserializeExtraJSON = { allows_virtual_table_explore: true };
  let extra_json: DatabaseObject['extra_json'];

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
      if (action.payload.name === 'schemas_allowed_for_file_upload') {
        return {
          ...trimmedState,
          extra_json: {
            ...trimmedState.extra_json,
            schemas_allowed_for_file_upload: (action.payload.value || '').split(
              ',',
            ),
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
      if (
        trimmedState.catalog !== undefined &&
        action.payload.type?.startsWith('catalog')
      ) {
        // Formatting wrapping google sheets table catalog
        const idx = action.payload.type?.split('-')[1];
        const catalogToUpdate = trimmedState?.catalog[idx] || {};
        catalogToUpdate[action.payload.name] = action.payload.value;

        const paramatersCatalog = {};
        // eslint-disable-next-line array-callback-return
        trimmedState.catalog?.map((item: CatalogObject) => {
          paramatersCatalog[item.name] = item.value;
        });

        return {
          ...trimmedState,
          parameters: {
            ...trimmedState.parameters,
            catalog: paramatersCatalog,
          },
        };
      }
      return {
        ...trimmedState,
        parameters: {
          ...trimmedState.parameters,
          [action.payload.name]: action.payload.value,
        },
      };
    case ActionType.addTableCatalogSheet:
      if (trimmedState.catalog !== undefined) {
        return {
          ...trimmedState,
          catalog: [...trimmedState.catalog, { name: '', value: '' }],
        };
      }
      return {
        ...trimmedState,
        catalog: [{ name: '', value: '' }],
      };
    case ActionType.removeTableCatalogSheet:
      trimmedState.catalog?.splice(action.payload.indexToDelete, 1);
      return {
        ...trimmedState,
      };
    case ActionType.editorChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.json,
      };
    case ActionType.queryChange:
      return {
        ...trimmedState,
        parameters: {
          ...trimmedState.parameters,
          query: Object.fromEntries(new URLSearchParams(action.payload.value)),
        },
        query_input: action.payload.value,
      };
    case ActionType.textChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case ActionType.fetched:
      // convert all the keys in this payload into strings
      if (action.payload.extra) {
        extra_json = {
          ...JSON.parse(action.payload.extra || ''),
        } as DatabaseObject['extra_json'];

        deserializeExtraJSON = {
          ...JSON.parse(action.payload.extra || ''),
          metadata_params: JSON.stringify(extra_json?.metadata_params),
          engine_params: JSON.stringify(extra_json?.engine_params),
          schemas_allowed_for_file_upload:
            extra_json?.schemas_allowed_for_file_upload,
        };
      }

      // convert query to a string and store in query_input
      query = action.payload?.parameters?.query || {};
      query_input = Object.entries(query)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      if (
        action.payload.encrypted_extra &&
        action.payload.configuration_method ===
          CONFIGURATION_METHOD.DYNAMIC_FORM
      ) {
        const engineParamsCatalog = Object.keys(
          extra_json?.engine_params?.catalog || {},
        ).map(e => ({
          name: e,
          value: extra_json?.engine_params?.catalog[e],
        }));
        return {
          ...action.payload,
          engine: action.payload.backend || trimmedState.engine,
          configuration_method: action.payload.configuration_method,
          extra_json: deserializeExtraJSON,
          catalog: engineParamsCatalog,
          parameters: action.payload.parameters,
          query_input,
        };
      }

      return {
        ...action.payload,
        encrypted_extra: action.payload.encrypted_extra || '',
        engine: action.payload.backend || trimmedState.engine,
        configuration_method: action.payload.configuration_method,
        extra_json: deserializeExtraJSON,
        parameters: action.payload.parameters,
        query_input,
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

const serializeExtra = (extraJson: DatabaseObject['extra_json']) =>
  JSON.stringify({
    ...extraJson,
    metadata_params: JSON.parse((extraJson?.metadata_params as string) || '{}'),
    engine_params: JSON.parse(
      (extraJson?.engine_params as unknown as string) || '{}',
    ),
    schemas_allowed_for_file_upload: (
      extraJson?.schemas_allowed_for_file_upload || []
    ).filter(schema => schema !== ''),
  });

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  databaseId,
  dbEngine,
}) => {
  const [db, setDB] = useReducer<
    Reducer<Partial<DatabaseObject> | null, DBReducerActionType>
  >(dbReducer, null);
  const [tabKey, setTabKey] = useState<string>(DEFAULT_TAB_KEY);
  const [availableDbs, getAvailableDbs] = useAvailableDatabases();
  const [validationErrors, getValidation, setValidationErrors] =
    useDatabaseValidation();
  const [hasConnectedDb, setHasConnectedDb] = useState<boolean>(false);
  const [dbName, setDbName] = useState('');
  const [editNewDb, setEditNewDb] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [testInProgress, setTestInProgress] = useState<boolean>(false);
  const conf = useCommonConf();
  const dbImages = getDatabaseImages();
  const connectionAlert = getConnectionAlert();
  const isEditMode = !!databaseId;
  const sslForced = isFeatureEnabled(
    FeatureFlag.FORCE_DATABASE_CONNECTIONS_SSL,
  );
  const hasAlert =
    connectionAlert || !!(db?.engine && engineSpecificAlertMapping[db.engine]);
  const useSqlAlchemyForm =
    db?.configuration_method === CONFIGURATION_METHOD.SQLALCHEMY_URI;
  const useTabLayout = isEditMode || useSqlAlchemyForm;
  // Database fetch logic
  const {
    state: { loading: dbLoading, resource: dbFetched, error: dbErrors },
    fetchResource,
    createResource,
    updateResource,
    clearError,
  } = useSingleViewResource<DatabaseObject>(
    'database',
    t('database'),
    addDangerToast,
  );
  const isDynamic = (engine: string | undefined) =>
    availableDbs?.databases?.find(
      (DB: DatabaseObject) => DB.backend === engine || DB.engine === engine,
    )?.parameters !== undefined;
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
      extra: serializeExtra(db?.extra_json) || undefined,
      encrypted_extra: db?.encrypted_extra || '',
      server_cert: db?.server_cert || undefined,
    };
    setTestInProgress(true);
    testDatabaseConnection(
      connection,
      (errorMsg: string) => {
        setTestInProgress(false);
        addDangerToast(errorMsg);
      },
      (errorMsg: string) => {
        setTestInProgress(false);
        addSuccessToast(errorMsg);
      },
    );
  };

  const onClose = () => {
    setDB({ type: ActionType.reset });
    setHasConnectedDb(false);
    setValidationErrors(null); // reset validation errors on close
    clearError();
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
      const parameters_schema = isEditMode
        ? dbToUpdate.parameters_schema.properties
        : dbModel?.parameters.properties;
      const additionalEncryptedExtra = JSON.parse(
        dbToUpdate.encrypted_extra || '{}',
      );
      const paramConfigArray = Object.keys(parameters_schema || {});

      paramConfigArray.forEach(paramConfig => {
        /*
         * Parameters that are annotated with the `x-encrypted-extra` properties should be moved to
         * `encrypted_extra`, so that they are stored encrypted in the backend when the database is
         * created or edited.
         */
        if (
          parameters_schema[paramConfig]['x-encrypted-extra'] &&
          dbToUpdate.parameters?.[paramConfig]
        ) {
          if (typeof dbToUpdate.parameters?.[paramConfig] === 'object') {
            // add new encrypted extra to encrypted_extra object
            additionalEncryptedExtra[paramConfig] =
              dbToUpdate.parameters?.[paramConfig];
            // The backend expects `encrypted_extra` as a string for historical reasons.
            dbToUpdate.parameters[paramConfig] = JSON.stringify(
              dbToUpdate.parameters[paramConfig],
            );
          } else {
            additionalEncryptedExtra[paramConfig] = JSON.parse(
              dbToUpdate.parameters?.[paramConfig] || '{}',
            );
          }
        }
      });
      // cast the new encrypted extra object into a string
      dbToUpdate.encrypted_extra = JSON.stringify(additionalEncryptedExtra);
      // this needs to be added by default to gsheets
      if (dbToUpdate.engine === 'gsheets') {
        dbToUpdate.impersonate_user = true;
      }
    }

    if (dbToUpdate?.parameters?.catalog) {
      // need to stringify gsheets catalog to allow it to be seralized
      dbToUpdate.extra_json = {
        engine_params: JSON.stringify({
          catalog: dbToUpdate.parameters.catalog,
        }),
      };
    }

    if (dbToUpdate?.extra_json) {
      // convert extra_json to back to string
      dbToUpdate.extra = serializeExtra(dbToUpdate?.extra_json);
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
          addSuccessToast(t('Database settings updated'));
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
          addSuccessToast(t('Database connected'));
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

  const setDatabaseModel = (database_name: string) => {
    if (database_name === 'Other') {
      // Allow users to connect to DB via legacy SQLA form
      setDB({
        type: ActionType.dbSelected,
        payload: {
          database_name,
          configuration_method: CONFIGURATION_METHOD.SQLALCHEMY_URI,
          engine: undefined,
        },
      });
    } else {
      const selectedDbModel = availableDbs?.databases.filter(
        (db: DatabaseObject) => db.name === database_name,
      )[0];
      const { engine, parameters } = selectedDbModel;
      const isDynamic = parameters !== undefined;
      setDB({
        type: ActionType.dbSelected,
        payload: {
          database_name,
          engine,
          configuration_method: isDynamic
            ? CONFIGURATION_METHOD.DYNAMIC_FORM
            : CONFIGURATION_METHOD.SQLALCHEMY_URI,
        },
      });
    }

    setDB({ type: ActionType.addTableCatalogSheet });
  };

  const renderAvailableSelector = () => (
    <div className="available">
      <h4 className="available-label">
        {t('Or choose from a list of other databases we support:')}
      </h4>
      <div className="control-label">{t('Supported databases')}</div>
      <AntdSelect
        className="available-select"
        onChange={setDatabaseModel}
        placeholder={t('Choose a database...')}
        showSearch
      >
        {[...(availableDbs?.databases || [])]
          ?.sort((a: DatabaseForm, b: DatabaseForm) =>
            a.name.localeCompare(b.name),
          )
          .map((database: DatabaseForm) => (
            <AntdSelect.Option value={database.name} key={database.name}>
              {database.name}
            </AntdSelect.Option>
          ))}
        {/* Allow users to connect to DB via legacy SQLA form */}
        <AntdSelect.Option value="Other" key="Other">
          {t('Other')}
        </AntdSelect.Option>
      </AntdSelect>
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
              {t(
                'Any databases that allow connections via SQL Alchemy URIs can be added. ',
              )}
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
              {t(
                'Any databases that allow connections via SQL Alchemy URIs can be added. Learn about how to connect a database driver ',
              )}
              <a
                href={DOCUMENTATION_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('here')}
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
            onClick={() => setDatabaseModel(database.name)}
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
              {t('Back')}
            </StyledFooterButton>
            <StyledFooterButton
              key="submit"
              buttonStyle="primary"
              onClick={onSave}
            >
              {t('Connect')}
            </StyledFooterButton>
          </>
        );
      }

      return (
        <>
          <StyledFooterButton key="back" onClick={handleBackButtonOnFinish}>
            {t('Back')}
          </StyledFooterButton>
          <StyledFooterButton
            key="submit"
            buttonStyle="primary"
            onClick={onSave}
            data-test="modal-confirm-button"
          >
            {t('Finish')}
          </StyledFooterButton>
        </>
      );
    }
    return [];
  };

  const renderEditModalFooter = () => (
    <>
      <StyledFooterButton key="close" onClick={onClose}>
        {t('Close')}
      </StyledFooterButton>
      <StyledFooterButton key="submit" buttonStyle="primary" onClick={onSave}>
        {t('Finish')}
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

    if (availableDbs && dbEngine) {
      // set model if passed into props
      setDatabaseModel(dbEngine);
    }
  }, [availableDbs]);

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  const renderStepTwoAlert = () => {
    const { hostname } = window.location;
    let ipAlert = connectionAlert?.REGIONAL_IPS?.default || '';
    const regionalIPs = connectionAlert?.REGIONAL_IPS || {};
    Object.entries(regionalIPs).forEach(([ipRegion, ipRange]) => {
      const regex = new RegExp(ipRegion);
      if (hostname.match(regex)) {
        ipAlert = ipRange;
      }
    });
    return (
      db?.engine && (
        <StyledAlertMargin>
          <Alert
            closable={false}
            css={(theme: SupersetTheme) => antDAlertStyles(theme)}
            type="info"
            showIcon
            message={
              engineSpecificAlertMapping[db.engine]?.message ||
              connectionAlert?.DEFAULT?.message
            }
            description={
              engineSpecificAlertMapping[db.engine]?.description ||
              connectionAlert?.DEFAULT?.description + ipAlert
            }
          />
        </StyledAlertMargin>
      )
    );
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
    const message: Array<string> =
      typeof dbErrors === 'object' ? Object.values(dbErrors) : [];
    return (
      <Alert
        type="error"
        css={(theme: SupersetTheme) => antDErrorAlertStyles(theme)}
        message={t('Database Creation Error')}
        description={message?.[0] || dbErrors}
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
        onQueryChange={({ target }: { target: HTMLInputElement }) =>
          onChange(ActionType.queryChange, {
            name: target.name,
            value: target.value,
          })
        }
        onAddTableCatalog={() =>
          setDB({ type: ActionType.addTableCatalogSheet })
        }
        onRemoveTableCatalog={(idx: number) =>
          setDB({
            type: ActionType.removeTableCatalogSheet,
            payload: { indexToDelete: idx },
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
                testInProgress={testInProgress}
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
                    {t('Connect this database using the dynamic form instead')}
                  </Button>
                  <InfoTooltip
                    tooltip={t(
                      'Click this link to switch to an alternate form that exposes only the required fields needed to connect this database.',
                    )}
                    viewBox="0 -6 24 24"
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
              onQueryChange={({ target }: { target: HTMLInputElement }) =>
                onChange(ActionType.queryChange, {
                  name: target.name,
                  value: target.value,
                })
              }
              onAddTableCatalog={() =>
                setDB({ type: ActionType.addTableCatalogSheet })
              }
              onRemoveTableCatalog={(idx: number) =>
                setDB({
                  type: ActionType.removeTableCatalogSheet,
                  payload: { indexToDelete: idx },
                })
              }
              getValidation={() => getValidation(db)}
              validationErrors={validationErrors}
            />
          )}
          {!isEditMode && (
            <StyledAlertMargin>
              <Alert
                closable={false}
                css={(theme: SupersetTheme) => antDAlertStyles(theme)}
                message="Additional fields may be required"
                showIcon
                description={
                  <>
                    {t(
                      'Select databases require additional fields to be completed in the Advanced tab to successfully connect the database. Learn what requirements your databases has ',
                    )}
                    <a
                      href={DOCUMENTATION_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="additional-fields-alert-description"
                    >
                      {t('here')}
                    </a>
                    .
                  </>
                }
                type="info"
              />
            </StyledAlertMargin>
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
          {/* Dyanmic Form Step 1 */}
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
                {hasAlert && renderStepTwoAlert()}
                <DatabaseConnectionForm
                  db={db}
                  sslForced={sslForced}
                  dbModel={dbModel}
                  onAddTableCatalog={() => {
                    setDB({ type: ActionType.addTableCatalogSheet });
                  }}
                  onQueryChange={({ target }: { target: HTMLInputElement }) =>
                    onChange(ActionType.queryChange, {
                      name: target.name,
                      value: target.value,
                    })
                  }
                  onRemoveTableCatalog={(idx: number) => {
                    setDB({
                      type: ActionType.removeTableCatalogSheet,
                      payload: { indexToDelete: idx },
                    });
                  }}
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
                    {t(
                      'Connect this database with a SQLAlchemy URI string instead',
                    )}
                  </Button>
                  <InfoTooltip
                    tooltip={t(
                      'Click this link to switch to an alternate form that allows you to input the SQLAlchemy URL for this database manually.',
                    )}
                    viewBox="0 -6 24 24"
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
