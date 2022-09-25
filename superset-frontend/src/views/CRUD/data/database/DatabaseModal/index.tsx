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
  styled,
  SupersetTheme,
  FeatureFlag,
  isFeatureEnabled,
} from '@superset-ui/core';
import React, {
  FunctionComponent,
  useEffect,
  useRef,
  useState,
  useReducer,
  Reducer,
} from 'react';
import { setItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface';
import Tabs from 'src/components/Tabs';
import { AntdSelect, Upload } from 'src/components';
import Alert from 'src/components/Alert';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import IconButton from 'src/components/IconButton';
import InfoTooltip from 'src/components/InfoTooltip';
import withToasts from 'src/components/MessageToasts/withToasts';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import ErrorAlert from 'src/components/ImportModal/ErrorAlert';
import {
  testDatabaseConnection,
  useSingleViewResource,
  useAvailableDatabases,
  useDatabaseValidation,
  getDatabaseImages,
  getConnectionAlert,
  useImportResource,
} from 'src/views/CRUD/hooks';
import { useCommonConf } from 'src/views/CRUD/data/database/state';
import {
  DatabaseObject,
  DatabaseForm,
  CONFIGURATION_METHOD,
  CatalogObject,
  Engines,
} from 'src/views/CRUD/data/database/types';
import Loading from 'src/components/Loading';
import ExtraOptions from './ExtraOptions';
import SqlAlchemyForm from './SqlAlchemyForm';
import DatabaseConnectionForm from './DatabaseConnectionForm';
import {
  antDAlertStyles,
  antdWarningAlertStyles,
  StyledAlertMargin,
  antDModalNoPaddingStyles,
  antDModalStyles,
  antDTabsStyles,
  buttonLinkStyles,
  importDbButtonLinkStyles,
  alchemyButtonLinkStyles,
  TabHeader,
  formHelperStyles,
  formStyles,
  StyledAlignment,
  SelectDatabaseStyles,
  infoTooltip,
  StyledFooterButton,
  StyledStickyHeader,
  formScrollableStyles,
  StyledUploadWrapper,
} from './styles';
import ModalHeader, { DOCUMENTATION_LINK } from './ModalHeader';

const engineSpecificAlertMapping = {
  [Engines.GSheet]: {
    message: 'Why do I need to create a database?',
    description:
      'To begin using your Google Sheets, you need to create a database first. ' +
      'Databases are used as a way to identify ' +
      'your data so that it can be queried and visualized. This ' +
      'database will hold all of your individual Google Sheets ' +
      'you choose to connect here.',
  },
};

const TabsStyled = styled(Tabs)`
  .ant-tabs-content {
    display: flex;
    width: 100%;
    overflow: inherit;

    & > .ant-tabs-tabpane {
      position: relative;
    }
  }
`;

const ErrorAlertContainer = styled.div`
  ${({ theme }) => `
    margin: ${theme.gridUnit * 8}px ${theme.gridUnit * 4}px;
  `};
`;

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

const StyledBtns = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  margin-left: ${({ theme }) => theme.gridUnit * 3}px;
`;

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
          ...deserializeExtraJSON,
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
        action.payload.masked_encrypted_extra &&
        action.payload.configuration_method ===
          CONFIGURATION_METHOD.DYNAMIC_FORM
      ) {
        const engineParamsCatalog = Object.entries(
          extra_json?.engine_params?.catalog || {},
        ).map(([key, value]) => ({
          name: key,
          value,
        }));
        return {
          ...action.payload,
          engine: action.payload.backend || trimmedState.engine,
          configuration_method: action.payload.configuration_method,
          extra_json: deserializeExtraJSON,
          catalog: engineParamsCatalog,
          parameters: action.payload.parameters || trimmedState.parameters,
          query_input,
        };
      }
      return {
        ...action.payload,
        masked_encrypted_extra: action.payload.masked_encrypted_extra || '',
        engine: action.payload.backend || trimmedState.engine,
        configuration_method: action.payload.configuration_method,
        extra_json: deserializeExtraJSON,
        parameters: action.payload.parameters || trimmedState.parameters,
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
    engine_params: JSON.parse((extraJson?.engine_params as string) || '{}'),
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

  const [tabKey, setTabKey] = useState<string>(DEFAULT_TAB_KEY);
  const [availableDbs, getAvailableDbs] = useAvailableDatabases();
  const [validationErrors, getValidation, setValidationErrors] =
    useDatabaseValidation();
  const [hasConnectedDb, setHasConnectedDb] = useState<boolean>(false);
  const [showCTAbtns, setShowCTAbtns] = useState(false);
  const [dbName, setDbName] = useState('');
  const [editNewDb, setEditNewDb] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [testInProgress, setTestInProgress] = useState<boolean>(false);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [confirmedOverwrite, setConfirmedOverwrite] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importingModal, setImportingModal] = useState<boolean>(false);
  const [importingErrorMessage, setImportingErrorMessage] = useState<string>();
  const [passwordFields, setPasswordFields] = useState<string[]>([]);

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
  const isDynamic = (engine: string | undefined) =>
    availableDbs?.databases?.find(
      (DB: DatabaseObject) => DB.backend === engine || DB.engine === engine,
    )?.parameters !== undefined;
  const showDBError = validationErrors || dbErrors;
  const isEmpty = (data?: Object | null) =>
    !data || (data && Object.keys(data).length === 0);

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
      masked_encrypted_extra: db?.masked_encrypted_extra || '',
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

  const getPlaceholder = (field: string) => {
    if (field === 'database') {
      switch (db?.engine) {
        case Engines.Snowflake:
          return t('e.g. xy12345.us-east-2.aws');
        default:
          return t('e.g. world_population');
      }
    }
    return undefined;
  };

  const removeFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    return false;
  };

  const onClose = () => {
    setDB({ type: ActionType.reset });
    setHasConnectedDb(false);
    setValidationErrors(null); // reset validation errors on close
    clearError();
    setEditNewDb(false);
    setFileList([]);
    setImportingModal(false);
    setImportingErrorMessage('');
    setPasswordFields([]);
    setPasswords({});
    setConfirmedOverwrite(false);
    onHide();
  };

  // Database import logic
  const {
    state: {
      alreadyExists,
      passwordsNeeded,
      loading: importLoading,
      failed: importErrored,
    },
    importResource,
  } = useImportResource('database', t('database'), msg => {
    setImportingErrorMessage(msg);
  });

  const onChange = (type: any, payload: any) => {
    setDB({ type, payload } as DBReducerActionType);
  };

  const onSave = async () => {
    // Clone DB object
    const dbToUpdate = JSON.parse(JSON.stringify(db || {}));

    if (dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM) {
      // Validate DB before saving
      const errors = await getValidation(dbToUpdate, true);
      if ((validationErrors && !isEmpty(validationErrors)) || errors) {
        return;
      }
      const parameters_schema = isEditMode
        ? dbToUpdate.parameters_schema.properties
        : dbModel?.parameters.properties;
      const additionalEncryptedExtra = JSON.parse(
        dbToUpdate.masked_encrypted_extra || '{}',
      );
      const paramConfigArray = Object.keys(parameters_schema || {});

      paramConfigArray.forEach(paramConfig => {
        /*
         * Parameters that are annotated with the `x-encrypted-extra` properties should be
         * moved to `masked_encrypted_extra`, so that they are stored encrypted in the
         * backend when the database is created or edited.
         */
        if (
          parameters_schema[paramConfig]['x-encrypted-extra'] &&
          dbToUpdate.parameters?.[paramConfig]
        ) {
          if (typeof dbToUpdate.parameters?.[paramConfig] === 'object') {
            // add new encrypted extra to masked_encrypted_extra object
            additionalEncryptedExtra[paramConfig] =
              dbToUpdate.parameters?.[paramConfig];
            // The backend expects `masked_encrypted_extra` as a string for historical
            // reasons.
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
      dbToUpdate.masked_encrypted_extra = JSON.stringify(
        additionalEncryptedExtra,
      );
      // this needs to be added by default to gsheets
      if (dbToUpdate.engine === Engines.GSheet) {
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

    setLoading(true);
    if (db?.id) {
      const result = await updateResource(
        db.id as number,
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM, // onShow toast on SQLA Forms
      );
      if (result) {
        if (onDatabaseAdd) onDatabaseAdd();
        if (!editNewDb) {
          onClose();
          addSuccessToast(t('Database settings updated'));
        }
      }
    } else if (db) {
      // Create
      const dbId = await createResource(
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === CONFIGURATION_METHOD.DYNAMIC_FORM, // onShow toast on SQLA Forms
      );
      if (dbId) {
        setHasConnectedDb(true);
        if (onDatabaseAdd) onDatabaseAdd();
        if (useTabLayout) {
          // tab layout only has one step
          // so it should close immediately on save
          onClose();
          addSuccessToast(t('Database connected'));
        }
      }
    } else {
      // Import - doesn't use db state
      setImportingModal(true);

      if (!(fileList[0].originFileObj instanceof File)) {
        return;
      }

      const dbId = await importResource(
        fileList[0].originFileObj,
        passwords,
        confirmedOverwrite,
      );
      if (dbId) {
        if (onDatabaseAdd) onDatabaseAdd();
        onClose();
        addSuccessToast(t('Database connected'));
      }
    }

    setShowCTAbtns(true);
    setEditNewDb(false);
    setLoading(false);
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
            key={`${database.name}`}
          />
        ))}
    </div>
  );

  const handleBackButtonOnFinish = () => {
    if (dbFetched) {
      fetchResource(dbFetched.id as number);
    }
    setShowCTAbtns(false);
    setEditNewDb(true);
  };

  const handleBackButtonOnConnect = () => {
    if (editNewDb) setHasConnectedDb(false);
    if (importingModal) setImportingModal(false);
    if (importErrored) {
      setImportingModal(false);
      setImportingErrorMessage('');
      setPasswordFields([]);
      setPasswords({});
    }
    setDB({ type: ActionType.reset });
    setFileList([]);
  };

  const handleDisableOnImport = () => {
    if (
      importLoading ||
      (alreadyExists.length && !confirmedOverwrite) ||
      (passwordsNeeded.length && JSON.stringify(passwords) === '{}')
    )
      return true;
    return false;
  };

  const renderModalFooter = () => {
    if (db) {
      // if db show back + connect
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

    // Import doesn't use db state, so footer will not render in the if statement above
    if (importingModal) {
      return (
        <>
          <StyledFooterButton key="back" onClick={handleBackButtonOnConnect}>
            {t('Back')}
          </StyledFooterButton>
          <StyledFooterButton
            key="submit"
            buttonStyle="primary"
            onClick={onSave}
            disabled={handleDisableOnImport()}
          >
            {t('Connect')}
          </StyledFooterButton>
        </>
      );
    }

    return <></>;
  };

  const renderEditModalFooter = (db: Partial<DatabaseObject> | null) => (
    <>
      <StyledFooterButton key="close" onClick={onClose}>
        {t('Close')}
      </StyledFooterButton>
      <StyledFooterButton
        key="submit"
        buttonStyle="primary"
        onClick={onSave}
        disabled={db?.is_managed_externally}
        tooltip={
          db?.is_managed_externally
            ? t(
                "This database is managed externally, and can't be edited in Superset",
              )
            : ''
        }
      >
        {t('Finish')}
      </StyledFooterButton>
    </>
  );

  const firstUpdate = useRef(true); // Captures first render
  // Only runs when importing files don't need user input
  useEffect(() => {
    // Will not run on first render
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }

    if (
      !importLoading &&
      !alreadyExists.length &&
      !passwordsNeeded.length &&
      !isLoading && // This prevents a double toast for non-related imports
      !importErrored // This prevents a success toast on error
    ) {
      onClose();
      addSuccessToast(t('Database connected'));
    }
  }, [alreadyExists, passwordsNeeded, importLoading, importErrored]);

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

  // This forces the modal to scroll until the importing filename is in view
  useEffect(() => {
    if (importingModal) {
      document
        .getElementsByClassName('ant-upload-list-item-name')[0]
        .scrollIntoView();
    }
  }, [importingModal]);

  useEffect(() => {
    setPasswordFields([...passwordsNeeded]);
  }, [passwordsNeeded]);

  const onDbImport = async (info: UploadChangeParam) => {
    setImportingErrorMessage('');
    setPasswordFields([]);
    setPasswords({});
    setImportingModal(true);
    setFileList([
      {
        ...info.file,
        status: 'done',
      },
    ]);

    if (!(info.file.originFileObj instanceof File)) return;
    const dbId = await importResource(
      info.file.originFileObj,
      passwords,
      confirmedOverwrite,
    );
    if (dbId) onDatabaseAdd?.();
  };

  const passwordNeededField = () => {
    if (!passwordFields.length) return null;

    return passwordFields.map(database => (
      <>
        <StyledAlertMargin>
          <Alert
            closable={false}
            css={(theme: SupersetTheme) => antDAlertStyles(theme)}
            type="info"
            showIcon
            message="Database passwords"
            description={t(
              `The passwords for the databases below are needed in order to import them. Please note that the "Secure Extra" and "Certificate" sections of the database configuration are not present in explore files and should be added manually after the import if they are needed.`,
            )}
          />
        </StyledAlertMargin>
        <ValidatedInput
          id="password_needed"
          name="password_needed"
          required
          value={passwords[database]}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setPasswords({ ...passwords, [database]: event.target.value })
          }
          validationMethods={{ onBlur: () => {} }}
          errorMessage={validationErrors?.password_needed}
          label={t('%s PASSWORD', database.slice(10))}
          css={formScrollableStyles}
        />
      </>
    ));
  };

  const importingErrorAlert = () => {
    if (!importingErrorMessage) return null;

    return (
      <StyledAlertMargin>
        <ErrorAlert
          errorMessage={importingErrorMessage}
          showDbInstallInstructions={passwordFields.length > 0}
        />
      </StyledAlertMargin>
    );
  };

  const confirmOverwrite = (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetValue = (event.currentTarget?.value as string) ?? '';
    setConfirmedOverwrite(targetValue.toUpperCase() === t('OVERWRITE'));
  };

  const confirmOverwriteField = () => {
    if (!alreadyExists.length) return null;

    return (
      <>
        <StyledAlertMargin>
          <Alert
            closable={false}
            css={(theme: SupersetTheme) => antdWarningAlertStyles(theme)}
            type="warning"
            showIcon
            message=""
            description={t(
              'You are importing one or more databases that already exist. Overwriting might cause you to lose some of your work. Are you sure you want to overwrite?',
            )}
          />
        </StyledAlertMargin>
        <ValidatedInput
          id="confirm_overwrite"
          name="confirm_overwrite"
          required
          validationMethods={{ onBlur: () => {} }}
          errorMessage={validationErrors?.confirm_overwrite}
          label={t(`TYPE "OVERWRITE" TO CONFIRM`)}
          onChange={confirmOverwrite}
          css={formScrollableStyles}
        />
      </>
    );
  };

  const tabChange = (key: string) => setTabKey(key);

  const renderStepTwoAlert = () => {
    const { hostname } = window.location;
    let ipAlert = connectionAlert?.REGIONAL_IPS?.default || '';
    const regionalIPs = connectionAlert?.REGIONAL_IPS || {};
    Object.entries(regionalIPs).forEach(([ipRegion, ipRange]) => {
      const regex = new RegExp(ipRegion);
      if (hostname.match(regex)) ipAlert = ipRange;
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

  // eslint-disable-next-line consistent-return
  const errorAlert = () => {
    let alertErrors: string[] = [];
    if (!isEmpty(dbErrors)) {
      alertErrors = typeof dbErrors === 'object' ? Object.values(dbErrors) : [];
    } else if (!isEmpty(validationErrors)) {
      alertErrors =
        validationErrors?.error_type === 'GENERIC_DB_ENGINE_ERROR'
          ? [
              'We are unable to connect to your database. Click "See more" for database-provided information that may help troubleshoot the issue.',
            ]
          : [];
    }

    if (alertErrors.length) {
      return (
        <ErrorMessageWithStackTrace
          title={t('Database Creation Error')}
          description={alertErrors[0]}
          subtitle={validationErrors?.description}
          copyText={validationErrors?.description}
        />
      );
    }
    return <></>;
  };

  const fetchAndSetDB = () => {
    setLoading(true);
    fetchResource(dbFetched?.id as number).then(r => {
      setItem(LocalStorageKeys.db, r);
    });
  };

  const renderCTABtns = () => (
    <StyledBtns>
      <Button
        // eslint-disable-next-line no-return-assign
        buttonStyle="secondary"
        onClick={() => {
          setLoading(true);
          fetchAndSetDB();
          window.location.href = '/tablemodelview/list#create';
        }}
      >
        {t('CREATE DATASET')}
      </Button>
      <Button
        buttonStyle="secondary"
        // eslint-disable-next-line no-return-assign
        onClick={() => {
          setLoading(true);
          fetchAndSetDB();
          window.location.href = `/superset/sqllab/?db=true`;
        }}
      >
        {t('QUERY DATA IN SQL LAB')}
      </Button>
    </StyledBtns>
  );

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

  if (fileList.length > 0 && (alreadyExists.length || passwordFields.length)) {
    return (
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
        primaryButtonName={t('Connect')}
        width="500px"
        centered
        show={show}
        title={<h4>{t('Connect a database')}</h4>}
        footer={renderModalFooter()}
      >
        <ModalHeader
          isLoading={isLoading}
          isEditMode={isEditMode}
          useSqlAlchemyForm={useSqlAlchemyForm}
          hasConnectedDb={hasConnectedDb}
          db={db}
          dbName={dbName}
          dbModel={dbModel}
          fileList={fileList}
        />
        {passwordNeededField()}
        {confirmOverwriteField()}
        {importingErrorAlert()}
      </Modal>
    );
  }
  const modalFooter = isEditMode
    ? renderEditModalFooter(db)
    : renderModalFooter();
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
      footer={modalFooter}
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
      <TabsStyled
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
          {showDBError && (
            <ErrorAlertContainer>{errorAlert()}</ErrorAlertContainer>
          )}
        </Tabs.TabPane>
      </TabsStyled>
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
      {!isLoading && hasConnectedDb ? (
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
          {showCTAbtns && renderCTABtns()}
          {renderFinishState()}
        </>
      ) : (
        <>
          {/* Dynamic Form Step 1 */}
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
                <StyledUploadWrapper>
                  <Upload
                    name="databaseFile"
                    id="databaseFile"
                    data-test="database-file-input"
                    accept=".yaml,.json,.yml,.zip"
                    customRequest={() => {}}
                    onChange={onDbImport}
                    onRemove={removeFile}
                  >
                    <Button
                      data-test="import-database-btn"
                      buttonStyle="link"
                      type="link"
                      css={importDbButtonLinkStyles}
                    >
                      {t('Import database from file')}
                    </Button>
                  </Upload>
                </StyledUploadWrapper>
                {importingErrorAlert()}
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
                  getPlaceholder={getPlaceholder}
                />
                <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
                  {dbModel.engine !== Engines.GSheet && (
                    <>
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
                    </>
                  )}
                </div>
                {/* Step 2 */}
                {showDBError && (
                  <ErrorAlertContainer>{errorAlert()}</ErrorAlertContainer>
                )}
              </>
            ))}
        </>
      )}
      {isLoading && <Loading />}
    </Modal>
  );
};

export default withToasts(DatabaseModal);
