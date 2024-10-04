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
  getExtensionsRegistry,
} from '@superset-ui/core';

import {
  FunctionComponent,
  useEffect,
  useRef,
  useState,
  useReducer,
  Reducer,
  useCallback,
  ChangeEvent,
} from 'react';

import { useHistory } from 'react-router-dom';
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
import { useCommonConf } from 'src/features/databases/state';
import Loading from 'src/components/Loading';
import { isEmpty, pick } from 'lodash';
import {
  DatabaseObject,
  DatabaseForm,
  ConfigurationMethod,
  CatalogObject,
  Engines,
  ExtraJson,
  CustomTextType,
} from '../types';
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
import SSHTunnelForm from './SSHTunnelForm';
import SSHTunnelSwitch from './SSHTunnelSwitch';

const extensionsRegistry = getExtensionsRegistry();

const DEFAULT_EXTRA = JSON.stringify({ allows_virtual_table_explore: true });

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

const SSHTunnelContainer = styled.div`
  ${({ theme }) => `
    padding: 0px ${theme.gridUnit * 4}px;
  `};
`;

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void;
  onHide: () => void;
  show: boolean;
  databaseId: number | undefined; // If included, will go into edit mode
  dbEngine: string | undefined; // if included goto step 2 with engine already set
}

export enum ActionType {
  AddTableCatalogSheet,
  ConfigMethodChange,
  DbSelected,
  EditorChange,
  ExtraEditorChange,
  ExtraInputChange,
  EncryptedExtraInputChange,
  Fetched,
  InputChange,
  ParametersChange,
  QueryChange,
  RemoveTableCatalogSheet,
  Reset,
  TextChange,
  ParametersSSHTunnelChange,
  SetSSHTunnelLoginMethod,
  RemoveSSHTunnelConfig,
}

export enum AuthType {
  Password,
  PrivateKey,
}

interface DBReducerPayloadType {
  target?: string;
  name: string;
  json?: string;
  type?: string;
  checked?: boolean;
  value?: string;
}

export type DBReducerActionType =
  | {
      type:
        | ActionType.ExtraEditorChange
        | ActionType.ExtraInputChange
        | ActionType.EncryptedExtraInputChange
        | ActionType.TextChange
        | ActionType.QueryChange
        | ActionType.InputChange
        | ActionType.EditorChange
        | ActionType.ParametersChange
        | ActionType.ParametersSSHTunnelChange;
      payload: DBReducerPayloadType;
    }
  | {
      type: ActionType.Fetched;
      payload: Partial<DatabaseObject>;
    }
  | {
      type: ActionType.DbSelected;
      payload: {
        database_name?: string;
        engine?: string;
        configuration_method: ConfigurationMethod;
        engine_information?: {};
        driver?: string;
        sqlalchemy_uri_placeholder?: string;
      };
    }
  | {
      type:
        | ActionType.Reset
        | ActionType.RemoveSSHTunnelConfig
        | ActionType.AddTableCatalogSheet;
    }
  | {
      type: ActionType.RemoveTableCatalogSheet;
      payload: {
        indexToDelete: number;
      };
    }
  | {
      type: ActionType.ConfigMethodChange;
      payload: {
        database_name?: string;
        engine?: string;
        configuration_method: ConfigurationMethod;
      };
    }
  | {
      type: ActionType.SetSSHTunnelLoginMethod;
      payload: {
        login_method: AuthType;
      };
    };

