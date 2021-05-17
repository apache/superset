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
import React, { ChangeEvent, EventHandler, useState } from 'react';
import cx from 'classnames';
import { t } from '@superset-ui/core';
import InfoTooltip from 'src/components/InfoTooltip';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import Collapse from 'src/components/Collapse';
import {
  StyledInputContainer,
  StyledJsonEditor,
  StyledExpandableForm,
  no_margin_bottom,
} from 'src/views/CRUD/data/database/DatabaseModal/styles';
import { DatabaseObject } from '../types';

const defaultExtra = '{\n  "metadata_params": {},\n  "engine_params": {} \n}';

const ExtraOptions = ({
  db,
  onInputChange,
  onTextChange,
  onEditorChange,
}: {
  db: DatabaseObject | null;
  onInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  onTextChange: EventHandler<ChangeEvent<HTMLTextAreaElement>>;
  onEditorChange: Function;
}) => {
  const expandableModalIsOpen = !!db?.expose_in_sqllab;
  const createAsOpen = !!(db?.allow_ctas || db?.allow_cvas);
  // Extra state - these values are removed from state on fetch, stored here in
  // useState while they're manipulated, then passed back into state before updating
  const [constQueryEnabled, setConstQueryEnabled] = useState<boolean>(false);
  const [metaDataCacheTimeout, setMetaDataCacheTimeout] = useState<string>(
    '{}',
  );
  const [schemasAllowed, setSchemasAllowed] = useState<string>('');
  const [versionNumber, setVersionNumber] = useState<string>('');

  return (
    <Collapse expandIconPosition="right" accordion>
      <Collapse.Panel
        header={
          <div>
            <h4>SQL Lab</h4>
            <p className="helper">
              Configure how this database will function in SQL Lab.
            </p>
          </div>
        }
        key="1"
      >
        <StyledInputContainer css={{ ...no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="expose_in_sqllab"
              indeterminate={false}
              checked={!!db?.expose_in_sqllab}
              onChange={onInputChange}
              labelText={t('Expose in SQL Lab')}
            />
            <InfoTooltip
              tooltip={t('Allow this database to be queried in SQL Lab')}
            />
          </div>
          <StyledExpandableForm
            className={cx('expandable', {
              open: expandableModalIsOpen,
              'ctas-open': createAsOpen,
            })}
          >
            <StyledInputContainer css={{ ...no_margin_bottom }}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_ctas"
                  indeterminate={false}
                  checked={!!db?.allow_ctas}
                  onChange={onInputChange}
                  labelText={t('Allow CREATE TABLE AS')}
                />
                <InfoTooltip
                  tooltip={t('Allow creation of new tables based on queries')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={{ ...no_margin_bottom }}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_cvas"
                  indeterminate={false}
                  checked={!!db?.allow_cvas}
                  onChange={onInputChange}
                  labelText={t('Allow CREATE VIEW AS')}
                />
                <InfoTooltip
                  tooltip={t('Allow creation of new views based on queries')}
                />
              </div>
              <StyledInputContainer
                className={cx('expandable', { open: createAsOpen })}
              >
                <div className="control-label">{t('CTAS & CVAS SCHEMA')}</div>
                <div className="input-container">
                  <input
                    type="text"
                    name="force_ctas_schema"
                    value={db?.force_ctas_schema || ''}
                    placeholder={t('Search or select schema')}
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
            </StyledInputContainer>
            <StyledInputContainer css={{ ...no_margin_bottom }}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_dml"
                  indeterminate={false}
                  checked={!!db?.allow_dml}
                  onChange={onInputChange}
                  labelText={t('Allow DML')}
                />
                <InfoTooltip
                  tooltip={t(
                    'Allow manipulation of the database using non-SELECT statements such as UPDATE, DELETE, CREATE, etc.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={{ ...no_margin_bottom }}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_multi_schema_metadata_fetch"
                  indeterminate={false}
                  checked={!!db?.allow_multi_schema_metadata_fetch}
                  onChange={onInputChange}
                  labelText={t('Allow multi schema metadata fetch')}
                />
                <InfoTooltip
                  tooltip={t(
                    'Allow SQL Lab to fetch a list of all tables and all views across all database ' +
                      'schemas. For large data warehouse with thousands of tables, this can be ' +
                      'expensive and put strain on the system.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={{ ...no_margin_bottom }}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="cost_query_enabled"
                  indeterminate={false}
                  checked={constQueryEnabled}
                  onChange={onInputChange}
                  labelText={t('Enable query cost estimation')}
                />
                <InfoTooltip
                  tooltip={t(
                    'For Presto and Postgres, shows a button to compute cost before running a query.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allows_virtual_table_explore"
                  indeterminate={false}
                  checked={!!db?.allows_virtual_table_explore}
                  onChange={onInputChange}
                  labelText={t('Allow this database to be explored')}
                />
                <InfoTooltip
                  tooltip={t(
                    'When enabled, users are able to visualize SQL Lab results in Explore.',
                  )}
                />
              </div>
            </StyledInputContainer>
          </StyledExpandableForm>
        </StyledInputContainer>
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <div>
            <h4>Performance</h4>
            <p className="helper">
              Adjust settings that will impact the performance of this database.
            </p>
          </div>
        }
        key="2"
      >
        <StyledInputContainer className="mb-8">
          <div className="control-label">{t('Chart cache timeout')}</div>
          <div className="input-container">
            <input
              type="number"
              name="cache_timeout"
              value={db?.cache_timeout || ''}
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
          <div className="control-label">{t('Metadata cache timeout')}</div>
          <div className="input-container">
            <input
              type="number"
              name="metadata_cache_timeout"
              value={metaDataCacheTimeout}
              placeholder={t('Metadata cache timeout')}
              onChange={onInputChange}
              data-test="metadata-cache-timeout-test"
            />
          </div>
          <div className="helper">
            {t(
              'The metadata_cache_timeout is a cache timeout setting in seconds for ' +
                'metadata fetch of this database. Specify it as "metadata_cache_timeout": ' +
                '{"schema_cache_timeout": 600, "table_cache_timeout": 600}. If unset, cache ' +
                'will not be enabled for the functionality. A timeout of 0 indicates that ' +
                'the cache never expires.',
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={{ ...no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="allow_run_async"
              indeterminate={false}
              checked={!!db?.allow_run_async}
              onChange={onInputChange}
              labelText={t('Asynchronous query execution')}
            />
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
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <div>
            <h4>Security</h4>
            <p className="helper">
              Add connection information for other systems.
            </p>
          </div>
        }
        key="3"
      >
        <StyledInputContainer>
          <div className="control-label">{t('Secure extra')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="encrypted_extra"
              value={db?.encrypted_extra || ''}
              placeholder={t('Secure extra')}
              onChange={(json: string) =>
                onEditorChange({ json, name: 'encrypted_extra' })
              }
              width="100%"
              height="160px"
            />
          </div>
          <div className="helper">
            <div>
              {t('JSON string containing additional connection configuration.')}
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
              value={db?.server_cert || ''}
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
        <StyledInputContainer>
          <div className="control-label">
            {t('Schemas allowed for CSV upload')}
          </div>
          <div className="input-container">
            <input
              type="text"
              name="schemas_allowed_for_csv_upload"
              value={schemasAllowed}
              placeholder={t('Select one or multiple schemas')}
              onChange={onInputChange}
            />
          </div>
          <div className="helper">
            {t('A list of schemas that CSVs are allowed to upload to.')}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={{ ...no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="impersonate_user"
              indeterminate={false}
              checked={!!db?.impersonate_user}
              onChange={onInputChange}
              labelText={t('Impersonate Logged In User (Presto & Hive)')}
            />
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
        <StyledInputContainer css={{ ...no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="allow_csv_upload"
              indeterminate={false}
              checked={!!db?.allow_csv_upload}
              onChange={onInputChange}
              labelText={t('Allow data upload')}
            />
            <InfoTooltip
              tooltip={t(
                'If selected, please set the schemas allowed for data upload in Extra.',
              )}
            />
          </div>
        </StyledInputContainer>
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <div>
            <h4>Other</h4>
            <p className="helper">Additional settings.</p>
          </div>
        }
        key="4"
      >
        <StyledInputContainer className="extra-container">
          <div className="control-label">{t('Extra')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="extra"
              value={db?.extra ?? defaultExtra}
              placeholder={t('Secure extra')}
              onChange={(json: string) =>
                onEditorChange({ json, name: 'extra' })
              }
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
                'The engine_params object gets unpacked into the sqlalchemy.create_engine ' +
                  'call, while the metadata_params gets unpacked into the sqlalchemy.MetaData ' +
                  'call.',
              )}
            </div>
          </div>
        </StyledInputContainer>
        <StyledInputContainer>
          <div className="control-label" data-test="version-label-test">
            {t('Version')}
          </div>
          <div className="input-container" data-test="version-spinbutton-test">
            <input
              type="number"
              name="version"
              /* ----------
              🚨 Not sure which part of db I should use for value 🚨
              ---------- */
              value={versionNumber}
              placeholder={t('Version number')}
              onChange={onInputChange}
            />
          </div>
          <div className="helper">
            {t(
              'Specify this database’s version. This should be used with ' +
                'Presto databases so that the syntax is correct.',
            )}
          </div>
        </StyledInputContainer>
      </Collapse.Panel>
    </Collapse>
  );
};

export default ExtraOptions;
