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
import { styled, t } from '@superset-ui/core';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import Tabs from 'src/common/components/Tabs';
import { DatabaseObject } from './types';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

interface DatabaseModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatabaseAdd?: (database?: DatabaseObject) => void; // TODO: should we add a separate function for edit?
  onHide: () => void;
  show: boolean;
  database?: DatabaseObject | null; // If included, will go into edit mode
}

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledInputContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

  .label,
  .helper {
    display: block;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    color: ${({ theme }) => theme.colors.grayscale.light1};
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

    &[name='uri'] {
      margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    }
  }
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

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (onDatabaseAdd) {
      onDatabaseAdd();
    }

    hide();
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const data = {
      database_name: db ? db.database_name : '',
      uri: db ? db.uri : '',
      ...db,
    };

    if (target.type === 'checkbox') {
      data[target.name] = target.checked;
    } else {
      data[target.name] = target.value;
    }

    setDB(data);
  };

  const onTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = event.target;
    const data = {
      name: db ? db.name : '',
      uri: db ? db.uri : '',
      ...db,
    };

    data[target.name] = target.value;
    setDB(data);
  };

  const validate = () => {
    if (db && db.name.length && db.uri.length) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  const isEditMode = database !== null;

  // Initialize
  if (
    isEditMode &&
    (!db || !db.id || (database && database.id !== db.id) || (isHidden && show))
  ) {
    setDB(database);
  } else if (!isEditMode && (!db || db.id || (isHidden && show))) {
    setDB({
      database_name: '',
      uri: '',
    });
  }

  // Validation
  useEffect(() => {
    validate();
  });

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      className="database-modal"
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      width="750px"
      show={show}
      title={
        <h4>
          <StyledIcon name="databases" />
          {isEditMode ? t('Edit Database') : t('Add Database')}
        </h4>
      }
    >
      <Tabs defaultActiveKey="1">
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
            <div className="label">
              {t('Datasource Name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={db ? db.database_name : ''}
                placeholder={t('Name your datasource')}
                onChange={onInputChange}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="label">
              {t('SQLAlchemy URI')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="uri"
                value={db ? db.uri : ''}
                placeholder={t('SQLAlchemy URI')}
                onChange={onInputChange}
              />
              <Button buttonStyle="primary">{t('Test Connection')}</Button>
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
            <div className="label">{t('Chart Cache Timeout')}</div>
            <div className="input-container">
              <input
                type="number"
                name="chartCacheTimeout"
                value={db ? db.chartCacheTimeout || '' : ''}
                placeholder={t('Chart Cache Timeout')}
                onChange={onInputChange}
              />
            </div>
            <div className="helper">
              {t(
                'Duration (in seconds) of the caching timeout for charts of this database.',
              )}
              {t(' A timeout of 0 indicates that the cache never expires.')}
              {t(' Note this defaults to the global timeout if undefined.')}
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="asynchronousQueryExecution"
                indeterminate={false}
                checked={db ? !!db.asynchronousQueryExecution : false}
                onChange={onInputChange}
              />
              <div>{t('Asynchronous Query Execution')}</div>
              <InfoTooltipWithTrigger
                label="aqe"
                tooltip={
                  t(
                    'Operate the database in asynchronous mode, meaning that the queries ',
                  ) +
                  t(
                    'are executed on remote workers as opposed to on the web server itself. ',
                  ) +
                  t(
                    'This assumes that you have a Celery worker setup as well as a results ',
                  ) +
                  t(
                    'backend. Refer to the installation docs for more information.',
                  )
                }
              />
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('SQL Lab Settings')}</span>} key="3">
          <StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="sqlExpose"
                  indeterminate={false}
                  checked={db ? !!db.sqlExpose : false}
                  onChange={onInputChange}
                />
                <div>{t('Expose in SQL Lab')}</div>
                <InfoTooltipWithTrigger
                  label="sql-expose"
                  tooltip={t('Expose this DB in SQL Lab')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allowCTA"
                  indeterminate={false}
                  checked={db ? !!db.allowCTA : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow CREATE TABLE AS')}</div>
                <InfoTooltipWithTrigger
                  label="allow-cta"
                  tooltip={t('Allow CREATE TABLE AS option in SQL Lab')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allowCVA"
                  indeterminate={false}
                  checked={db ? !!db.allowCVA : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow CREATE VIEW AS')}</div>
                <InfoTooltipWithTrigger
                  label="allow-cva"
                  tooltip={t('Allow CREATE VIEW AS option in SQL Lab')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allowDML"
                  indeterminate={false}
                  checked={db ? !!db.allowDML : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow DML')}</div>
                <InfoTooltipWithTrigger
                  label="allow-dml"
                  tooltip={t(
                    'Allow users to run non-SELECT statements (UPDATE, DELETE, CREATE, ...)',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allowMSMF"
                  indeterminate={false}
                  checked={db ? !!db.allowMSMF : false}
                  onChange={onInputChange}
                />
                <div>{t('Allow Multi Schema Metadata Fetch')}</div>
                <InfoTooltipWithTrigger
                  label="allow-msmf"
                  tooltip={
                    t(
                      'Allow SQL Lab to fetch a list of all tables and all views across all database ',
                    ) +
                    t(
                      'schemas. For large data warehouse with thousands of tables, this can be ',
                    ) +
                    t('expensive and put strain on the system.')
                  }
                />
              </div>
            </StyledInputContainer>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="label">{t('CTAS Schema')}</div>
            <div className="input-container">
              <input
                type="number"
                name="forceCTASSchema"
                value={db ? db.forceCTASSchema || '' : ''}
                placeholder={t('CTAS Schema')}
                onChange={onInputChange}
              />
            </div>
            <div className="helper">
              {t(
                'When allowing CREATE TABLE AS option in SQL Lab, this option ',
              )}{' '}
              +{t('forces the table to be created in this schema')}
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Security')}</span>} key="4">
          <StyledInputContainer>
            <div className="label">{t('Secure Extra')}</div>
            <div className="input-container">
              <textarea
                name="secureExtra"
                value={db ? db.secureExtra || '' : ''}
                placeholder={t('Secure Extra')}
                onChange={onTextChange}
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
                  'This is used to provide connection information for systems like Hive, ',
                ) +
                  t(
                    'Presto, and BigQuery, which do not conform to the username:password syntax ',
                  ) +
                  t('normally used by SQLAlchemy.')}
              </div>
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="label">{t('Root Certificate')}</div>
            <div className="input-container">
              <textarea
                name="rootCertificate"
                value={db ? db.rootCertificate || '' : ''}
                placeholder={t('Root Certificate')}
                onChange={onTextChange}
              />
            </div>
            <div className="helper">
              {t(
                'Optional CA_BUNDLE contents to validate HTTPS requests. Only available on ',
              ) + t('certain database engines.')}
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span>{t('Extra')}</span>} key="5">
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="impersonateUser"
                indeterminate={false}
                checked={db ? !!db.impersonateUser : false}
                onChange={onInputChange}
              />
              <div>{t('Impersonate Logged In User (Presto & Hive')}</div>
              <InfoTooltipWithTrigger
                label="impersonate"
                tooltip={
                  t(
                    'If Presto, all the queries in SQL Lab are going to be executed as the ',
                  ) +
                  t(
                    'currently logged on user who must have permission to run them. If Hive ',
                  ) +
                  t(
                    'and hive.server2.enable.doAs is enabled, will run the queries as ',
                  ) +
                  t(
                    'service account, but impersonate the currently logged on user via ',
                  ) +
                  t('hive.server2.proxy.user property.')
                }
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="input-container">
              <IndeterminateCheckbox
                id="allowCSV"
                indeterminate={false}
                checked={db ? !!db.allowCSV : false}
                onChange={onInputChange}
              />
              <div>{t('Allow CSV Upload')}</div>
              <InfoTooltipWithTrigger
                label="allow-csv"
                tooltip={t(
                  'If selected, please set the schemas allowed for csv upload in Extra.',
                )}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="label">{t('Extra')}</div>
            <div className="input-container">
              <textarea
                name="extra"
                value={db ? db.extra || '' : ''}
                placeholder={
                  '{\n  "metadata_params": {},\n  "engine_params": {},' +
                  '\n  "metadata_cache_timeout": {},\n  "schemas_allowed_for_csv_upload": [] \n}'
                }
                onChange={onTextChange}
              />
            </div>
            <div className="helper">
              <div>
                {t('JSON string containing extra configuration elements.')}
              </div>
              <div>
                {t(
                  '1. The engine_params object gets unpacked into the sqlalchemy.create_engine ',
                ) +
                  t(
                    'call, while the metadata_params gets unpacked into the sqlalchemy.MetaData ',
                  ) +
                  t('call.')}
              </div>
              <div>
                {t(
                  '2. The metadata_cache_timeout is a cache timeout setting in seconds for ',
                ) +
                  t(
                    'metadata fetch of this database. Specify it as "metadata_cache_timeout": ',
                  ) +
                  t(
                    '{"schema_cache_timeout": 600, "table_cache_timeout": 600}. If unset, cache ',
                  ) +
                  t(
                    'will not be enabled for the functionality. A timeout of 0 indicates that ',
                  ) +
                  t('the cache never expires.')}
              </div>
              <div>
                {t(
                  '3. The schemas_allowed_for_csv_upload is a comma separated list of schemas ',
                ) +
                  t('that CSVs are allowed to upload to. Specify it as ') +
                  t(
                    '"schemas_allowed_for_csv_upload": ["public", "csv_upload"]. If database ',
                  ) +
                  t(
                    'flavor does not support schema or any schema is allowed to be accessed, ',
                  ) +
                  t('just leave the list empty.')}
              </div>
              <div>
                {t(
                  "4. The version field is a string specifying this db's version. This ",
                ) +
                  t(
                    'should be used with Presto DBs so that the syntax is correct.',
                  )}
              </div>
              <div>
                {t(
                  '5. The allows_virtual_table_explore field is a boolean specifying whether ',
                ) + t('or not the Explore button in SQL Lab results is shown.')}
              </div>
            </div>
          </StyledInputContainer>
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  );
};

export default withToasts(DatabaseModal);
