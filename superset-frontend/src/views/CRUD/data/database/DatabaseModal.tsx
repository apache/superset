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
import React, { FunctionComponent, useState, useEffect } from 'react';
import { styled, t, SupersetClient } from '@superset-ui/core';
import InfoTooltip from 'src/common/components/InfoTooltip';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import { JsonEditor } from 'src/components/AsyncAceEditor';
import { DatabaseObject } from './types';

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  database?: DatabaseObject | null; // If included, will go into edit mode
}

const DEFAULT_TAB_KEY = '1';

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledInputContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

  &.extra-container {
    padding-top: 8px;
  }

  .helper {
    display: block;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
    text-align: left;

    .required {
      margin-left: ${({ theme }) => theme.gridUnit / 2}px;
      color: ${({ theme }) => theme.colors.error.base};
    }
  }

  .input-container {
    display: flex;
    align-items: center;

    label {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }

    i {
      margin: 0 ${({ theme }) => theme.gridUnit}px;
    }
  }

  input,
  textarea {
    flex: 1 1 auto;
  }

  textarea {
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='name'] {
      flex: 0 1 auto;
      width: 40%;
    }

    &[name='sqlalchemy_uri'] {
      margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    }
  }
`;

const StyledJsonEditor = styled(JsonEditor)`
  flex: 1 1 auto;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

