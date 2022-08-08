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
import React, { ChangeEvent, EventHandler } from 'react';
import cx from 'classnames';
import { t, SupersetTheme } from '@superset-ui/core';
import InfoTooltip from 'src/components/InfoTooltip';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import Collapse from 'src/components/Collapse';
import {
  StyledInputContainer,
  StyledJsonEditor,
  StyledExpandableForm,
  antdCollapseStyles,
  no_margin_bottom,
} from './styles';
import { DatabaseObject } from '../types';

const ExtraOptions = ({
  db,
  onInputChange,
  onTextChange,
  onEditorChange,
  onExtraInputChange,
  onExtraEditorChange,
}: {
  db: DatabaseObject | null;
  onInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  onTextChange: EventHandler<ChangeEvent<HTMLTextAreaElement>>;
  onEditorChange: Function;
  onExtraInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  onExtraEditorChange: Function;
}) => {
  const expandableModalIsOpen = !!db?.expose_in_sqllab;
  const createAsOpen = !!(db?.allow_ctas || db?.allow_cvas);

  return (
    <Collapse
      expandIconPosition="right"
      accordion
      css={(theme: SupersetTheme) => antdCollapseStyles(theme)}
    >
      <Collapse.Panel
        header={
          <div>
            <h4>SQL Lab</h4>
            <p className="helper">
              Adjust how this database will interact with SQL Lab.
            </p>
          </div>
        }
        key="1"
      >
        <StyledInputContainer css={no_margin_bottom}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="expose_in_sqllab"
              indeterminate={false}
              checked={!!db?.expose_in_sqllab}
              onChange={onInputChange}
              labelText={t('Expose database in SQL Lab')}
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
            <StyledInputContainer css={no_margin_bottom}>
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
            <StyledInputContainer css={no_margin_bottom}>
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
                    placeholder={t('Create or select schema...')}
                    onChange={onInputChange}
                  />
                </div>
                <div className="helper">
                  {t(
                    'Force all tables and views to be created in this schema when clicking CTAS or CVAS in SQL Lab.',
                  )}
                </div>
              </StyledInputContainer>
            </StyledInputContainer>
            <StyledInputContainer css={no_margin_bottom}>
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
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allow_multi_schema_metadata_fetch"
                  indeterminate={false}
                  checked={!!db?.allow_multi_schema_metadata_fetch}
                  onChange={onInputChange}
                  labelText={t('Allow Multi Schema Metadata Fetch')}
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
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="cost_estimate_enabled"
                  indeterminate={false}
                  checked={!!db?.extra_json?.cost_estimate_enabled}
                  onChange={onExtraInputChange}
                  labelText={t('Enable query cost estimation')}
                />
                <InfoTooltip
                  tooltip={t(
                    'For Presto and Postgres, shows a button to compute cost before running a query.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allows_virtual_table_explore"
                  indeterminate={false}
                  checked={!!db?.extra_json?.allows_virtual_table_explore}
                  onChange={onExtraInputChange}
                  labelText={t('Allow this database to be explored')}
                />
                <InfoTooltip
                  tooltip={t(
                    'When enabled, users are able to visualize SQL Lab results in Explore.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="disable_data_preview"
                  indeterminate={false}
                  checked={!!db?.extra_json?.disable_data_preview}
                  onChange={onExtraInputChange}
                  labelText={t('Disable SQL Lab data preview queries')}
                />
                <InfoTooltip
                  tooltip={t(
                    'Disable data preview when fetching table metadata in SQL Lab. ' +
                      ' Useful to avoid browser performance issues when using ' +
                      ' databases with very wide tables.',
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
              Adjust performance settings of this database.
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
              placeholder={t('Enter duration in seconds')}
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
          <div className="control-label">{t('Schema cache timeout')}</div>
          <div className="input-container">
            <input
              type="number"
              name="schema_cache_timeout"
              value={
                db?.extra_json?.metadata_cache_timeout?.schema_cache_timeout ||
                ''
              }
              placeholder={t('Enter duration in seconds')}
              onChange={onExtraInputChange}
              data-test="schema-cache-timeout-test"
            />
          </div>
          <div className="helper">
            {t(
              'Duration (in seconds) of the metadata caching timeout for schemas of ' +
                'this database. If left unset, the cache never expires.',
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer>
          <div className="control-label">{t('Table cache timeout')}</div>
          <div className="input-container">
            <input
              type="number"
              name="table_cache_timeout"
              value={
                db?.extra_json?.metadata_cache_timeout?.table_cache_timeout ||
                ''
              }
              placeholder={t('Enter duration in seconds')}
              onChange={onExtraInputChange}
              data-test="table-cache-timeout-test"
            />
          </div>
          <div className="helper">
            {t(
              'Duration (in seconds) of the metadata caching timeout for tables of ' +
                'this database. If left unset, the cache never expires. ',
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={{ no_margin_bottom }}>
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
        <StyledInputContainer css={{ no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="cancel_query_on_windows_unload"
              indeterminate={false}
              checked={!!db?.extra_json?.cancel_query_on_windows_unload}
              onChange={onExtraInputChange}
              labelText={t('Cancel query on window unload event')}
            />
            <InfoTooltip
              tooltip={t(
                'Terminate running queries when browser window closed or navigated ' +
                  'to another page. Available for Presto, Hive, MySQL, Postgres and ' +
                  'Snowflake databases.',
              )}
            />
          </div>
        </StyledInputContainer>
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <div>
            <h4>Security</h4>
            <p className="helper">Add extra connection information.</p>
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
              {t(
                'JSON string containing additional connection configuration. ' +
                  'This is used to provide connection information for systems ' +
                  'like Hive, Presto and BigQuery which do not conform to the ' +
                  'username:password syntax normally used by SQLAlchemy.',
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
              placeholder={t('Enter CA_BUNDLE')}
              onChange={onTextChange}
            />
          </div>
          <div className="helper">
            {t(
              'Optional CA_BUNDLE contents to validate HTTPS requests. Only ' +
                'available on certain database engines.',
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
              name="schemas_allowed_for_file_upload"
              value={(
                db?.extra_json?.schemas_allowed_for_file_upload || []
              ).join(',')}
              placeholder="schema1,schema2"
              onChange={onExtraInputChange}
            />
          </div>
          <div className="helper">
            {t(
              'A comma-separated list of schemas that CSVs are allowed to upload to.',
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={{ no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="impersonate_user"
              indeterminate={false}
              checked={!!db?.impersonate_user}
              onChange={onInputChange}
              labelText={t(
                'Impersonate logged in user (Presto, Trino, Drill, Hive, and GSheets)',
              )}
            />
            <InfoTooltip
              tooltip={t(
                'If Presto or Trino, all the queries in SQL Lab are going to be executed as the ' +
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
              id="allow_file_upload"
              indeterminate={false}
              checked={!!db?.allow_file_upload}
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
        <StyledInputContainer>
          <div className="control-label">{t('Metadata Parameters')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="metadata_params"
              value={db?.extra_json?.metadata_params || ''}
              placeholder={t('Metadata Parameters')}
              onChange={(json: string) =>
                onExtraEditorChange({ json, name: 'metadata_params' })
              }
              width="100%"
              height="160px"
            />
          </div>
          <div className="helper">
            <div>
              {t(
                'The metadata_params object gets unpacked into the sqlalchemy.MetaData call.',
              )}
            </div>
          </div>
        </StyledInputContainer>
        <StyledInputContainer>
          <div className="control-label">{t('Engine Parameters')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="engine_params"
              value={db?.extra_json?.engine_params || ''}
              placeholder={t('Engine Parameters')}
              onChange={(json: string) =>
                onExtraEditorChange({ json, name: 'engine_params' })
              }
              width="100%"
              height="160px"
            />
          </div>
          <div className="helper">
            <div>
              {t(
                'The engine_params object gets unpacked into the sqlalchemy.create_engine call.',
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
              value={db?.extra_json?.version || ''}
              placeholder={t('Version number')}
              onChange={onExtraInputChange}
            />
          </div>
          <div className="helper">
            {t(
              'Specify the database version. This should be used with ' +
                'Presto in order to enable query cost estimation.',
            )}
          </div>
        </StyledInputContainer>
      </Collapse.Panel>
    </Collapse>
  );
};

export default ExtraOptions;