const StyledBtns = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  margin-left: ${({ theme }) => theme.gridUnit * 3}px;
`;

export function dbReducer(
  state: Partial<DatabaseObject> | null,
  action: DBReducerActionType,
): Partial<DatabaseObject> | null {
  const trimmedState = {
    ...(state || {}),
  };
  let query = {};
  let query_input = '';
  let parametersCatalog;
  let actionPayloadJson;
  const extraJson: ExtraJson = JSON.parse(trimmedState.extra || '{}');

  switch (action.type) {
    case ActionType.ExtraEditorChange:
      // "extra" payload in state is a string
      try {
        // we don't want to stringify encoded strings twice
        actionPayloadJson = JSON.parse(action.payload.json || '{}');
      } catch (e) {
        actionPayloadJson = action.payload.json;
      }
      return {
        ...trimmedState,
        extra: JSON.stringify({
          ...extraJson,
          [action.payload.name]: actionPayloadJson,
        }),
      };
    case ActionType.EncryptedExtraInputChange:
      return {
        ...trimmedState,
        masked_encrypted_extra: JSON.stringify({
          ...JSON.parse(trimmedState.masked_encrypted_extra || '{}'),
          [action.payload.name]: action.payload.value,
        }),
      };
    case ActionType.ExtraInputChange:
      // "extra" payload in state is a string
      if (
        action.payload.name === 'schema_cache_timeout' ||
        action.payload.name === 'table_cache_timeout'
      ) {
        return {
          ...trimmedState,
          extra: JSON.stringify({
            ...extraJson,
            metadata_cache_timeout: {
              ...extraJson?.metadata_cache_timeout,
              [action.payload.name]: action.payload.value,
            },
          }),
        };
      }
      if (action.payload.name === 'schemas_allowed_for_file_upload') {
        return {
          ...trimmedState,
          extra: JSON.stringify({
            ...extraJson,
            schemas_allowed_for_file_upload: (action.payload.value || '')
              .split(',')
              .filter(schema => schema !== ''),
          }),
        };
      }
      if (action.payload.name === 'http_path') {
        return {
          ...trimmedState,
          extra: JSON.stringify({
            ...extraJson,
            engine_params: {
              connect_args: {
                [action.payload.name]: action.payload.value?.trim(),
              },
            },
          }),
        };
      }
      if (action.payload.name === 'expand_rows') {
        return {
          ...trimmedState,
          extra: JSON.stringify({
            ...extraJson,
            schema_options: {
              ...extraJson?.schema_options,
              [action.payload.name]: !!action.payload.value,
            },
          }),
        };
      }
      return {
        ...trimmedState,
        extra: JSON.stringify({
          ...extraJson,
          [action.payload.name]:
            action.payload.type === 'checkbox'
              ? action.payload.checked
              : action.payload.value,
        }),
      };
    case ActionType.InputChange:
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
    case ActionType.ParametersChange:
      // catalog params will always have a catalog state for
      // dbs that use a catalog, i.e., gsheets, even if the
      // fields are empty strings
      if (
        action.payload.type?.startsWith('catalog') &&
        trimmedState.catalog !== undefined
      ) {
        // Formatting wrapping google sheets table catalog
        const catalogCopy: CatalogObject[] = [...trimmedState.catalog];
        const idx = action.payload.type?.split('-')[1];
        const catalogToUpdate: CatalogObject = catalogCopy[idx] || {};
        catalogToUpdate[action.payload.name] = action.payload.value;

        // insert updated catalog to existing state
        catalogCopy.splice(parseInt(idx, 10), 1, catalogToUpdate);

        // format catalog for state
        // eslint-disable-next-line array-callback-return
        parametersCatalog = catalogCopy.reduce((obj, item: any) => {
          const catalog = { ...obj };
          catalog[item.name] = item.value;
          return catalog;
        }, {});

        return {
          ...trimmedState,
          catalog: catalogCopy,
          parameters: {
            ...trimmedState.parameters,
            catalog: parametersCatalog,
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

    case ActionType.ParametersSSHTunnelChange:
      return {
        ...trimmedState,
        ssh_tunnel: {
          ...trimmedState.ssh_tunnel,
          [action.payload.name]: action.payload.value,
        },
      };
    case ActionType.SetSSHTunnelLoginMethod: {
      let ssh_tunnel = {};
      if (trimmedState?.ssh_tunnel) {
        // remove any attributes that are considered sensitive
        ssh_tunnel = pick(trimmedState.ssh_tunnel, [
          'id',
          'server_address',
          'server_port',
          'username',
        ]);
      }
      if (action.payload.login_method === AuthType.PrivateKey) {
        return {
          ...trimmedState,
          ssh_tunnel: {
            private_key: trimmedState?.ssh_tunnel?.private_key,
            private_key_password:
              trimmedState?.ssh_tunnel?.private_key_password,
            ...ssh_tunnel,
          },
        };
      }
      if (action.payload.login_method === AuthType.Password) {
        return {
          ...trimmedState,
          ssh_tunnel: {
            password: trimmedState?.ssh_tunnel?.password,
            ...ssh_tunnel,
          },
        };
      }
      return {
        ...trimmedState,
      };
    }
    case ActionType.RemoveSSHTunnelConfig:
      return {
        ...trimmedState,
        ssh_tunnel: undefined,
      };
    case ActionType.AddTableCatalogSheet:
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
    case ActionType.RemoveTableCatalogSheet:
      trimmedState.catalog?.splice(action.payload.indexToDelete, 1);
      return {
        ...trimmedState,
      };
    case ActionType.EditorChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.json,
      };
    case ActionType.QueryChange:
      return {
        ...trimmedState,
        parameters: {
          ...trimmedState.parameters,
          query: Object.fromEntries(new URLSearchParams(action.payload.value)),
        },
        query_input: action.payload.value,
      };
    case ActionType.TextChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case ActionType.Fetched:
      // convert query to a string and store in query_input
      query = action.payload?.parameters?.query || {};
      query_input = Object.entries(query)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      if (
        action.payload.masked_encrypted_extra &&
        action.payload.configuration_method === ConfigurationMethod.DynamicForm
      ) {
        // "extra" payload from the api is a string
        const extraJsonPayload: ExtraJson = {
          ...JSON.parse((action.payload.extra as string) || '{}'),
        };

        const payloadCatalog = extraJsonPayload.engine_params?.catalog;

        const engineRootCatalog = Object.entries(payloadCatalog || {}).map(
          ([name, value]: string[]) => ({ name, value }),
        );

        return {
          ...action.payload,
          engine: action.payload.backend || trimmedState.engine,
          configuration_method: action.payload.configuration_method,
          catalog: engineRootCatalog,
          parameters: {
            ...(action.payload.parameters || trimmedState.parameters),
            catalog: payloadCatalog,
          },
          query_input,
        };
      }
      return {
        ...action.payload,
        masked_encrypted_extra: action.payload.masked_encrypted_extra || '',
        engine: action.payload.backend || trimmedState.engine,
        configuration_method: action.payload.configuration_method,
        parameters: action.payload.parameters || trimmedState.parameters,
        ssh_tunnel: action.payload.ssh_tunnel || trimmedState.ssh_tunnel,
        query_input,
      };

    case ActionType.DbSelected:
      // set initial state for blank form
      return {
        ...action.payload,
        extra: DEFAULT_EXTRA,
        expose_in_sqllab: true,
      };
    case ActionType.ConfigMethodChange:
      return {
        ...action.payload,
      };

    case ActionType.Reset:
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
    'connection',
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
  const [sshTunnelPasswords, setSSHTunnelPasswords] = useState<
    Record<string, string>
  >({});
  const [sshTunnelPrivateKeys, setSSHTunnelPrivateKeys] = useState<
    Record<string, string>
  >({});
  const [sshTunnelPrivateKeyPasswords, setSSHTunnelPrivateKeyPasswords] =
    useState<Record<string, string>>({});
  const [confirmedOverwrite, setConfirmedOverwrite] = useState<boolean>(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importingModal, setImportingModal] = useState<boolean>(false);
  const [importingErrorMessage, setImportingErrorMessage] = useState<string>();
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);
  const [extraExtensionComponentState, setExtraExtensionComponentState] =
    useState<object>({});

  const SSHTunnelSwitchComponent =
    extensionsRegistry.get('ssh_tunnel.form.switch') ?? SSHTunnelSwitch;

  const [useSSHTunneling, setUseSSHTunneling] = useState<boolean | undefined>(
    undefined,
  );

  let dbConfigExtraExtension = extensionsRegistry.get(
    'databaseconnection.extraOption',
  );

  if (dbConfigExtraExtension) {
    // add method for db modal to store data
    dbConfigExtraExtension = {
      ...dbConfigExtraExtension,
      onEdit: componentState => {
        setExtraExtensionComponentState({
          ...extraExtensionComponentState,
          ...componentState,
        });
      },
    };
  }

  const conf = useCommonConf();
  const dbImages = getDatabaseImages();
  const connectionAlert = getConnectionAlert();
  const isEditMode = !!databaseId;
  const hasAlert =
    connectionAlert || !!(db?.engine && engineSpecificAlertMapping[db.engine]);
  const useSqlAlchemyForm =
    db?.configuration_method === ConfigurationMethod.SqlalchemyUri;
  const useTabLayout = isEditMode || useSqlAlchemyForm;
  const isDynamic = (engine: string | undefined) =>
    availableDbs?.databases?.find(
      (DB: DatabaseObject) => DB.backend === engine || DB.engine === engine,
    )?.parameters !== undefined;
  const showDBError = validationErrors || dbErrors;
  const history = useHistory();

  const dbModel: DatabaseForm =
    // TODO: we need a centralized engine in one place

    // first try to match both engine and driver
    availableDbs?.databases?.find(
      (available: {
        engine: string | undefined;
        default_driver: string | undefined;
      }) =>
        available.engine === (isEditMode ? db?.backend : db?.engine) &&
        available.default_driver === db?.driver,
    ) ||
    // alternatively try to match only engine
    availableDbs?.databases?.find(
      (available: { engine: string | undefined }) =>
        available.engine === (isEditMode ? db?.backend : db?.engine),
    ) ||
    {};

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
      extra: db?.extra,
      masked_encrypted_extra: db?.masked_encrypted_extra || '',
      server_cert: db?.server_cert || undefined,
      ssh_tunnel:
        !isEmpty(db?.ssh_tunnel) && useSSHTunneling
          ? {
              ...db.ssh_tunnel,
              server_port: Number(db.ssh_tunnel!.server_port),
            }
          : undefined,
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
      return t('e.g. world_population');
    }
    return undefined;
  };

  const removeFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    return false;
  };

  const onChange = useCallback(
    (
      type: DBReducerActionType['type'],
      payload: CustomTextType | DBReducerPayloadType,
    ) => {
      setDB({ type, payload } as DBReducerActionType);
    },
    [],
  );

  const handleClearValidationErrors = useCallback(() => {
    setValidationErrors(null);
  }, [setValidationErrors]);

  const handleParametersChange = useCallback(
    ({ target }: { target: HTMLInputElement }) => {
      onChange(ActionType.ParametersChange, {
        type: target.type,
        name: target.name,
        checked: target.checked,
        value: target.value,
      });
    },
    [onChange],
  );

  const onClose = () => {
    setDB({ type: ActionType.Reset });
    setHasConnectedDb(false);
    handleClearValidationErrors(); // reset validation errors on close
    clearError();
    setEditNewDb(false);
    setFileList([]);
    setImportingModal(false);
    setImportingErrorMessage('');
    setPasswordFields([]);
    setSSHTunnelPasswordFields([]);
    setSSHTunnelPrivateKeyFields([]);
    setSSHTunnelPrivateKeyPasswordFields([]);
    setPasswords({});
    setSSHTunnelPasswords({});
    setSSHTunnelPrivateKeys({});
    setSSHTunnelPrivateKeyPasswords({});
    setConfirmedOverwrite(false);
    setUseSSHTunneling(undefined);
    onHide();
  };

  const redirectURL = (url: string) => {
    history.push(url);
  };

  // Database import logic
  const {
    state: {
      alreadyExists,
      passwordsNeeded,
      sshPasswordNeeded,
      sshPrivateKeyNeeded,
      sshPrivateKeyPasswordNeeded,
      loading: importLoading,
      failed: importErrored,
    },
    importResource,
  } = useImportResource('database', t('database'), msg => {
    setImportingErrorMessage(msg);
  });

  const onSave = async () => {
    let dbConfigExtraExtensionOnSaveError;

    setLoading(true);

    dbConfigExtraExtension
      ?.onSave(extraExtensionComponentState, db)
      .then(({ error }: { error: any }) => {
        if (error) {
          dbConfigExtraExtensionOnSaveError = error;
          addDangerToast(error);
        }
      });

    if (dbConfigExtraExtensionOnSaveError) {
      setLoading(false);
      return;
    }
    // Clone DB object
    const dbToUpdate = { ...(db || {}) };

    if (dbToUpdate.configuration_method === ConfigurationMethod.DynamicForm) {
      // Validate DB before saving
      if (dbToUpdate?.parameters?.catalog) {
        // need to stringify gsheets catalog to allow it to be serialized
        dbToUpdate.extra = JSON.stringify({
          ...JSON.parse(dbToUpdate.extra || '{}'),
          engine_params: {
            catalog: dbToUpdate.parameters.catalog,
          },
        });
      }

      const errors = await getValidation(dbToUpdate, true);
      if (!isEmpty(validationErrors) || errors?.length) {
        addDangerToast(
          t('Connection failed, please check your connection settings.'),
        );
        setLoading(false);
        return;
      }

      const parameters_schema = isEditMode
        ? dbToUpdate.parameters_schema?.properties
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
      // need to stringify gsheets catalog to allow it to be serialized
      dbToUpdate.extra = JSON.stringify({
        ...JSON.parse(dbToUpdate.extra || '{}'),
        engine_params: {
          catalog: dbToUpdate.parameters.catalog,
        },
      });
    }

    // strictly checking for false as an indication that the toggle got unchecked
    if (useSSHTunneling === false) {
      // remove ssh tunnel
      dbToUpdate.ssh_tunnel = null;
    }

    if (db?.id) {
      const result = await updateResource(
        db.id as number,
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === ConfigurationMethod.DynamicForm, // onShow toast on SQLA Forms
      );
      if (result) {
        if (onDatabaseAdd) onDatabaseAdd();
        dbConfigExtraExtension
          ?.onSave(extraExtensionComponentState, db)
          .then(({ error }: { error: any }) => {
            if (error) {
              dbConfigExtraExtensionOnSaveError = error;
              addDangerToast(error);
            }
          });
        if (dbConfigExtraExtensionOnSaveError) {
          setLoading(false);
          return;
        }
        if (!editNewDb) {
          onClose();
          addSuccessToast(t('Database settings updated'));
        }
      }
    } else if (db) {
      // Create
      const dbId = await createResource(
        dbToUpdate as DatabaseObject,
        dbToUpdate.configuration_method === ConfigurationMethod.DynamicForm, // onShow toast on SQLA Forms
      );
      if (dbId) {
        setHasConnectedDb(true);
        if (onDatabaseAdd) onDatabaseAdd();
        dbConfigExtraExtension
          ?.onSave(extraExtensionComponentState, db)
          .then(({ error }: { error: any }) => {
            if (error) {
              dbConfigExtraExtensionOnSaveError = error;
              addDangerToast(error);
            }
          });
        if (dbConfigExtraExtensionOnSaveError) {
          setLoading(false);
          return;
        }

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
        sshTunnelPasswords,
        sshTunnelPrivateKeys,
        sshTunnelPrivateKeyPasswords,
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
        type: ActionType.DbSelected,
        payload: {
          database_name,
          configuration_method: ConfigurationMethod.SqlalchemyUri,
          engine: undefined,
          engine_information: {
            supports_file_upload: true,
          },
        },
      });
    } else {
      const selectedDbModel = availableDbs?.databases.filter(
        (db: DatabaseObject) => db.name === database_name,
      )[0];
      const {
        engine,
        parameters,
        engine_information,
        default_driver,
        sqlalchemy_uri_placeholder,
      } = selectedDbModel;
      const isDynamic = parameters !== undefined;
      setDB({
        type: ActionType.DbSelected,
        payload: {
          database_name,
          engine,
          configuration_method: isDynamic
            ? ConfigurationMethod.DynamicForm
            : ConfigurationMethod.SqlalchemyUri,
          engine_information,
          driver: default_driver,
          sqlalchemy_uri_placeholder,
        },
      });

      if (engine === Engines.GSheet) {
        // only create a catalog if the DB is Google Sheets
        setDB({ type: ActionType.AddTableCatalogSheet });
      }
    }
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
          .map((database: DatabaseForm, index: number) => (
            <AntdSelect.Option value={database.name} key={`database-${index}`}>
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
      setSSHTunnelPasswordFields([]);
      setSSHTunnelPrivateKeyFields([]);
      setSSHTunnelPrivateKeyPasswordFields([]);
      setPasswords({});
      setSSHTunnelPasswords({});
      setSSHTunnelPrivateKeys({});
      setSSHTunnelPrivateKeyPasswords({});
    }
    setDB({ type: ActionType.Reset });
    setFileList([]);
  };

  const handleDisableOnImport = () => {
    if (
      importLoading ||
      (alreadyExists.length && !confirmedOverwrite) ||
      (passwordsNeeded.length && JSON.stringify(passwords) === '{}') ||
      (sshPasswordNeeded.length &&
        JSON.stringify(sshTunnelPasswords) === '{}') ||
      (sshPrivateKeyNeeded.length &&
        JSON.stringify(sshTunnelPrivateKeys) === '{}') ||
      (sshPrivateKeyPasswordNeeded.length &&
        JSON.stringify(sshTunnelPrivateKeyPasswords) === '{}')
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
              loading={isLoading}
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
            loading={isLoading}
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
            loading={isLoading}
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
        loading={isLoading}
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
      !sshPasswordNeeded.length &&
      !sshPrivateKeyNeeded.length &&
      !sshPrivateKeyPasswordNeeded.length &&
      !isLoading && // This prevents a double toast for non-related imports
      !importErrored // This prevents a success toast on error
    ) {
      onClose();
      addSuccessToast(t('Database connected'));
    }
  }, [
    alreadyExists,
    passwordsNeeded,
    importLoading,
    importErrored,
    sshPasswordNeeded,
    sshPrivateKeyNeeded,
    sshPrivateKeyPasswordNeeded,
  ]);

  useEffect(() => {
    if (show) {
      setTabKey(DEFAULT_TAB_KEY);
      setLoading(true);
      getAvailableDbs();
    }
    if (databaseId && show) {
      fetchDB();
    }
  }, [show, databaseId]);

  useEffect(() => {
    if (dbFetched) {
      setDB({
        type: ActionType.Fetched,
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

  useEffect(() => {
    setSSHTunnelPasswordFields([...sshPasswordNeeded]);
  }, [sshPasswordNeeded]);

  useEffect(() => {
    setSSHTunnelPrivateKeyFields([...sshPrivateKeyNeeded]);
  }, [sshPrivateKeyNeeded]);

  useEffect(() => {
    setSSHTunnelPrivateKeyPasswordFields([...sshPrivateKeyPasswordNeeded]);
  }, [sshPrivateKeyPasswordNeeded]);

  useEffect(() => {
    if (db?.parameters?.ssh !== undefined) {
      setUseSSHTunneling(db.parameters.ssh);
    }
  }, [db?.parameters?.ssh]);

  const onDbImport = async (info: UploadChangeParam) => {
    setImportingErrorMessage('');
    setPasswordFields([]);
    setSSHTunnelPasswordFields([]);
    setSSHTunnelPrivateKeyFields([]);
    setSSHTunnelPrivateKeyPasswordFields([]);
    setPasswords({});
    setSSHTunnelPasswords({});
    setSSHTunnelPrivateKeys({});
    setSSHTunnelPrivateKeyPasswords({});
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
      sshTunnelPasswords,
      sshTunnelPrivateKeys,
      sshTunnelPrivateKeyPasswords,
      confirmedOverwrite,
    );
    if (dbId) onDatabaseAdd?.();
  };

  const passwordNeededField = () => {
    if (
      !passwordFields.length &&
      !sshTunnelPasswordFields.length &&
      !sshTunnelPrivateKeyFields.length &&
      !sshTunnelPrivateKeyPasswordFields.length
    )
      return null;

    const files = [
      ...new Set([
        ...passwordFields,
        ...sshTunnelPasswordFields,
        ...sshTunnelPrivateKeyFields,
        ...sshTunnelPrivateKeyPasswordFields,
      ]),
    ];

    return files.map(database => (
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
        {passwordFields?.indexOf(database) >= 0 && (
          <ValidatedInput
            id="password_needed"
            name="password_needed"
            required
            value={passwords[database]}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setPasswords({ ...passwords, [database]: event.target.value })
            }
            validationMethods={{ onBlur: () => {} }}
            errorMessage={validationErrors?.password_needed}
            label={t('%s PASSWORD', database.slice(10))}
            css={formScrollableStyles}
          />
        )}
        {sshTunnelPasswordFields?.indexOf(database) >= 0 && (
          <ValidatedInput
            id="ssh_tunnel_password_needed"
            name="ssh_tunnel_password_needed"
            required
            value={sshTunnelPasswords[database]}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSSHTunnelPasswords({
                ...sshTunnelPasswords,
                [database]: event.target.value,
              })
            }
            validationMethods={{ onBlur: () => {} }}
            errorMessage={validationErrors?.ssh_tunnel_password_needed}
            label={t('%s SSH TUNNEL PASSWORD', database.slice(10))}
            css={formScrollableStyles}
          />
        )}
        {sshTunnelPrivateKeyFields?.indexOf(database) >= 0 && (
          <ValidatedInput
            id="ssh_tunnel_private_key_needed"
            name="ssh_tunnel_private_key_needed"
            required
            value={sshTunnelPrivateKeys[database]}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSSHTunnelPrivateKeys({
                ...sshTunnelPrivateKeys,
                [database]: event.target.value,
              })
            }
            validationMethods={{ onBlur: () => {} }}
            errorMessage={validationErrors?.ssh_tunnel_private_key_needed}
            label={t('%s SSH TUNNEL PRIVATE KEY', database.slice(10))}
            css={formScrollableStyles}
          />
        )}
        {sshTunnelPrivateKeyPasswordFields?.indexOf(database) >= 0 && (
          <ValidatedInput
            id="ssh_tunnel_private_key_password_needed"
            name="ssh_tunnel_private_key_password_needed"
            required
            value={sshTunnelPrivateKeyPasswords[database]}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setSSHTunnelPrivateKeyPasswords({
                ...sshTunnelPrivateKeyPasswords,
                [database]: event.target.value,
              })
            }
            validationMethods={{ onBlur: () => {} }}
            errorMessage={
              validationErrors?.ssh_tunnel_private_key_password_needed
            }
            label={t('%s SSH TUNNEL PRIVATE KEY PASSWORD', database.slice(10))}
            css={formScrollableStyles}
          />
        )}
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

  const confirmOverwrite = (event: ChangeEvent<HTMLInputElement>) => {
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
          label={t('Type "%s" to confirm', t('OVERWRITE'))}
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
      alertErrors =
        typeof dbErrors === 'object'
          ? Object.values(dbErrors)
          : typeof dbErrors === 'string'
            ? [dbErrors]
            : [];
    } else if (
      !isEmpty(validationErrors) &&
      validationErrors?.error_type === 'GENERIC_DB_ENGINE_ERROR'
    ) {
      alertErrors = [
        validationErrors?.description || validationErrors?.message,
      ];
    }
    if (alertErrors.length) {
      return (
        <ErrorAlertContainer>
          <ErrorMessageWithStackTrace
            title={t('Database Creation Error')}
            description={t(
              'We are unable to connect to your database. Click "See more" for database-provided information that may help troubleshoot the issue.',
            )}
            subtitle={alertErrors?.[0] || validationErrors?.description}
            copyText={validationErrors?.description}
          />
        </ErrorAlertContainer>
      );
    }
    return <></>;
  };

  const fetchAndSetDB = () => {
    setLoading(true);
    fetchResource(dbFetched?.id as number).then(r => {
      setItem(LocalStorageKeys.Database, r);
    });
  };

  const renderSSHTunnelForm = () => (
    <SSHTunnelForm
      db={db as DatabaseObject}
      onSSHTunnelParametersChange={({ target }) => {
        onChange(ActionType.ParametersSSHTunnelChange, {
          type: target.type,
          name: target.name,
          value: target.value,
        });
        handleClearValidationErrors();
      }}
      setSSHTunnelLoginMethod={(method: AuthType) =>
        setDB({
          type: ActionType.SetSSHTunnelLoginMethod,
          payload: { login_method: method },
        })
      }
    />
  );

  const renderCTABtns = () => (
    <StyledBtns>
      <Button
        buttonStyle="secondary"
        onClick={() => {
          setLoading(true);
          fetchAndSetDB();
          redirectURL('/dataset/add/');
        }}
      >
        {t('CREATE DATASET')}
      </Button>
      <Button
        buttonStyle="secondary"
        onClick={() => {
          setLoading(true);
          fetchAndSetDB();
          redirectURL(`/sqllab?db=true`);
        }}
      >
        {t('QUERY DATA IN SQL LAB')}
      </Button>
    </StyledBtns>
  );

  const renderDatabaseConnectionForm = () => (
    <>
      <DatabaseConnectionForm
        isEditMode={isEditMode}
        db={db as DatabaseObject}
        sslForced={false}
        dbModel={dbModel}
        onAddTableCatalog={() => {
          setDB({ type: ActionType.AddTableCatalogSheet });
        }}
        onQueryChange={({ target }: { target: HTMLInputElement }) =>
          onChange(ActionType.QueryChange, {
            name: target.name,
            value: target.value,
          })
        }
        onExtraInputChange={({ target }: { target: HTMLInputElement }) =>
          onChange(ActionType.ExtraInputChange, {
            name: target.name,
            value: target.value,
          })
        }
        onEncryptedExtraInputChange={({
          target,
        }: {
          target: HTMLInputElement;
        }) =>
          onChange(ActionType.EncryptedExtraInputChange, {
            name: target.name,
            value: target.value,
          })
        }
        onRemoveTableCatalog={(idx: number) => {
          setDB({
            type: ActionType.RemoveTableCatalogSheet,
            payload: { indexToDelete: idx },
          });
        }}
        onParametersChange={handleParametersChange}
        onChange={({ target }: { target: HTMLInputElement }) =>
          onChange(ActionType.TextChange, {
            name: target.name,
            value: target.value,
          })
        }
        getValidation={() => getValidation(db)}
        validationErrors={validationErrors}
        getPlaceholder={getPlaceholder}
        clearValidationErrors={handleClearValidationErrors}
      />
      {useSSHTunneling && (
        <SSHTunnelContainer>{renderSSHTunnelForm()}</SSHTunnelContainer>
      )}
    </>
  );

  const renderFinishState = () => {
    if (!editNewDb) {
      return (
        <ExtraOptions
          extraExtension={dbConfigExtraExtension}
          db={db as DatabaseObject}
          onInputChange={({ target }: { target: HTMLInputElement }) =>
            onChange(ActionType.InputChange, {
              type: target.type,
              name: target.name,
              checked: target.checked,
              value: target.value,
            })
          }
          onTextChange={({ target }: { target: HTMLTextAreaElement }) =>
            onChange(ActionType.TextChange, {
              name: target.name,
              value: target.value,
            })
          }
          onEditorChange={(payload: { name: string; json: any }) =>
            onChange(ActionType.EditorChange, payload)
          }
          onExtraInputChange={({ target }: { target: HTMLInputElement }) => {
            onChange(ActionType.ExtraInputChange, {
              type: target.type,
              name: target.name,
              checked: target.checked,
              value: target.value,
            });
          }}
          onExtraEditorChange={(payload: { name: string; json: any }) =>
            onChange(ActionType.ExtraEditorChange, payload)
          }
        />
      );
    }
    return renderDatabaseConnectionForm();
  };

  if (
    fileList.length > 0 &&
    (alreadyExists.length ||
      passwordFields.length ||
      sshTunnelPasswordFields.length ||
      sshTunnelPrivateKeyFields.length ||
      sshTunnelPrivateKeyPasswordFields.length)
  ) {
    return (
      <Modal
        centered
        css={(theme: SupersetTheme) => [
          antDModalNoPaddingStyles,
          antDModalStyles(theme),
          formHelperStyles(theme),
          formStyles(theme),
        ]}
        footer={renderModalFooter()}
        maskClosable={false}
        name="database"
        onHide={onClose}
        onHandledPrimaryAction={onSave}
        primaryButtonName={t('Connect')}
        show={show}
        title={<h4>{t('Connect a database')}</h4>}
        width="500px"
      >
        <ModalHeader
          db={db}
          dbName={dbName}
          dbModel={dbModel}
          fileList={fileList}
          hasConnectedDb={hasConnectedDb}
          isEditMode={isEditMode}
          isLoading={isLoading}
          useSqlAlchemyForm={useSqlAlchemyForm}
        />
        {confirmOverwriteField()}
        {importingErrorAlert()}
        {passwordNeededField()}
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
      maskClosable={false}
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
                  onChange(ActionType.InputChange, {
                    type: target.type,
                    name: target.name,
                    checked: target.checked,
                    value: target.value,
                  })
                }
                conf={conf}
                testConnection={testConnection}
                testInProgress={testInProgress}
              >
                <SSHTunnelSwitchComponent
                  dbModel={dbModel}
                  db={db as DatabaseObject}
                  changeMethods={{
                    onParametersChange: handleParametersChange,
                  }}
                  clearValidationErrors={handleClearValidationErrors}
                />
                {useSSHTunneling && renderSSHTunnelForm()}
              </SqlAlchemyForm>
              {isDynamic(db?.backend || db?.engine) && !isEditMode && (
                <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
                  <Button
                    buttonStyle="link"
                    onClick={() =>
                      setDB({
                        type: ActionType.ConfigMethodChange,
                        payload: {
                          database_name: db?.database_name,
                          configuration_method: ConfigurationMethod.DynamicForm,
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
            renderDatabaseConnectionForm()
          )}
          {!isEditMode && (
            <StyledAlertMargin>
              <Alert
                closable={false}
                css={(theme: SupersetTheme) => antDAlertStyles(theme)}
                message={t('Additional fields may be required')}
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
          {showDBError && errorAlert()}
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Advanced')}</span>} key="2">
          <ExtraOptions
            extraExtension={dbConfigExtraExtension}
            db={db as DatabaseObject}
            onInputChange={({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.InputChange, {
                type: target.type,
                name: target.name,
                checked: target.checked,
                value: target.value,
              })
            }
            onTextChange={({ target }: { target: HTMLTextAreaElement }) =>
              onChange(ActionType.TextChange, {
                name: target.name,
                value: target.value,
              })
            }
            onEditorChange={(payload: { name: string; json: any }) =>
              onChange(ActionType.EditorChange, payload)
            }
            onExtraInputChange={({ target }: { target: HTMLInputElement }) => {
              onChange(ActionType.ExtraInputChange, {
                type: target.type,
                name: target.name,
                checked: target.checked,
                value: target.value,
              });
            }}
            onExtraEditorChange={(payload: { name: string; json: any }) => {
              onChange(ActionType.ExtraEditorChange, payload);
            }}
          />
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
      maskClosable={false}
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
                {renderDatabaseConnectionForm()}
                <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
                  {dbModel.engine !== Engines.GSheet && (
                    <>
                      <Button
                        data-test="sqla-connect-btn"
                        buttonStyle="link"
                        onClick={() =>
                          setDB({
                            type: ActionType.ConfigMethodChange,
                            payload: {
                              engine: db.engine,
                              configuration_method:
                                ConfigurationMethod.SqlalchemyUri,
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