const DatabaseModal: FunctionComponent<DatabaseModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatabaseAdd,
  onHide,
  show,
  database = null,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [db, setDB] = useState<DatabaseObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [tabKey, setTabKey] = useState<string>(DEFAULT_TAB_KEY);

  const isEditMode = database !== null;
  const defaultExtra =
    '{\n  "metadata_params": {},\n  "engine_params": {},' +
    '\n  "metadata_cache_timeout": {},\n  "schemas_allowed_for_csv_upload": [] \n}';

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
    if (!db || !db.sqlalchemy_uri || !db.sqlalchemy_uri.length) {
      addDangerToast(t('Please enter a SQLAlchemy URI to test'));
      return;
    }

    const connection = {
      sqlalchemy_uri: db ? db.sqlalchemy_uri : '',
      database_name:
        db && db.database_name.length ? db.database_name : undefined,
      impersonate_user: db ? db.impersonate_user || undefined : undefined,
      extra: db && db.extra && db.extra.length ? db.extra : undefined,
      encrypted_extra: db ? db.encrypted_extra || undefined : undefined,
      server_cert: db ? db.server_cert || undefined : undefined,
    };

    SupersetClient.post({
      endpoint: 'api/v1/database/test_connection',
      body: JSON.stringify(connection),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => {
        addSuccessToast(t('Connection looks good!'));
      })
      .catch(response =>
        getClientErrorObject(response).then(error => {
          addDangerToast(
            error?.message
              ? `${t('ERROR: ')}${
                  typeof error.message === 'string'
                    ? error.message
                    : Object.entries(error.message as Record<string, string[]>)
                        .map(([key, value]) => `(${key}) ${value.join(', ')}`)
                        .join('\n')
                }`
              : t('ERROR: Connection failed. '),
          );
        }),
      );
  };

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      const update: DatabaseObject = {
        database_name: db ? db.database_name : '',
        sqlalchemy_uri: db ? db.sqlalchemy_uri : '',
        ...db,
      };

      // Need to clean update object
      if (update.id) {
        delete update.id;
      }

      if (db && db.id) {
        updateResource(db.id, update).then(result => {
          if (result) {
            if (onDatabaseAdd) {
              onDatabaseAdd();
            }
            hide();
          }
        });
      }
    } else if (db) {
      // Create
      createResource(db).then(dbId => {
        if (dbId) {
          if (onDatabaseAdd) {
            onDatabaseAdd();
          }
          hide();
        }
      });
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;
    const data = {
      database_name: db ? db.database_name : '',
      sqlalchemy_uri: db ? db.sqlalchemy_uri : '',
      ...db,
    };

    if (target.type === 'checkbox') {
      data[target.name] = target.checked;
    } else {
      data[target.name] =
        typeof target.value === 'string' ? target.value.trim() : target.value;
    }

    setDB(data);
  };

  const onTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { target } = event;
    const data = {
      database_name: db ? db.database_name : '',
      sqlalchemy_uri: db ? db.sqlalchemy_uri : '',
      ...db,
    };

    data[target.name] = target.value;
    setDB(data);
  };

  const onEditorChange = (json: string, name: string) => {
    const data = {
      database_name: db ? db.database_name : '',
      sqlalchemy_uri: db ? db.sqlalchemy_uri : '',
      ...db,
    };

    data[name] = json;
    setDB(data);
  };

  const validate = () => {
    if (
      db &&
      db.database_name.length &&
      db.sqlalchemy_uri &&
      db.sqlalchemy_uri.length
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  if (
    isEditMode &&
    (!db || !db.id || (database && database.id !== db.id) || (isHidden && show))
  ) {
    if (database && database.id !== null && !dbLoading) {
      const id = database.id || 0;
      setTabKey(DEFAULT_TAB_KEY);

      fetchResource(id)
        .then(() => {
          setDB(dbFetched);
        })
        .catch(e =>
          addDangerToast(
            t(
              'Sorry there was an error fetching database information: %s',
              e.message,
            ),
          ),
        );
    }
  } else if (!isEditMode && (!db || db.id || (isHidden && show))) {
    setTabKey(DEFAULT_TAB_KEY);
    setDB({
      database_name: '',
      sqlalchemy_uri: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  }, [db ? db.database_name : null, db ? db.sqlalchemy_uri : null]);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  const tabChange = (key: string) => {
    setTabKey(key);
  };

  return (
    <Modal
      name="database"
      className="database-modal"
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      width="750px"
      show={show}
      title={
        <h4>
          <StyledIcon name="database" />
          {isEditMode ? t('Edit database') : t('Add database')}
        </h4>
      }
    >
      <Tabs
        defaultActiveKey={DEFAULT_TAB_KEY}
        activeKey={tabKey}
        onTabClick={tabChange}
      >
        <Tabs.TabPane
          tab={
            <span>
              {t('Connection')}
              <span className="required">*</span>
            </span>
          }
          key="1"
        >
          <StyledInputContainer>
            <div className="control-label">
              {t('Database name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="database_name"
                value={db ? db.database_name : ''}
                placeholder={t('Name your dataset')}
                onChange={onInputChange}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {t('SQLAlchemy URI')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="sqlalchemy_uri"
                value={db ? db.sqlalchemy_uri : ''}
                autoComplete="off"
                placeholder={t(
                  'dialect+driver://username:password@host:port/database',
                )}
                onChange={onInputChange}
              />
              <Button buttonStyle="primary" onClick={testConnection} cta>
                {t('Test connection')}
              </Button>
            </div>
            <div className="helper">
              {t('Refer to the ')}
              <a
                href="https://docs.sqlalchemy.org/en/rel_1_2/core/engines.html#"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('SQLAlchemy docs')}
              </a>
              {t(' for more information on how to structure your URI.')}
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Performance')}</span>} key="2">
          <StyledInputContainer>
            <div className="control-label">{t('Chart cache timeout')}</div>
            <div className="input-container">
              <input
                type="number"
                name="cache_timeout"
                value={db ? db.cache_timeout || '' : ''}
                placeholder={t('Chart cache timeout')}
                onChange={onInputChange}
              />
            </div>
            <div className="helper">
              {t(
                'Duration (in seconds) of the caching timeout for charts of this database.' +
                  ' A timeout of 0 indicates that the cache never expires.' +
                  ' Note this defaults to the global timeout if undefined.',
              )}
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="allow_run_async"
                indeterminate={false}
                checked={db ? !!db.allow_run_async : false}
                onChange={onInputChange}
              />
              <div>{t('Asynchronous query execution')}</div>
              <InfoTooltip
                tooltip={t(
                  'Operate the database in asynchronous mode, meaning that the queries ' +
                    'are executed on remote workers as opposed to on the web server itself. ' +
                    'This assumes that you have a Celery worker setup as well as a results ' +
                    'backend. Refer to the installation docs for more information.',
                )}
              />
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('SQL Lab settings')}</span>} key="3">
          <StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="expose_in_sqllab"
                  indeterminate={false}
                  checked={db ? !!db.expose_in_sqllab : false}
                  onChange={onInputChange}
                />
                <div>{t('Expose in SQL Lab')}</div>
                <InfoTooltip
                  tooltip={t('Allow this database to be queried in SQL Lab')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_ctas"
                  indeterminate={false}
                  checked={db ? !!db.allow_ctas : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow CREATE TABLE AS')}</div>
                <InfoTooltip
                  tooltip={t('Allow creation of new tables based on queries')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_cvas"
                  indeterminate={false}
                  checked={db ? !!db.allow_cvas : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow CREATE VIEW AS')}</div>
                <InfoTooltip
                  tooltip={t('Allow creation of new views based on queries')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_dml"
                  indeterminate={false}
                  checked={db ? !!db.allow_dml : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow DML')}</div>
                <InfoTooltip
                  tooltip={t(
                    'Allow manipulation of the database using non-SELECT statements such as UPDATE, DELETE, CREATE, etc.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_multi_schema_metadata_fetch"
                  indeterminate={false}
                  checked={db ? !!db.allow_multi_schema_metadata_fetch : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow multi schema metadata fetch')}</div>
                <InfoTooltip
                  tooltip={t(
                    'Allow SQL Lab to fetch a list of all tables and all views across all database ' +
                      'schemas. For large data warehouse with thousands of tables, this can be ' +
                      'expensive and put strain on the system.',
                  )}
                />
              </div>
            </StyledInputContainer>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">{t('CTAS schema')}</div>
            <div className="input-container">
              <input
                type="text"
                name="force_ctas_schema"
                value={db ? db.force_ctas_schema || '' : ''}
                placeholder={t('CTAS schema')}
                onChange={onInputChange}
              />
            </div>
            <div className="helper">
              {t(
                'When allowing CREATE TABLE AS option in SQL Lab, this option ' +
                  'forces the table to be created in this schema.',
              )}
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Security')}</span>} key="4">
          <StyledInputContainer>
            <div className="control-label">{t('Secure extra')}</div>
            <div className="input-container">
              <StyledJsonEditor
                name="encrypted_extra"
                value={db ? db.encrypted_extra || '' : ''}
                placeholder={t('Secure extra')}
                onChange={(json: string) =>
                  onEditorChange(json, 'encrypted_extra')
                }
                width="100%"
                height="160px"
              />
            </div>
            <div className="helper">
              <div>
                {t(
                  'JSON string containing additional connection configuration.',
                )}
              </div>
              <div>
                {t(
                  'This is used to provide connection information for systems like Hive, ' +
                    'Presto, and BigQuery, which do not conform to the username:password syntax ' +
                    'normally used by SQLAlchemy.',
                )}
              </div>
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">{t('Root certificate')}</div>
            <div className="input-container">
              <textarea
                name="server_cert"
                value={db ? db.server_cert || '' : ''}
                placeholder={t('Root certificate')}
                onChange={onTextChange}
              />
            </div>
            <div className="helper">
              {t(
                'Optional CA_BUNDLE contents to validate HTTPS requests. Only available on ' +
                  'certain database engines.',
              )}
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Extra')}</span>} key="5">
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="impersonate_user"
                indeterminate={false}
                checked={db ? !!db.impersonate_user : false}
                onChange={onInputChange}
              />
              <div>{t('Impersonate Logged In User (Presto & Hive)')}</div>
              <InfoTooltip
                tooltip={t(
                  'If Presto, all the queries in SQL Lab are going to be executed as the ' +
                    'currently logged on user who must have permission to run them. If Hive ' +
                    'and hive.server2.enable.doAs is enabled, will run the queries as ' +
                    'service account, but impersonate the currently logged on user via ' +
                    'hive.server2.proxy.user property.',
                )}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="allow_csv_upload"
                indeterminate={false}
                checked={db ? !!db.allow_csv_upload : false}
                onChange={onInputChange}
              />
              <div>{t('Allow data upload')}</div>
              <InfoTooltip
                tooltip={t(
                  'If selected, please set the schemas allowed for data upload in Extra.',
                )}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer className="extra-container">
            <div className="control-label">{t('Extra')}</div>
            <div className="input-container">
              <StyledJsonEditor
                name="extra"
                value={(db && db.extra) ?? defaultExtra}
                placeholder={t('Secure extra')}
                onChange={(json: string) => onEditorChange(json, 'extra')}
                width="100%"
                height="160px"
              />
            </div>
            <div className="helper">
              <div>
                {t('JSON string containing extra configuration elements.')}
              </div>
              <div>
                {t(
                  '1. The engine_params object gets unpacked into the sqlalchemy.create_engine ' +
                    'call, while the metadata_params gets unpacked into the sqlalchemy.MetaData ' +
                    'call.',
                )}
              </div>
              <div>
                {t(
                  '2. The metadata_cache_timeout is a cache timeout setting in seconds for ' +
                    'metadata fetch of this database. Specify it as "metadata_cache_timeout": ' +
                    '{"schema_cache_timeout": 600, "table_cache_timeout": 600}. If unset, cache ' +
                    'will not be enabled for the functionality. A timeout of 0 indicates that ' +
                    'the cache never expires.',
                )}
              </div>
              <div>
                {t(
                  '3. The schemas_allowed_for_csv_upload is a comma separated list of schemas ' +
                    'that CSVs are allowed to upload to. Specify it as ' +
                    '"schemas_allowed_for_csv_upload": ["public", "csv_upload"]. If database ' +
                    'flavor does not support schema or any schema is allowed to be accessed, ' +
                    'just leave the list empty.',
                )}
              </div>
              <div>
                {t(
                  "4. The version field is a string specifying this db's version. This " +
                    'should be used with Presto DBs so that the syntax is correct.',
                )}
              </div>
              <div>
                {t(
                  '5. The allows_virtual_table_explore field is a boolean specifying whether ' +
                    'or not the Explore button in SQL Lab results is shown.',
                )}
              </div>
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  );
};

export default withToasts(DatabaseModal);
