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
import rison from 'rison';
import { PureComponent, useCallback } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  css,
  isFeatureEnabled,
  getCurrencySymbol,
  ensureIsArray,
  FeatureFlag,
  styled,
  SupersetClient,
  themeObject,
  t,
  withTheme,
  getClientErrorObject,
  getExtensionsRegistry,
} from '@superset-ui/core';
import Tabs from '@superset-ui/core/components/Tabs';
import WarningIconWithTooltip from '@superset-ui/core/components/WarningIconWithTooltip';
import TableSelector from 'src/components/TableSelector';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import SpatialControl from 'src/explore/components/controls/SpatialControl';
import withToasts from 'src/components/MessageToasts/withToasts';
import CurrencyControl from 'src/explore/components/controls/CurrencyControl';
import {
  Alert,
  AsyncSelect,
  Badge,
  Button,
  Card,
  CertifiedBadge,
  Col,
  Divider,
  EditableTitle,
  FormLabel,
  Icons,
  Loading,
  Row,
  Select,
  Typography,
  Label,
} from '@superset-ui/core/components';
import { FilterableTable } from 'src/components';
import {
  executeQuery,
  formatQuery,
  resetDatabaseState,
} from 'src/database/actions';
import Mousetrap from 'mousetrap';
import { DatabaseSelector } from '../DatabaseSelector';
import CollectionTable from './CollectionTable';
import Fieldset from './Fieldset';
import Field from './Field';
import { fetchSyncedColumns, updateColumns } from './utils';

const extensionsRegistry = getExtensionsRegistry();

const DatasourceContainer = styled.div`
  .change-warning {
    margin: 16px 10px 0;
    color: ${({ theme }) => theme.colorWarning};
  }

  .change-warning .bold {
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }

  .form-group.has-feedback > .help-block {
    margin-top: 8px;
  }

  .form-group.form-group-md {
    margin-bottom: 8px;
  }
`;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const StyledTableTabs = styled(Tabs)`
  overflow: visible;
  .ant-tabs-content-holder {
    overflow: visible;
  }
`;

const StyledBadge = styled(Badge)`
  .ant-badge-count {
    line-height: ${({ theme }) => theme.sizeUnit * 4}px;
    height: ${({ theme }) => theme.sizeUnit * 4}px;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const EditLockContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  display: flex;
  align-items: center;
  a {
    padding: 0 10px;
  }
`;

const ColumnButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px`}
`;

