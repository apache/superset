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
import { ChangeEvent, EventHandler } from 'react';
import cx from 'classnames';
import {
  t,
  DatabaseConnectionExtension,
  isFeatureEnabled,
  SupersetTheme,
  useTheme,
  FeatureFlag,
} from '@superset-ui/core';
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
import { DatabaseObject, ExtraJson } from '../types';

const ExtraOptions = ({
  db,
  onInputChange,
  onTextChange,
  onEditorChange,
  onExtraInputChange,
  onExtraEditorChange,
  extraExtension,
}: {
  db: DatabaseObject | null;
  onInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  onTextChange: EventHandler<ChangeEvent<HTMLTextAreaElement>>;
  onEditorChange: Function;
  onExtraInputChange: EventHandler<ChangeEvent<HTMLInputElement>>;
  onExtraEditorChange: Function;
  extraExtension: DatabaseConnectionExtension | undefined;
}) => {
  const expandableModalIsOpen = !!db?.expose_in_sqllab;
  const createAsOpen = !!(db?.allow_ctas || db?.allow_cvas);
  const isFileUploadSupportedByEngine =
    db?.engine_information?.supports_file_upload;
  const supportsDynamicCatalog =
    db?.engine_information?.supports_dynamic_catalog;

  // JSON.parse will deep parse engine_params
  // if it's an object, and we want to keep it a string
  const extraJson: ExtraJson = JSON.parse(db?.extra || '{}', (key, value) => {
    if (key === 'engine_params' && typeof value === 'object') {
      // keep this as a string
      return JSON.stringify(value);
    }
    return value;
  });
  const theme = useTheme();
  const ExtraExtensionComponent = extraExtension?.component;
  const ExtraExtensionLogo = extraExtension?.logo;
  const ExtensionDescription = extraExtension?.description;
  const allowRunAsync = isFeatureEnabled(FeatureFlag.ForceSqlLabRunAsync)
    ? true
    : !!db?.allow_run_async;
  const isAllowRunAsyncDisabled = isFeatureEnabled(
    FeatureFlag.ForceSqlLabRunAsync,
  );

  return (
    <Collapse
      expandIconPosition="right"
      accordion
      css={(theme: SupersetTheme) => antdCollapseStyles(theme)}
    >
      <Collapse.Panel
        header={
          <div>
            <h4>{t('SQL Lab')}</h4>
            <p className="helper">
              {t('Adjust how this database will interact with SQL Lab.')}
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
                    placeholder={t('Create or select schema...')}
                    onChange={onInputChange}
                    value={db?.force_ctas_schema || ''}
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
                  labelText={t('Allow DDL and DML')}
                />
                <InfoTooltip
                  tooltip={t(
                    'Allow the execution of DDL (Data Definition Language: CREATE, DROP, TRUNCATE, etc.) and DML (Data Modification Language: INSERT, UPDATE, DELETE, etc)',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="cost_estimate_enabled"
                  indeterminate={false}
                  checked={!!extraJson?.cost_estimate_enabled}
                  onChange={onExtraInputChange}
                  labelText={t('Enable query cost estimation')}
                />
                <InfoTooltip
                  tooltip={t(
                    'For Bigquery, Presto and Postgres, shows a button to compute cost before running a query.',
                  )}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="allows_virtual_table_explore"
                  indeterminate={false}
                  // when `allows_virtual_table_explore` is not present in `extra` it defaults to true
                  checked={extraJson?.allows_virtual_table_explore !== false}
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
            <StyledInputContainer css={no_margin_bottom}>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="disable_data_preview"
                  indeterminate={false}
                  checked={!!extraJson?.disable_data_preview}
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
            <StyledInputContainer>
              <div className="input-container">
                <IndeterminateCheckbox
                  id="expand_rows"
                  indeterminate={false}
                  checked={!!extraJson?.schema_options?.expand_rows}
                  onChange={onExtraInputChange}
                  labelText={t('Enable row expansion in schemas')}
                />
                <InfoTooltip
                  tooltip={t(
                    'For Trino, describe full schemas of nested ROW types, expanding them with dotted paths',
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
            <h4>{t('Performance')}</h4>
            <p className="helper">
              {t('Adjust performance settings of this database.')}
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
                ' A timeout of 0 indicates that the cache never expires, and -1 bypasses the cache.' +
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
                extraJson?.metadata_cache_timeout?.schema_cache_timeout || ''
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
                extraJson?.metadata_cache_timeout?.table_cache_timeout || ''
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
              checked={allowRunAsync}
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
            {isAllowRunAsyncDisabled && (
              <InfoTooltip
                iconStyle={{ color: theme.colors.error.base }}
                tooltip={t(
                  'This option has been disabled by the administrator.',
                )}
              />
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={{ no_margin_bottom }}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="cancel_query_on_windows_unload"
              indeterminate={false}
              checked={!!extraJson?.cancel_query_on_windows_unload}
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
            <h4>{t('Security')}</h4>
            <p className="helper">{t('Add extra connection information.')}</p>
          </div>
        }
        key="3"
      >
        <StyledInputContainer>
          <div className="control-label">{t('Secure extra')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="masked_encrypted_extra"
              value={db?.masked_encrypted_extra || ''}
              placeholder={t('Secure extra')}
              onChange={(json: string) =>
                onEditorChange({ json, name: 'masked_encrypted_extra' })
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
        <StyledInputContainer
          css={!isFileUploadSupportedByEngine ? no_margin_bottom : {}}
        >
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
        {isFileUploadSupportedByEngine && (
          <StyledInputContainer
            css={!db?.allow_file_upload ? no_margin_bottom : {}}
          >
            <div className="input-container">
              <IndeterminateCheckbox
                id="allow_file_upload"
                indeterminate={false}
                checked={!!db?.allow_file_upload}
                onChange={onInputChange}
                labelText={t('Allow file uploads to database')}
              />
            </div>
          </StyledInputContainer>
        )}
        {isFileUploadSupportedByEngine && !!db?.allow_file_upload && (
          <StyledInputContainer css={no_margin_bottom}>
            <div className="control-label">
              {t('Schemas allowed for File upload')}
            </div>
            <div className="input-container">
              <input
                type="text"
                name="schemas_allowed_for_file_upload"
                value={(extraJson?.schemas_allowed_for_file_upload || []).join(
                  ',',
                )}
                placeholder="schema1,schema2"
                onChange={onExtraInputChange}
              />
            </div>
            <div className="helper">
              {t(
                'A comma-separated list of schemas that files are allowed to upload to.',
              )}
            </div>
          </StyledInputContainer>
        )}
      </Collapse.Panel>
      {extraExtension && ExtraExtensionComponent && ExtensionDescription && (
        <Collapse.Panel
          header={
            <div>
              {ExtraExtensionLogo && <ExtraExtensionLogo />}
              <span
                css={(theme: SupersetTheme) => ({
                  fontSize: theme.typography.sizes.l,
                  fontWeight: theme.typography.weights.bold,
                })}
              >
                {extraExtension?.title}
              </span>
              <p className="helper">
                <ExtensionDescription />
              </p>
            </div>
          }
          key={extraExtension?.title}
          // @ts-ignore, 'icon' is valid in >=4.9.0 but missing from `CollapsibleType`
          collapsible={extraExtension.enabled?.() ? 'icon' : 'disabled'}
        >
          <StyledInputContainer css={no_margin_bottom}>
            <ExtraExtensionComponent db={db} onEdit={extraExtension.onEdit} />
          </StyledInputContainer>
        </Collapse.Panel>
      )}
      <Collapse.Panel
        header={
          <div>
            <h4>{t('Other')}</h4>
            <p className="helper">{t('Additional settings.')}</p>
          </div>
        }
        key="4"
      >
        <StyledInputContainer>
          <div className="control-label">{t('Metadata Parameters')}</div>
          <div className="input-container">
            <StyledJsonEditor
              name="metadata_params"
              placeholder={t('Metadata Parameters')}
              onChange={(json: string) =>
                onExtraEditorChange({ json, name: 'metadata_params' })
              }
              width="100%"
              height="160px"
              value={
                !Object.keys(extraJson?.metadata_params || {}).length
                  ? ''
                  : extraJson?.metadata_params
              }
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
              placeholder={t('Engine Parameters')}
              onChange={(json: string) =>
                onExtraEditorChange({ json, name: 'engine_params' })
              }
              width="100%"
              height="160px"
              value={
                !Object.keys(extraJson?.engine_params || {}).length
                  ? ''
                  : extraJson?.engine_params
              }
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
              type="text"
              name="version"
              placeholder={t('Version number')}
              onChange={onExtraInputChange}
              value={extraJson?.version || ''}
            />
          </div>
          <div className="helper">
            {t(
              'Specify the database version. This is used with Presto for query cost ' +
                'estimation, and Dremio for syntax changes, among others.',
            )}
          </div>
        </StyledInputContainer>
        <StyledInputContainer css={no_margin_bottom}>
          <div className="input-container">
            <IndeterminateCheckbox
              id="disable_drill_to_detail"
              indeterminate={false}
              checked={!!extraJson?.disable_drill_to_detail}
              onChange={onExtraInputChange}
              labelText={t('Disable drill to detail')}
            />
            <InfoTooltip
              tooltip={t(
                'Disables the drill to detail feature for this database.',
              )}
            />
          </div>
        </StyledInputContainer>
        {supportsDynamicCatalog && (
          <StyledInputContainer css={no_margin_bottom}>
            <div className="input-container">
              <IndeterminateCheckbox
                id="allow_multi_catalog"
                indeterminate={false}
                checked={!!extraJson?.allow_multi_catalog}
                onChange={onExtraInputChange}
                labelText={t('Allow changing catalogs')}
              />
              <InfoTooltip
                tooltip={t(
                  'Give access to multiple catalogs in a single database connection.',
                )}
              />
            </div>
          </StyledInputContainer>
        )}
      </Collapse.Panel>
    </Collapse>
  );
};

export default ExtraOptions;