const StyledLabelWrapper = styled.div`
  display: flex;
  align-items: center;
  span {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const StyledColumnsTabWrapper = styled.div`
  .table > tbody > tr > td {
    vertical-align: middle;
  }

  .ant-tag {
    margin-top: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
    margin-left: ${theme.sizeUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

const checkboxGenerator = (d, onChange) => (
  <CheckboxControl value={d} onChange={onChange} />
);
const DATA_TYPES = [
  { value: 'STRING', label: t('STRING') },
  { value: 'NUMERIC', label: t('NUMERIC') },
  { value: 'DATETIME', label: t('DATETIME') },
  { value: 'BOOLEAN', label: t('BOOLEAN') },
];

const TABS_KEYS = {
  SOURCE: 'SOURCE',
  METRICS: 'METRICS',
  COLUMNS: 'COLUMNS',
  CALCULATED_COLUMNS: 'CALCULATED_COLUMNS',
  SETTINGS: 'SETTINGS',
  SPATIAL: 'SPATIAL',
};

const DATASOURCE_TYPES_ARR = [
  { key: 'physical', label: t('Physical (table or view)') },
  { key: 'virtual', label: t('Virtual (SQL)') },
];
const DATASOURCE_TYPES = {};
DATASOURCE_TYPES_ARR.forEach(o => {
  DATASOURCE_TYPES[o.key] = o;
});

function CollectionTabTitle({ title, collection }) {
  return (
    <div
      css={{ display: 'flex', alignItems: 'center' }}
      data-test={`collection-tab-${title}`}
    >
      {title}{' '}
      <StyledBadge count={collection ? collection.length : 0} showZero />
    </div>
  );
}

CollectionTabTitle.propTypes = {
  title: PropTypes.string,
  collection: PropTypes.array,
};

function ColumnCollectionTable({
  columns,
  datasource,
  onColumnsChange,
  onDatasourceChange,
  editableColumnName,
  showExpression,
  allowAddItem,
  allowEditDataType,
  itemGenerator,
  columnLabelTooltips,
}) {
  return (
    <CollectionTable
      tableColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
              'column_name',
              'advanced_data_type',
              'type',
              'is_dttm',
              'main_dttm_col',
              'filterable',
              'groupby',
            ]
          : [
              'column_name',
              'type',
              'is_dttm',
              'main_dttm_col',
              'filterable',
              'groupby',
            ]
      }
      sortColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
              'column_name',
              'advanced_data_type',
              'type',
              'is_dttm',
              'main_dttm_col',
              'filterable',
              'groupby',
            ]
          : [
              'column_name',
              'type',
              'is_dttm',
              'main_dttm_col',
              'filterable',
              'groupby',
            ]
      }
      allowDeletes
      allowAddItem={allowAddItem}
      itemGenerator={itemGenerator}
      collection={columns}
      columnLabelTooltips={columnLabelTooltips}
      stickyHeader
      expandFieldset={
        <FormContainer>
          <Fieldset compact>
            {showExpression && (
              <Field
                fieldKey="expression"
                label={t('SQL expression')}
                control={
                  <TextAreaControl
                    language="sql"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            )}
            <Field
              fieldKey="verbose_name"
              label={t('Label')}
              control={
                <TextControl
                  controlId="verbose_name"
                  placeholder={t('Label')}
                />
              }
            />
            <Field
              fieldKey="description"
              label={t('Description')}
              control={
                <TextControl
                  controlId="description"
                  placeholder={t('Description')}
                />
              }
            />
            {allowEditDataType && (
              <Field
                fieldKey="type"
                label={t('Data type')}
                control={
                  <Select
                    ariaLabel={t('Data type')}
                    options={DATA_TYPES}
                    name="type"
                    allowNewOptions
                    allowClear
                  />
                }
              />
            )}
            {isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes) ? (
              <Field
                fieldKey="advanced_data_type"
                label={t('Advanced data type')}
                control={
                  <TextControl
                    controlId="advanced_data_type"
                    placeholder={t('Advanced Data type')}
                  />
                }
              />
            ) : (
              <></>
            )}
            <Field
              fieldKey="python_date_format"
              label={t('Datetime format')}
              description={
                /* Note the fragmented translations may not work. */
                <div>
                  {t('The pattern of timestamp format. For strings use ')}
                  <Typography.Link href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                    {t('Python datetime string pattern')}
                  </Typography.Link>
                  {t(' expression which needs to adhere to the ')}
                  <Typography.Link href="https://en.wikipedia.org/wiki/ISO_8601">
                    {t('ISO 8601')}
                  </Typography.Link>
                  {t(` standard to ensure that the lexicographical ordering
                      coincides with the chronological ordering. If the
                      timestamp format does not adhere to the ISO 8601 standard
                      you will need to define an expression and type for
                      transforming the string into a date or timestamp. Note
                      currently time zones are not supported. If time is stored
                      in epoch format, put \`epoch_s\` or \`epoch_ms\`. If no pattern
                      is specified we fall back to using the optional defaults on a per
                      database/column name level via the extra parameter.`)}
                </div>
              }
              control={
                <TextControl
                  controlId="python_date_format"
                  placeholder="%Y-%m-%d"
                />
              }
            />
            <Field
              fieldKey="certified_by"
              label={t('Certified By')}
              description={t('Person or group that has certified this metric')}
              control={
                <TextControl
                  controlId="certified"
                  placeholder={t('Certified by')}
                />
              }
            />
            <Field
              fieldKey="certification_details"
              label={t('Certification details')}
              description={t('Details of the certification')}
              control={
                <TextControl
                  controlId="certificationDetails"
                  placeholder={t('Certification details')}
                />
              }
            />
          </Fieldset>
        </FormContainer>
      }
      columnLabels={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? {
              column_name: t('Column'),
              advanced_data_type: t('Advanced data type'),
              type: t('Data type'),
              groupby: t('Is dimension'),
              is_dttm: t('Is temporal'),
              main_dttm_col: t('Default datetime'),
              filterable: t('Is filterable'),
            }
          : {
              column_name: t('Column'),
              type: t('Data type'),
              groupby: t('Is dimension'),
              is_dttm: t('Is temporal'),
              main_dttm_col: t('Default datetime'),
              filterable: t('Is filterable'),
            }
      }
      onChange={onColumnsChange}
      itemRenderers={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? {
              column_name: (v, onItemChange, _, record) =>
                editableColumnName ? (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    <EditableTitle
                      canEdit
                      title={v}
                      onSaveTitle={onItemChange}
                    />
                  </StyledLabelWrapper>
                ) : (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    {v}
                  </StyledLabelWrapper>
                ),
              main_dttm_col: (value, _onItemChange, _label, record) => {
                const checked = datasource.main_dttm_col === record.column_name;
                const disabled = !record?.is_dttm;
                return (
                  <Radio
                    aria-label={t(
                      'Set %s as default datetime column',
                      record.column_name,
                    )}
                    data-test={`radio-default-dttm-${record.column_name}`}
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onDatasourceChange({
                        ...datasource,
                        main_dttm_col: record.column_name,
                      })
                    }
                  />
                );
              },
              type: d => (d ? <Label>{d}</Label> : null),
              advanced_data_type: d => (
                <Label onChange={onColumnsChange}>{d}</Label>
              ),
              is_dttm: checkboxGenerator,
              filterable: checkboxGenerator,
              groupby: checkboxGenerator,
            }
          : {
              column_name: (v, onItemChange, _, record) =>
                editableColumnName ? (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    <TextControl value={v} onChange={onItemChange} />
                  </StyledLabelWrapper>
                ) : (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    {v}
                  </StyledLabelWrapper>
                ),
              main_dttm_col: (value, _onItemChange, _label, record) => {
                const checked = datasource.main_dttm_col === record.column_name;
                const disabled = !record?.is_dttm;
                return (
                  <Radio
                    aria-label={t(
                      'Set %s as default datetime column',
                      record.column_name,
                    )}
                    data-test={`radio-default-dttm-${record.column_name}`}
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onDatasourceChange({
                        ...datasource,
                        main_dttm_col: record.column_name,
                      })
                    }
                  />
                );
              },
              type: d => (d ? <Label>{d}</Label> : null),
              is_dttm: checkboxGenerator,
              filterable: checkboxGenerator,
              groupby: checkboxGenerator,
            }
      }
    />
  );
}
ColumnCollectionTable.propTypes = {
  columns: PropTypes.array.isRequired,
  datasource: PropTypes.object.isRequired,
  onColumnsChange: PropTypes.func.isRequired,
  onDatasourceChange: PropTypes.func.isRequired,
  editableColumnName: PropTypes.bool,
  showExpression: PropTypes.bool,
  allowAddItem: PropTypes.bool,
  allowEditDataType: PropTypes.bool,
  itemGenerator: PropTypes.func,
};
ColumnCollectionTable.defaultProps = {
  editableColumnName: false,
  showExpression: false,
  allowAddItem: false,
  allowEditDataType: false,
  itemGenerator: () => ({
    column_name: t('<new column>'),
    filterable: true,
    groupby: true,
  }),
};

function StackedField({ label, formElement }) {
  return (
    <div>
      <div>
        <strong>{label}</strong>
      </div>
      <div>{formElement}</div>
    </div>
  );
}

StackedField.propTypes = {
  label: PropTypes.string,
  formElement: PropTypes.node,
};

function FormContainer({ children }) {
  return (
    <Card padded style={{ backgroundColor: themeObject.theme.colorBgLayout }}>
      {children}
    </Card>
  );
}

FormContainer.propTypes = {
  children: PropTypes.node,
};

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  setIsEditing: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  setIsEditing: () => {},
};

function OwnersSelector({ datasource, onChange }) {
  const loadOptions = useCallback((search = '', page, pageSize) => {
    const query = rison.encode({ filter: search, page, page_size: pageSize });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/related/owners?q=${query}`,
    }).then(response => ({
      data: response.json.result
        .filter(item => item.extra.active)
        .map(item => ({
          value: item.value,
          label: item.text,
        })),
      totalCount: response.json.count,
    }));
  }, []);

  return (
    <AsyncSelect
      ariaLabel={t('Select owners')}
      mode="multiple"
      name="owners"
      value={datasource.owners}
      options={loadOptions}
      onChange={onChange}
      header={<FormLabel>{t('Owners')}</FormLabel>}
      allowClear
    />
  );
}
const ResultTable =
  extensionsRegistry.get('sqleditor.extension.resultTable') ?? FilterableTable;

class DatasourceEditor extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      datasource: {
        ...props.datasource,
        owners: props.datasource.owners.map(owner => ({
          value: owner.value || owner.id,
          label: owner.label || `${owner.first_name} ${owner.last_name}`,
        })),
        metrics: props.datasource.metrics?.map(metric => {
          const {
            certified_by: certifiedByMetric,
            certification_details: certificationDetails,
          } = metric;
          const {
            certification: { details, certified_by: certifiedBy } = {},
            warning_markdown: warningMarkdown,
          } = JSON.parse(metric.extra || '{}') || {};
          return {
            ...metric,
            certification_details: certificationDetails || details,
            warning_markdown: warningMarkdown || '',
            certified_by: certifiedBy || certifiedByMetric,
          };
        }),
      },
      errors: [],
      isSqla:
        props.datasource.datasource_type === 'table' ||
        props.datasource.type === 'table',
      isEditMode: false,
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(
        col => !!col.expression,
      ),
      metadataLoading: false,
      activeTabKey: TABS_KEYS.SOURCE,
      datasourceType: props.datasource.sql
        ? DATASOURCE_TYPES.virtual.key
        : DATASOURCE_TYPES.physical.key,
    };

    this.onChange = this.onChange.bind(this);
    this.onChangeEditMode = this.onChangeEditMode.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.tableChangeAndSyncMetadata =
      this.tableChangeAndSyncMetadata.bind(this);
    this.syncMetadata = this.syncMetadata.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.validateAndChange = this.validateAndChange.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);
    this.formatSql = this.formatSql.bind(this);
    this.currencies = ensureIsArray(props.currencies).map(currencyCode => ({
      value: currencyCode,
      label: `${getCurrencySymbol({
        symbol: currencyCode,
      })} (${currencyCode})`,
    }));
  }

  onChange() {
    // Emptying SQL if "Physical" radio button is selected
    // Currently the logic to know whether the source is
    // physical or virtual is based on whether SQL is empty or not.
    const { datasourceType, datasource } = this.state;
    const sql =
      datasourceType === DATASOURCE_TYPES.physical.key ? '' : datasource.sql;

    const newDatasource = {
      ...this.state.datasource,
      sql,
      columns: [...this.state.databaseColumns, ...this.state.calculatedColumns],
    };

    this.props.onChange(newDatasource, this.state.errors);
  }

  onChangeEditMode() {
    this.props.setIsEditing(!this.state.isEditMode);
    this.setState(prevState => ({ isEditMode: !prevState.isEditMode }));
  }

  onDatasourceChange(datasource, callback = this.validateAndChange) {
    this.setState({ datasource }, callback);
  }

  onDatasourcePropChange(attr, value) {
    if (value === undefined) return; // if value is undefined do not update state
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState(
      prevState => ({
        datasource: { ...prevState.datasource, [attr]: value },
      }),
      attr === 'table_name'
        ? this.onDatasourceChange(datasource, this.tableChangeAndSyncMetadata)
        : this.onDatasourceChange(datasource, this.validateAndChange),
    );
  }

  onDatasourceTypeChange(datasourceType) {
    // Call onChange after setting datasourceType to ensure
    // SQL is cleared when switching to a physical dataset
    this.setState({ datasourceType }, this.onChange);
  }

  setColumns(obj) {
    // update calculatedColumns or databaseColumns
    this.setState(obj, this.validateAndChange);
  }

  validateAndChange() {
    this.validate(this.onChange);
  }

  async onQueryRun() {
    this.props.runQuery({
      client_id: this.props.clientId,
      database_id: this.state.datasource.database.id,
      json: true,
      runAsync: false,
      catalog: this.state.datasource.catalog,
      schema: this.state.datasource.schema,
      sql: this.state.datasource.sql,
      tmp_table_name: '',
      select_as_cta: false,
      ctas_method: 'TABLE',
      queryLimit: 25,
      expand_data: true,
    });
  }

  async onQueryFormat() {
    const { datasource } = this.state;
    if (!datasource.sql || !this.state.isEditMode) {
      return;
    }

    try {
      const response = await this.props.formatQuery(datasource.sql);
      this.onDatasourcePropChange('sql', response.json.result);
      this.props.addSuccessToast(t('SQL was formatted'));
    } catch (error) {
      const { error: clientError, statusText } =
        await getClientErrorObject(error);
      this.props.addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while formatting SQL'),
      );
    }
  }

  getSQLLabUrl() {
    const queryParams = new URLSearchParams({
      dbid: this.state.datasource.database.id,
      sql: this.state.datasource.sql,
      name: this.state.datasource.datasource_name,
      schema: this.state.datasource.schema,
      autorun: true,
      isDataset: true,
    });
    return `/sqllab/?${queryParams.toString()}`;
  }

  openOnSqlLab() {
    window.open(this.getSQLLabUrl(), '_blank', 'noopener,noreferrer');
  }

  tableChangeAndSyncMetadata() {
    this.validate(() => {
      this.syncMetadata();
      this.onChange();
    });
  }

  async formatSql() {
    const { datasource } = this.state;
    if (!datasource.sql) {
      return;
    }

    try {
      const response = await SupersetClient.post({
        endpoint: '/api/v1/sql/format',
        body: JSON.stringify({ sql: datasource.sql }),
        headers: { 'Content-Type': 'application/json' },
      });
      this.onDatasourcePropChange('sql', response.json.result);
      this.props.addSuccessToast(t('SQL was formatted'));
    } catch (error) {
      const { error: clientError, statusText } =
        await getClientErrorObject(error);
      this.props.addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while formatting SQL'),
      );
    }
  }

  async syncMetadata() {
    const { datasource } = this.state;
    this.setState({ metadataLoading: true });
    try {
      const newCols = await fetchSyncedColumns(datasource);
      const columnChanges = updateColumns(
        datasource.columns,
        newCols,
        this.props.addSuccessToast,
      );
      this.setColumns({
        databaseColumns: columnChanges.finalColumns.filter(
          col => !col.expression, // remove calculated columns
        ),
      });
      this.props.addSuccessToast(t('Metadata has been synced'));
      this.setState({ metadataLoading: false });
    } catch (error) {
      const { error: clientError, statusText } =
        await getClientErrorObject(error);
      this.props.addDangerToast(
        clientError || statusText || t('An error has occurred'),
      );
      this.setState({ metadataLoading: false });
    }
  }

  findDuplicates(arr, accessor) {
    const seen = {};
    const dups = [];
    arr.forEach(obj => {
      const item = accessor(obj);
      if (item in seen) {
        dups.push(item);
      } else {
        seen[item] = null;
      }
    });
    return dups;
  }

  validate(callback) {
    let errors = [];
    let dups;
    const { datasource } = this.state;

    // Looking for duplicate column_name
    dups = this.findDuplicates(datasource.columns, obj => obj.column_name);
    errors = errors.concat(
      dups.map(name => t('Column name [%s] is duplicated', name)),
    );

    // Looking for duplicate metric_name
    dups = this.findDuplicates(datasource.metrics, obj => obj.metric_name);
    errors = errors.concat(
      dups.map(name => t('Metric name [%s] is duplicated', name)),
    );

    // Making sure calculatedColumns have an expression defined
    const noFilterCalcCols = this.state.calculatedColumns.filter(
      col => !col.expression && !col.json,
    );
    errors = errors.concat(
      noFilterCalcCols.map(col =>
        t('Calculated column [%s] requires an expression', col.column_name),
      ),
    );

    // validate currency code
    try {
      this.state.datasource.metrics?.forEach(
        metric =>
          metric.currency?.symbol &&
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: metric.currency.symbol,
          }),
      );
    } catch {
      errors = errors.concat([t('Invalid currency code in saved metrics')]);
    }

    this.setState({ errors }, callback);
  }

  handleTabSelect(activeTabKey) {
    this.setState({ activeTabKey });
  }

  sortMetrics(metrics) {
    return metrics.sort(({ id: a }, { id: b }) => b - a);
  }

  renderSettingsFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Basic')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        <Field
          fieldKey="description"
          label={t('Description')}
          control={
            <TextAreaControl
              language="markdown"
              offerEditInModal={false}
              resize="vertical"
            />
          }
        />
        <Field
          fieldKey="default_endpoint"
          label={t('Default URL')}
          description={
            <>
              {t(
                'Default URL to redirect to when accessing from the dataset list page. Accepts relative URLs such as',
              )}{' '}
              <Typography.Text code>
                /superset/dashboard/{'{id}'}/
              </Typography.Text>
            </>
          }
          control={<TextControl controlId="default_endpoint" />}
        />
        <Field
          inline
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          description={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="fetch_values_predicate"
            label={t('Autocomplete query predicate')}
            description={t(
              'When using "Autocomplete filters", this can be used to improve performance ' +
                'of the query fetching the values. Use this option to apply a ' +
                'predicate (WHERE clause) to the query selecting the distinct ' +
                'values from the table. Typically the intent would be to limit the scan ' +
                'by applying a relative time filter on a partitioned or indexed time-related field.',
            )}
            control={
              <TextAreaControl
                language="sql"
                controlId="fetch_values_predicate"
                minLines={5}
                resize="vertical"
              />
            }
          />
        )}
        {this.state.isSqla && (
          <Field
            fieldKey="extra"
            label={t('Extra')}
            description={t(
              'Extra data to specify table metadata. Currently supports ' +
                'metadata of the format: `{ "certification": { "certified_by": ' +
                '"Data Platform Team", "details": "This table is the source of truth." ' +
                '}, "warning_markdown": "This is a warning." }`.',
            )}
            control={
              <TextAreaControl
                controlId="extra"
                language="json"
                offerEditInModal={false}
                resize="vertical"
              />
            }
          />
        )}
        <OwnersSelector
          datasource={datasource}
          onChange={newOwners => {
            this.onDatasourceChange({ ...datasource, owners: newOwners });
          }}
        />
      </Fieldset>
    );
  }

  renderAdvancedFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Advanced')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        <Field
          fieldKey="cache_timeout"
          label={t('Cache timeout')}
          description={t(
            'The duration of time in seconds before the cache is invalidated. Set to -1 to bypass the cache.',
          )}
          control={<TextControl controlId="cache_timeout" />}
        />
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl controlId="offset" />}
          description={t(
            'The number of hours, negative or positive, to shift the time column. This can be used to move UTC time to local time.',
          )}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="template_params"
            label={t('Template parameters')}
            description={t(
              'A set of parameters that become available in the query using Jinja templating syntax',
            )}
            control={<TextControl controlId="template_params" />}
          />
        )}
        <Field
          inline
          fieldKey="normalize_columns"
          label={t('Normalize column names')}
          description={t(
            'Allow column names to be changed to case insensitive format, if supported (e.g. Oracle, Snowflake).',
          )}
          control={<CheckboxControl controlId="normalize_columns" />}
        />
        <Field
          inline
          fieldKey="always_filter_main_dttm"
          label={t('Always filter main datetime column')}
          description={t(
            `When the secondary temporal columns are filtered, apply the same filter to the main datetime column.`,
          )}
          control={<CheckboxControl controlId="always_filter_main_dttm" />}
        />
      </Fieldset>
    );
  }

  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;

    return {
      key: TABS_KEYS.SPATIAL,
      label: <CollectionTabTitle collection={spatials} title={t('Spatial')} />,
      children: (
        <CollectionTable
          tableColumns={['name', 'config']}
          onChange={this.onDatasourcePropChange.bind(this, 'spatials')}
          itemGenerator={() => ({
            name: t('<new spatial>'),
            type: t('<no type>'),
            config: null,
          })}
          collection={spatials}
          allowDeletes
          itemRenderers={{
            name: (d, onChange) => (
              <EditableTitle canEdit title={d} onSaveTitle={onChange} />
            ),
            config: (v, onChange) => (
              <SpatialControl value={v} onChange={onChange} choices={allCols} />
            ),
          }}
        />
      ),
    };
  }

  renderSqlEditorOverlay = () => (
    <div
      css={theme => css`
        position: absolute;
        background: ${theme.colorBgLayout};
        align-items: center;
        display: flex;
        height: 100%;
        width: 100%;
        justify-content: center;
      `}
    >
      <div>
        <Loading position="inline-centered" />
        <span
          css={theme => css`
            display: block;
            margin: ${theme.sizeUnit * 4}px auto;
            width: fit-content;
            color: ${theme.colorText};
          `}
        >
          {t('We are working on your query')}
        </span>
      </div>
    </div>
  );

  renderOpenInSqlLabLink(isError = false) {
    return (
      <a
        href={this.getSQLLabUrl()}
        target="_blank"
        rel="noopener noreferrer"
        css={theme => css`
          color: ${isError ? theme.colorErrorText : theme.colorText};
          font-size: ${theme.fontSizeSM}px;
          text-decoration: underline;
        `}
      >
        {t('Open in SQL lab')}
      </a>
    );
  }

  renderSqlErrorMessage = () => (
    <span
      css={theme => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorErrorText};
      `}
    >
      {this.props.database?.error && t('Error executing query. ')}
      {this.renderOpenInSqlLabLink(true)}
      {t(' to check for details.')}
    </span>
  );

  renderSourceFieldset() {
    const { datasource } = this.state;

    return (
      <div>
        <EditLockContainer>
          <span
            css={theme => css`
              color: ${theme.colorTextTertiary};
            `}
            role="button"
            tabIndex={0}
            onClick={this.onChangeEditMode}
          >
            {this.state.isEditMode ? (
              <Icons.UnlockOutlined
                iconSize="xl"
                css={theme => css`
                  margin: auto ${theme.sizeUnit}px auto 0;
                `}
              />
            ) : (
              <Icons.LockOutlined
                iconSize="xl"
                css={theme => ({
                  margin: `auto ${theme.sizeUnit}px auto 0`,
                })}
              />
            )}
          </span>
          {!this.state.isEditMode && (
            <div>{t('Click the lock to make changes.')}</div>
          )}
          {this.state.isEditMode && (
            <div>{t('Click the lock to prevent further changes.')}</div>
          )}
        </EditLockContainer>
        <div
          css={theme => css`
            margin-top: ${theme.sizeUnit * 3}px;
          `}
        >
          {DATASOURCE_TYPES_ARR.map(type => (
            <Radio
              key={type.key}
              value={type.key}
              inline
              onChange={this.onDatasourceTypeChange.bind(this, type.key)}
              checked={this.state.datasourceType === type.key}
              disabled={!this.state.isEditMode}
            >
              {type.label}
            </Radio>
          ))}
        </div>
        <Divider />
        <Fieldset item={datasource} onChange={this.onDatasourceChange} compact>
          {this.state.datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              {this.state.isSqla && (
                <>
                  <Col xs={24} md={12}>
                    <Field
                      fieldKey="databaseSelector"
                      label={t('Virtual')}
                      control={
                        <div css={{ marginTop: 8 }}>
                          <DatabaseSelector
                            db={datasource?.database}
                            catalog={datasource.catalog}
                            schema={datasource.schema}
                            onCatalogChange={catalog =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('catalog', catalog)
                            }
                            onSchemaChange={schema =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('schema', schema)
                            }
                            onDbChange={database =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('database', database)
                            }
                            formMode={false}
                            handleError={this.props.addDangerToast}
                            readOnly={!this.state.isEditMode}
                          />
                        </div>
                      }
                    />
                    <div css={{ width: 'calc(100% - 34px)', marginTop: -16 }}>
                      <Field
                        fieldKey="table_name"
                        label={t('Name')}
                        control={
                          <TextControl
                            controlId="table_name"
                            onChange={table => {
                              this.onDatasourcePropChange('table_name', table);
                            }}
                            placeholder={t('Dataset name')}
                            disabled={!this.state.isEditMode}
                          />
                        }
                      />
                    </div>
                  </Col>
                  <Field
                    fieldKey="sql"
                    label={t('SQL')}
                    description={t(
                      'When specifying SQL, the datasource acts as a view. ' +
                        'Superset will use this statement as a subquery while grouping and filtering ' +
                        'on the generated parent queries.' +
                        'If changes are made to your SQL query, ' +
                        'columns in your dataset will be synced when saving the dataset.',
                    )}
                    control={
                      this.props.database?.isLoading ? (
                        <>
                          {this.renderSqlEditorOverlay()}
                          <TextAreaControl
                            hotkeys={[
                              {
                                name: 'formatQuery',
                                key: 'ctrl+shift+f',
                                descr: t('Format SQL query'),
                                func: () => {
                                  this.onQueryFormat();
                                },
                              },
                            ]}
                            language="sql"
                            offerEditInModal={false}
                            minLines={10}
                            maxLines={Infinity}
                            readOnly={!this.state.isEditMode}
                            resize="both"
                          />
                        </>
                      ) : (
                        <TextAreaControl
                          css={theme => css`
                            margin-top: ${theme.sizeUnit * 3}px;
                          `}
                          hotkeys={[
                            {
                              name: 'formatQuery',
                              key: 'ctrl+shift+f',
                              descr: t('Format SQL query'),
                              func: () => {
                                this.onQueryFormat();
                              },
                            },
                          ]}
                          language="sql"
                          offerEditInModal={false}
                          minLines={10}
                          maxLines={Infinity}
                          readOnly={!this.state.isEditMode}
                          resize="both"
                        />
                      )
                    }
                    additionalControl={
                      <div
                        css={css`
                          position: absolute;
                          right: 0;
                          top: 0;
                          z-index: 2;
                          display: flex;
                        `}
                      >
                        <Button
                          disabled={this.props.database?.isLoading}
                          tooltip={t('Open SQL Lab in a new tab')}
                          buttonStyle="secondary"
                          onClick={() => {
                            this.openOnSqlLab();
                          }}
                          icon={<Icons.ExportOutlined iconSize="s" />}
                        />
                        <Button
                          disabled={this.props.database?.isLoading}
                          tooltip={t('Run query')}
                          buttonStyle="primary"
                          onClick={() => {
                            this.onQueryRun();
                          }}
                          icon={<Icons.CaretRightFilled iconSize="s" />}
                        />
                      </div>
                    }
                  />
                  {this.props.database?.queryResult && (
                    <>
                      <div
                        css={theme => css`
                          margin-bottom: ${theme.sizeUnit}px;
                        `}
                      >
                        <span
                          css={theme => css`
                            color: ${theme.colorText};
                            font-size: ${theme.fontSizeSM}px;
                          `}
                        >
                          {t(
                            'In this view you can preview the first 25 rows. ',
                          )}
                        </span>
                        {this.renderOpenInSqlLabLink()}
                        <span
                          css={theme => css`
                            color: ${theme.colorText};
                            font-size: ${theme.fontSizeSM}px;
                          `}
                        >
                          {t(' to see details.')}
                        </span>
                      </div>
                      <ResultTable
                        data={this.props.database?.queryResult.data}
                        queryId={this.props.database?.queryResult.query.id}
                        orderedColumnKeys={this.props.database?.queryResult.columns.map(
                          col => col.column_name,
                        )}
                        expandedColumns={
                          this.props.database?.queryResult.expandedColumns
                        }
                        height={300}
                        allowHTML
                      />
                    </>
                  )}
                  {this.props.database?.error && this.renderSqlErrorMessage()}
                </>
              )}
            </div>
          )}
          {this.state.datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col xs={24} md={12}>
              {this.state.isSqla && (
                <Field
                  fieldKey="tableSelector"
                  label={t('Physical')}
                  control={
                    <div css={{ marginTop: 8 }}>
                      <TableSelector
                        clearable={false}
                        database={{
                          ...datasource.database,
                          database_name:
                            datasource.database?.database_name ||
                            datasource.database?.name,
                        }}
                        dbId={datasource.database?.id}
                        handleError={this.props.addDangerToast}
                        catalog={datasource.catalog}
                        schema={datasource.schema}
                        sqlLabMode={false}
                        tableValue={datasource.table_name}
                        onCatalogChange={
                          this.state.isEditMode
                            ? catalog =>
                                this.onDatasourcePropChange('catalog', catalog)
                            : undefined
                        }
                        onSchemaChange={
                          this.state.isEditMode
                            ? schema =>
                                this.onDatasourcePropChange('schema', schema)
                            : undefined
                        }
                        onDbChange={
                          this.state.isEditMode
                            ? database =>
                                this.onDatasourcePropChange(
                                  'database',
                                  database,
                                )
                            : undefined
                        }
                        onTableSelectChange={
                          this.state.isEditMode
                            ? table =>
                                this.onDatasourcePropChange('table_name', table)
                            : undefined
                        }
                        readOnly={!this.state.isEditMode}
                      />
                    </div>
                  }
                  description={t(
                    'The pointer to a physical table (or view). Keep in mind that the chart is ' +
                      'associated to this Superset logical table, and this logical table points ' +
                      'the physical table referenced here.',
                  )}
                />
              )}
            </Col>
          )}
        </Fieldset>
      </div>
    );
  }

  renderErrors() {
    if (this.state.errors.length > 0) {
      return (
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
          type="error"
          message={
            <>
              {this.state.errors.map(err => (
                <div key={err}>{err}</div>
              ))}
            </>
          }
        />
      );
    }
    return null;
  }

  renderMetricCollection() {
    const { datasource } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
    return (
      <CollectionTable
        tableColumns={['metric_name', 'verbose_name', 'expression']}
        sortColumns={['metric_name', 'verbose_name', 'expression']}
        columnLabels={{
          metric_name: t('Metric Key'),
          verbose_name: t('Label'),
          expression: t('SQL expression'),
        }}
        columnLabelTooltips={{
          metric_name: t(
            'This field is used as a unique identifier to attach ' +
              'the metric to charts. It is also used as the alias in the ' +
              'SQL query.',
          ),
        }}
        expandFieldset={
          <FormContainer>
            <Fieldset compact>
              <Field
                fieldKey="description"
                label={t('Description')}
                control={
                  <TextControl
                    controlId="description"
                    placeholder={t('Description')}
                  />
                }
              />
              <Field
                fieldKey="d3format"
                label={t('D3 format')}
                control={
                  <TextControl controlId="d3format" placeholder="%y/%m/%d" />
                }
              />
              <Field
                fieldKey="currency"
                label={t('Metric currency')}
                control={
                  <CurrencyControl
                    currencySelectOverrideProps={{
                      placeholder: t('Select or type currency symbol'),
                    }}
                    symbolSelectAdditionalStyles={css`
                      max-width: 30%;
                    `}
                  />
                }
              />
              <Field
                label={t('Certified by')}
                fieldKey="certified_by"
                description={t(
                  'Person or group that has certified this metric',
                )}
                control={
                  <TextControl
                    controlId="certified_by"
                    placeholder={t('Certified by')}
                  />
                }
              />
              <Field
                label={t('Certification details')}
                fieldKey="certification_details"
                description={t('Details of the certification')}
                control={
                  <TextControl
                    controlId="certification_details"
                    placeholder={t('Certification details')}
                  />
                }
              />
              <Field
                label={t('Warning')}
                fieldKey="warning_markdown"
                description={t('Optional warning about use of this metric')}
                control={
                  <TextAreaControl
                    controlId="warning_markdown"
                    language="markdown"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            </Fieldset>
          </FormContainer>
        }
        collection={sortedMetrics}
        allowAddItem
        onChange={this.onDatasourcePropChange.bind(this, 'metrics')}
        itemGenerator={() => ({
          metric_name: t('<new metric>'),
          verbose_name: '',
          expression: '',
        })}
        itemCellProps={{
          expression: () => ({
            width: '240px',
          }),
        }}
        itemRenderers={{
          metric_name: (v, onChange, _, record) => (
            <FlexRowContainer>
              {record.is_certified && (
                <CertifiedBadge
                  certifiedBy={record.certified_by}
                  details={record.certification_details}
                />
              )}
              {record.warning_markdown && (
                <WarningIconWithTooltip
                  warningMarkdown={record.warning_markdown}
                />
              )}
              <EditableTitle
                canEdit
                title={v}
                onSaveTitle={onChange}
                maxWidth={300}
              />
            </FlexRowContainer>
          ),
          verbose_name: (v, onChange) => (
            <TextControl canEdit value={v} onChange={onChange} />
          ),
          expression: (v, onChange) => (
            <TextAreaControl
              canEdit
              initialValue={v}
              onChange={onChange}
              extraClasses={['datasource-sql-expression']}
              language="sql"
              offerEditInModal={false}
              minLines={5}
              textAreaStyles={{ minWidth: '200px', maxWidth: '450px' }}
              resize="both"
            />
          ),
          description: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />
          ),
          d3format: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />
          ),
        }}
        allowDeletes
        stickyHeader
      />
    );
  }

  render() {
    const { datasource, activeTabKey } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
    const { theme } = this.props;

    return (
      <DatasourceContainer data-test="datasource-editor">
        {this.renderErrors()}
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
          type="warning"
          message={
            <>
              {' '}
              <strong>{t('Be careful.')} </strong>
              {t(
                'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
              )}
            </>
          }
        />
        <StyledTableTabs
          id="table-tabs"
          data-test="edit-dataset-tabs"
          onChange={this.handleTabSelect}
          defaultActiveKey={activeTabKey}
          items={[
            {
              key: TABS_KEYS.SOURCE,
              label: t('Source'),
              children: this.renderSourceFieldset(theme),
            },
            {
              key: TABS_KEYS.METRICS,
              label: (
                <CollectionTabTitle
                  collection={sortedMetrics}
                  title={t('Metrics')}
                />
              ),
              children: this.renderMetricCollection(),
            },
            {
              key: TABS_KEYS.COLUMNS,
              label: (
                <CollectionTabTitle
                  collection={this.state.databaseColumns}
                  title={t('Columns')}
                />
              ),
              children: (
                <StyledColumnsTabWrapper>
                  <ColumnButtonWrapper>
                    <StyledButtonWrapper>
                      <Button
                        buttonSize="small"
                        buttonStyle="tertiary"
                        onClick={this.syncMetadata}
                        className="sync-from-source"
                        disabled={this.state.isEditMode}
                      >
                        <Icons.DatabaseOutlined iconSize="m" />
                        {t('Sync columns from source')}
                      </Button>
                    </StyledButtonWrapper>
                  </ColumnButtonWrapper>
                  <ColumnCollectionTable
                    className="columns-table"
                    columns={this.state.databaseColumns}
                    datasource={datasource}
                    onColumnsChange={databaseColumns =>
                      this.setColumns({ databaseColumns })
                    }
                    onDatasourceChange={this.onDatasourceChange}
                  />
                  {this.state.metadataLoading && <Loading />}
                </StyledColumnsTabWrapper>
              ),
            },
            {
              key: TABS_KEYS.CALCULATED_COLUMNS,
              label: (
                <CollectionTabTitle
                  collection={this.state.calculatedColumns}
                  title={t('Calculated columns')}
                />
              ),
              children: (
                <StyledColumnsTabWrapper>
                  <ColumnCollectionTable
                    columns={this.state.calculatedColumns}
                    onColumnsChange={calculatedColumns =>
                      this.setColumns({ calculatedColumns })
                    }
                    columnLabelTooltips={{
                      column_name: t(
                        'This field is used as a unique identifier to attach ' +
                          'the calculated dimension to charts. It is also used ' +
                          'as the alias in the SQL query.',
                      ),
                    }}
                    onDatasourceChange={this.onDatasourceChange}
                    datasource={datasource}
                    editableColumnName
                    showExpression
                    allowAddItem
                    allowEditDataType
                    itemGenerator={() => ({
                      column_name: t('<new column>'),
                      filterable: true,
                      groupby: true,
                      expression: t('<enter SQL expression here>'),
                      expanded: true,
                    })}
                  />
                </StyledColumnsTabWrapper>
              ),
            },
            {
              key: TABS_KEYS.SETTINGS,
              label: t('Settings'),
              children: (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <FormContainer>
                      {this.renderSettingsFieldset()}
                    </FormContainer>
                  </Col>
                  <Col xs={24} md={12}>
                    <FormContainer>
                      {this.renderAdvancedFieldset()}
                    </FormContainer>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </DatasourceContainer>
    );
  }

  componentDidUpdate(prevProps) {
    // Preserve calculated columns order when props change to prevent jumping
    if (this.props.datasource !== prevProps.datasource) {
      const newCalculatedColumns = this.props.datasource.columns.filter(
        col => !!col.expression,
      );
      const currentCalculatedColumns = this.state.calculatedColumns;

      if (newCalculatedColumns.length === currentCalculatedColumns.length) {
        // Try to preserve the order by matching with existing calculated columns
        const orderedCalculatedColumns = [];
        const usedIds = new Set();

        // First, add existing columns in their current order
        currentCalculatedColumns.forEach(currentCol => {
          const id = currentCol.id || currentCol.column_name;
          const updatedCol = newCalculatedColumns.find(
            newCol => (newCol.id || newCol.column_name) === id,
          );
          if (updatedCol) {
            orderedCalculatedColumns.push(updatedCol);
            usedIds.add(id);
          }
        });

        // Then add any new columns that weren't in the current list
        newCalculatedColumns.forEach(newCol => {
          const id = newCol.id || newCol.column_name;
          if (!usedIds.has(id)) {
            orderedCalculatedColumns.push(newCol);
          }
        });

        this.setState({
          calculatedColumns: orderedCalculatedColumns,
          databaseColumns: this.props.datasource.columns.filter(
            col => !col.expression,
          ),
        });
      }
    }
  }

  componentDidMount() {
    Mousetrap.bind('ctrl+shift+f', e => {
      e.preventDefault();
      if (this.state.isEditMode) {
        this.onQueryFormat();
      }
      return false;
    });
  }

  componentWillUnmount() {
    Mousetrap.unbind('ctrl+shift+f');
    this.props.resetQuery();
  }
}

DatasourceEditor.defaultProps = defaultProps;
DatasourceEditor.propTypes = propTypes;

const DataSourceComponent = withTheme(DatasourceEditor);

const mapDispatchToProps = dispatch => ({
  runQuery: payload => dispatch(executeQuery(payload)),
  resetQuery: () => dispatch(resetDatabaseState()),
  formatQuery: sql => dispatch(formatQuery(sql)),
});
const mapStateToProps = state => ({
  database: state?.database,
});
export default withToasts(
  connect(mapStateToProps, mapDispatchToProps)(DataSourceComponent),
);
