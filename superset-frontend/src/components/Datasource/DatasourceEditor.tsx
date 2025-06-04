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
import { executeQuery, resetDatabaseState } from 'src/database/actions';
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

const sqlTooltipOptions = {
  placement: 'topRight',
  title: t(
    'If changes are made to your SQL query, ' +
      'columns in your dataset will be synced when saving the dataset.',
  ),
};

const checkboxGenerator = (d: $TSFixMe, onChange: $TSFixMe) => (
  // @ts-expect-error TS(2769): No overload matches this call.
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
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  DATASOURCE_TYPES[o.key] = o;
});

function CollectionTabTitle({ title, collection }: $TSFixMe) {
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
}: $TSFixMe) {
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
          // @ts-expect-error TS(2739): Type '{ children: any[]; compact: true; }' is miss... Remove this comment to see the full error message
          <Fieldset compact>
            {showExpression && (
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
              <Field
                fieldKey="expression"
                label={t('SQL expression')}
                control={
                  <TextAreaControl
                    // @ts-expect-error TS(2322): Type '{ language: string; offerEditInModal: boolea... Remove this comment to see the full error message
                    language="markdown"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            )}
            // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2322): Type '{ column_name: (v: any, onItemChange: any, _... Remove this comment to see the full error message
              column_name: (
                v: $TSFixMe,
                onItemChange: $TSFixMe,
                _: $TSFixMe,
                record: $TSFixMe,
              ) =>
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
              main_dttm_col: (
                value: $TSFixMe,
                _onItemChange: $TSFixMe,
                _label: $TSFixMe,
                record: $TSFixMe,
              ) => {
                const checked = datasource.main_dttm_col === record.column_name;
                const disabled = !record?.is_dttm;
                return (
                  <Radio
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
              type: (d: $TSFixMe) => (d ? <Label>{d}</Label> : null),
              advanced_data_type: (d: $TSFixMe) => (
                <Label onChange={onColumnsChange}>{d}</Label>
              ),
              is_dttm: checkboxGenerator,
              filterable: checkboxGenerator,
              groupby: checkboxGenerator,
            }
          : {
              column_name: (
                v: $TSFixMe,
                onItemChange: $TSFixMe,
                _: $TSFixMe,
                record: $TSFixMe,
              ) =>
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
              main_dttm_col: (
                value: $TSFixMe,
                _onItemChange: $TSFixMe,
                _label: $TSFixMe,
                record: $TSFixMe,
              ) => {
                const checked = datasource.main_dttm_col === record.column_name;
                const disabled = !record?.is_dttm;
                return (
                  <Radio
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
              type: (d: $TSFixMe) => (d ? <Label>{d}</Label> : null),
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

function StackedField({ label, formElement }: $TSFixMe) {
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

function FormContainer({ children }: $TSFixMe) {
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

function OwnersSelector({ datasource, onChange }: $TSFixMe) {
  const loadOptions = useCallback((search = '', page, pageSize) => {
    const query = rison.encode({ filter: search, page, page_size: pageSize });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/related/owners?q=${query}`,
    }).then(response => ({
      data: response.json.result
        .filter((item: $TSFixMe) => item.extra.active)
        .map((item: $TSFixMe) => ({
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
  currencies: $TSFixMe;

  constructor(props: $TSFixMe) {
    super(props);
    this.state = {
      datasource: {
        ...props.datasource,
        owners: props.datasource.owners.map((owner: $TSFixMe) => ({
          value: owner.value || owner.id,
          label: owner.label || `${owner.first_name} ${owner.last_name}`,
        })),
        metrics: props.datasource.metrics?.map((metric: $TSFixMe) => {
          const {
            certified_by: certifiedByMetric,
            certification_details: certificationDetails,
          } = metric;
          const {
            // @ts-expect-error TS(2525): Initializer provides no value for this binding ele... Remove this comment to see the full error message
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
      databaseColumns: props.datasource.columns.filter(
        (col: $TSFixMe) => !col.expression,
      ),
      calculatedColumns: props.datasource.columns.filter(
        (col: $TSFixMe) => !!col.expression,
      ),
      metadataLoading: false,
      activeTabKey: TABS_KEYS.SOURCE,
      datasourceType: props.datasource.sql
        // @ts-expect-error TS(2339): Property 'virtual' does not exist on type '{}'.
        ? DATASOURCE_TYPES.virtual.key
        // @ts-expect-error TS(2339): Property 'physical' does not exist on type '{}'.
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
    // @ts-expect-error TS(2339): Property 'datasourceType' does not exist on type '... Remove this comment to see the full error message
    const { datasourceType, datasource } = this.state;
    const sql =
      // @ts-expect-error TS(2339): Property 'physical' does not exist on type '{}'.
      datasourceType === DATASOURCE_TYPES.physical.key ? '' : datasource.sql;
    const newDatasource = {
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      ...this.state.datasource,
      sql,
      // @ts-expect-error TS(2339): Property 'databaseColumns' does not exist on type ... Remove this comment to see the full error message
      columns: [...this.state.databaseColumns, ...this.state.calculatedColumns],
    };
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(newDatasource, this.state.errors);
  }

  onChangeEditMode() {
    // @ts-expect-error TS(2339): Property 'setIsEditing' does not exist on type 'Re... Remove this comment to see the full error message
    this.props.setIsEditing(!this.state.isEditMode);
    // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
    this.setState(prevState => ({ isEditMode: !prevState.isEditMode }));
  }

  onDatasourceChange(datasource: $TSFixMe, callback = this.validateAndChange) {
    this.setState({ datasource }, callback);
  }

  onDatasourcePropChange(attr: $TSFixMe, value: $TSFixMe) {
    if (value === undefined) return; // if value is undefined do not update state
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState(
      prevState => ({
        // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
        datasource: { ...prevState.datasource, [attr]: value },
      }),
      // @ts-expect-error TS(2345): Argument of type 'void' is not assignable to param... Remove this comment to see the full error message
      attr === 'table_name'
        ? this.onDatasourceChange(datasource, this.tableChangeAndSyncMetadata)
        : this.onDatasourceChange(datasource, this.validateAndChange),
    );
  }

  onDatasourceTypeChange(datasourceType: $TSFixMe) {
    this.setState({ datasourceType });
  }

  setColumns(obj: $TSFixMe) {
    // update calculatedColumns or databaseColumns
    this.setState(obj, this.validateAndChange);
  }

  validateAndChange() {
    this.validate(this.onChange);
  }

  async onQueryRun() {
    // @ts-expect-error TS(2339): Property 'runQuery' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.runQuery({
      // @ts-expect-error TS(2339): Property 'clientId' does not exist on type 'Readon... Remove this comment to see the full error message
      client_id: this.props.clientId,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      database_id: this.state.datasource.database.id,
      json: true,
      runAsync: false,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      catalog: this.state.datasource.catalog,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      schema: this.state.datasource.schema,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      sql: this.state.datasource.sql,
      tmp_table_name: '',
      select_as_cta: false,
      ctas_method: 'TABLE',
      queryLimit: 25,
      expand_data: true,
    });
  }

  tableChangeAndSyncMetadata() {
    this.validate(() => {
      this.syncMetadata();
      this.onChange();
    });
  }

  async syncMetadata() {
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.state;
    this.setState({ metadataLoading: true });
    try {
      const newCols = await fetchSyncedColumns(datasource);
      const columnChanges = updateColumns(
        datasource.columns,
        newCols,
        // @ts-expect-error TS(2339): Property 'addSuccessToast' does not exist on type ... Remove this comment to see the full error message
        this.props.addSuccessToast,
      );
      this.setColumns({
        databaseColumns: columnChanges.finalColumns.filter(
          // @ts-expect-error TS(2339): Property 'expression' does not exist on type 'neve... Remove this comment to see the full error message
          col => !col.expression, // remove calculated columns
        ),
      });
      // @ts-expect-error TS(2339): Property 'addSuccessToast' does not exist on type ... Remove this comment to see the full error message
      this.props.addSuccessToast(t('Metadata has been synced'));
      this.setState({ metadataLoading: false });
    } catch (error) {
      const { error: clientError, statusText } =
        await getClientErrorObject(error);
      // @ts-expect-error TS(2339): Property 'addDangerToast' does not exist on type '... Remove this comment to see the full error message
      this.props.addDangerToast(
        clientError || statusText || t('An error has occurred'),
      );
      this.setState({ metadataLoading: false });
    }
  }

  findDuplicates(arr: $TSFixMe, accessor: $TSFixMe) {
    const seen = {};
    const dups: $TSFixMe = [];
    arr.forEach((obj: $TSFixMe) => {
      const item = accessor(obj);
      if (item in seen) {
        dups.push(item);
      } else {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        seen[item] = null;
      }
    });
    return dups;
  }

  validate(callback: $TSFixMe) {
    let errors: $TSFixMe = [];
    let dups;
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.state;

    // Looking for duplicate column_name
    dups = this.findDuplicates(
      datasource.columns,
      (obj: $TSFixMe) => obj.column_name,
    );
    errors = errors.concat(
      // @ts-expect-error TS(7006): Parameter 'name' implicitly has an 'any' type.
      dups.map(name => t('Column name [%s] is duplicated', name)),
    );

    // Looking for duplicate metric_name
    dups = this.findDuplicates(
      datasource.metrics,
      (obj: $TSFixMe) => obj.metric_name,
    );
    errors = errors.concat(
      // @ts-expect-error TS(7006): Parameter 'name' implicitly has an 'any' type.
      dups.map(name => t('Metric name [%s] is duplicated', name)),
    );

    // Making sure calculatedColumns have an expression defined
    // @ts-expect-error TS(2339): Property 'calculatedColumns' does not exist on typ... Remove this comment to see the full error message
    const noFilterCalcCols = this.state.calculatedColumns.filter(
      (col: $TSFixMe) => !col.expression && !col.json,
    );
    errors = errors.concat(
      noFilterCalcCols.map((col: $TSFixMe) =>
        t('Calculated column [%s] requires an expression', col.column_name),
      ),
    );

    // validate currency code
    try {
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      this.state.datasource.metrics?.forEach(
        (metric: $TSFixMe) =>
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

  handleTabSelect(activeTabKey: $TSFixMe) {
    this.setState({ activeTabKey });
  }

  sortMetrics(metrics: $TSFixMe) {
    // @ts-expect-error TS(7031): Binding element 'a' implicitly has an 'any' type.
    return metrics.sort(({ id: a }, { id: b }) => b - a);
  }

  renderSettingsFieldset() {
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Basic')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
        <Field
          fieldKey="description"
          label={t('Description')}
          control={
            <TextAreaControl
              // @ts-expect-error TS(2322): Type '{ language: string; offerEditInModal: boolea... Remove this comment to see the full error message
              language="markdown"
              offerEditInModal={false}
              resize="vertical"
            />
          }
        />
        // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
        <Field
          fieldKey="default_endpoint"
          label={t('Default URL')}
          description={t(
            `Default URL to redirect to when accessing from the dataset list page.
            Accepts relative URLs such as <span style=„white-space: nowrap;”>/superset/dashboard/{id}/</span>`,
          )}
          control={<TextControl controlId="default_endpoint" />}
        />
        // @ts-expect-error TS(2739): Type '{ inline: true; fieldKey: string; label: str... Remove this comment to see the full error message
        <Field
          inline
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          description={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        // @ts-expect-error TS(2339): Property 'isSqla' does not exist on type 'Readonly... Remove this comment to see the full error message
        {this.state.isSqla && (
          // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
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
                // @ts-expect-error TS(2322): Type '{ language: string; controlId: string; minLi... Remove this comment to see the full error message
                language="sql"
                controlId="fetch_values_predicate"
                minLines={5}
                resize="vertical"
              />
            }
          />
        )}
        // @ts-expect-error TS(2339): Property 'isSqla' does not exist on type 'Readonly... Remove this comment to see the full error message
        {this.state.isSqla && (
          // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
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
                // @ts-expect-error TS(2322): Type '{ controlId: string; language: string; offer... Remove this comment to see the full error message
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
          onChange={(newOwners: $TSFixMe) => {
            this.onDatasourceChange({ ...datasource, owners: newOwners });
          }}
        />
      </Fieldset>
    );
  }

  renderAdvancedFieldset() {
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Advanced')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
        <Field
          fieldKey="cache_timeout"
          label={t('Cache timeout')}
          description={t(
            'The duration of time in seconds before the cache is invalidated. Set to -1 to bypass the cache.',
          )}
          control={<TextControl controlId="cache_timeout" />}
        />
        // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl controlId="offset" />}
          description={t(
            'The number of hours, negative or positive, to shift the time column. This can be used to move UTC time to local time.',
          )}
        />
        // @ts-expect-error TS(2339): Property 'isSqla' does not exist on type 'Readonly... Remove this comment to see the full error message
        {this.state.isSqla && (
          // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
          <Field
            fieldKey="template_params"
            label={t('Template parameters')}
            description={t(
              'A set of parameters that become available in the query using Jinja templating syntax',
            )}
            control={<TextControl controlId="template_params" />}
          />
        )}
        // @ts-expect-error TS(2739): Type '{ inline: true; fieldKey: string; label: str... Remove this comment to see the full error message
        <Field
          inline
          fieldKey="normalize_columns"
          label={t('Normalize column names')}
          description={t(
            'Allow column names to be changed to case insensitive format, if supported (e.g. Oracle, Snowflake).',
          )}
          // @ts-expect-error TS(2769): No overload matches this call.
          control={<CheckboxControl controlId="normalize_columns" />}
        />
        // @ts-expect-error TS(2739): Type '{ inline: true; fieldKey: string; label: str... Remove this comment to see the full error message
        <Field
          inline
          fieldKey="always_filter_main_dttm"
          label={t('Always filter main datetime column')}
          description={t(
            `When the secondary temporal columns are filtered, apply the same filter to the main datetime column.`,
          )}
          // @ts-expect-error TS(2769): No overload matches this call.
          control={<CheckboxControl controlId="always_filter_main_dttm" />}
        />
      </Fieldset>
    );
  }

  renderSpatialTab() {
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2322): Type '{ name: (d: $TSFixMe, onChange: $TSFixMe) =>... Remove this comment to see the full error message
            name: (d: $TSFixMe, onChange: $TSFixMe) => (
              <EditableTitle canEdit title={d} onSaveTitle={onChange} />
            ),
            config: (v: $TSFixMe, onChange: $TSFixMe) => (
              // @ts-expect-error TS(2322): Type '{ value: any; onChange: any; choices: any; }... Remove this comment to see the full error message
              <SpatialControl value={v} onChange={onChange} choices={allCols} />
            ),
          }}
        />
      ),
    };
  }

  renderSourceFieldset() {
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.state;
    return (
      <div>
        <EditLockContainer>
          <span role="button" tabIndex={0} onClick={this.onChangeEditMode}>
            // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
          {!this.state.isEditMode && (
            <div>{t('Click the lock to make changes.')}</div>
          )}
          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2322): Type '{ children: string; key: string; value: stri... Remove this comment to see the full error message
              inline
              onChange={this.onDatasourceTypeChange.bind(this, type.key)}
              // @ts-expect-error TS(2339): Property 'datasourceType' does not exist on type '... Remove this comment to see the full error message
              checked={this.state.datasourceType === type.key}
              // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
              disabled={!this.state.isEditMode}
            >
              {type.label}
            </Radio>
          ))}
        </div>
        <Divider />
        <Fieldset item={datasource} onChange={this.onDatasourceChange} compact>
          // @ts-expect-error TS(2339): Property 'datasourceType' does not exist on type '... Remove this comment to see the full error message
          {this.state.datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              // @ts-expect-error TS(2339): Property 'isSqla' does not exist on type 'Readonly... Remove this comment to see the full error message
              {this.state.isSqla && (
                <>
                  <Col xs={24} md={12}>
                    // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
                              // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('catalog', catalog)
                            }
                            onSchemaChange={schema =>
                              // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('schema', schema)
                            }
                            onDbChange={database =>
                              // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('database', database)
                            }
                            formMode={false}
                            // @ts-expect-error TS(2339): Property 'addDangerToast' does not exist on type '... Remove this comment to see the full error message
                            handleError={this.props.addDangerToast}
                            // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                            readOnly={!this.state.isEditMode}
                          />
                        </div>
                      }
                    />
                    <div css={{ width: 'calc(100% - 34px)', marginTop: -16 }}>
                      // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
                            // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                            disabled={!this.state.isEditMode}
                          />
                        }
                      />
                    </div>
                  </Col>
                  // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; descripti... Remove this comment to see the full error message
                  <Field
                    fieldKey="sql"
                    label={t('SQL')}
                    description={t(
                      'When specifying SQL, the datasource acts as a view. ' +
                        'Superset will use this statement as a subquery while grouping and filtering ' +
                        'on the generated parent queries.',
                    )}
                    control={
                      <TextAreaControl
                        // @ts-expect-error TS(2322): Type '{ language: string; offerEditInModal: boolea... Remove this comment to see the full error message
                        language="sql"
                        offerEditInModal={false}
                        minLines={10}
                        maxLines={Infinity}
                        // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                        readOnly={!this.state.isEditMode}
                        resize="both"
                        tooltipOptions={sqlTooltipOptions}
                      />
                    }
                    additionalControl={
                      <div
                        css={css`
                          position: absolute;
                          right: 0;
                          top: 0;
                          z-index: 2;
                        `}
                      >
                        <Button
                          css={css`
                            align-self: flex-end;
                            height: 24px;
                            padding-left: 6px;
                            padding-right: 6px;
                          `}
                          size="small"
                          buttonStyle="primary"
                          onClick={() => {
                            this.onQueryRun();
                          }}
                        >
                          <Icons.CaretRightFilled
                            iconSize="s"
                            css={theme => ({
                              color: theme.colors.grayscale.light5,
                            })}
                          />
                        </Button>
                      </div>
                    }
                    errorMessage={
                      // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                      this.props.database?.error && t('Error executing query.')
                    }
                  />
                  // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                  {this.props.database?.queryResult && (
                    <ResultTable
                      // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                      data={this.props.database.queryResult.data}
                      // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                      queryId={this.props.database.queryResult.query.id}
                      // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                      orderedColumnKeys={this.props.database.queryResult.columns.map(
                        (col: $TSFixMe) => col.column_name,
                      )}
                      height={100}
                      expandedColumns={
                        // @ts-expect-error TS(2339): Property 'database' does not exist on type 'Readon... Remove this comment to see the full error message
                        this.props.database.queryResult.expandedColumns
                      }
                      allowHTML
                    />
                  )}
                </>
              )}
            </div>
          )}
          // @ts-expect-error TS(2339): Property 'datasourceType' does not exist on type '... Remove this comment to see the full error message
          {this.state.datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col xs={24} md={12}>
              // @ts-expect-error TS(2339): Property 'isSqla' does not exist on type 'Readonly... Remove this comment to see the full error message
              {this.state.isSqla && (
                // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
                        // @ts-expect-error TS(2322): Type '{ clearable: false; database: any; dbId: any... Remove this comment to see the full error message
                        dbId={datasource.database?.id}
                        // @ts-expect-error TS(2339): Property 'addDangerToast' does not exist on type '... Remove this comment to see the full error message
                        handleError={this.props.addDangerToast}
                        catalog={datasource.catalog}
                        schema={datasource.schema}
                        sqlLabMode={false}
                        tableValue={datasource.table_name}
                        onCatalogChange={
                          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                          this.state.isEditMode
                            ? catalog =>
                                this.onDatasourcePropChange('catalog', catalog)
                            : undefined
                        }
                        onSchemaChange={
                          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                          this.state.isEditMode
                            ? schema =>
                                this.onDatasourcePropChange('schema', schema)
                            : undefined
                        }
                        onDbChange={
                          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                          this.state.isEditMode
                            ? database =>
                                this.onDatasourcePropChange(
                                  'database',
                                  database,
                                )
                            : undefined
                        }
                        onTableSelectChange={
                          // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                          this.state.isEditMode
                            ? table =>
                                this.onDatasourcePropChange('table_name', table)
                            : undefined
                        }
                        // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'errors' does not exist on type 'Readonly... Remove this comment to see the full error message
    if (this.state.errors.length > 0) {
      return (
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
          type="error"
          message={
            <>
              // @ts-expect-error TS(2339): Property 'errors' does not exist on type 'Readonly... Remove this comment to see the full error message
              {this.state.errors.map((err: $TSFixMe) => (
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
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2739): Type '{ children: Element[]; compact: true; }' is ... Remove this comment to see the full error message
            <Fieldset compact>
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
              <Field
                fieldKey="d3format"
                label={t('D3 format')}
                control={
                  <TextControl controlId="d3format" placeholder="%y/%m/%d" />
                }
              />
              // @ts-expect-error TS(2739): Type '{ fieldKey: string; label: string; control: ... Remove this comment to see the full error message
              <Field
                fieldKey="currency"
                label={t('Metric currency')}
                control={
                  // @ts-expect-error TS(2741): Property 'onChange' is missing in type '{ currency... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ label: string; fieldKey: string; descripti... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ label: string; fieldKey: string; descripti... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2739): Type '{ label: string; fieldKey: string; descripti... Remove this comment to see the full error message
              <Field
                label={t('Warning')}
                fieldKey="warning_markdown"
                description={t('Optional warning about use of this metric')}
                control={
                  <TextAreaControl
                    // @ts-expect-error TS(2322): Type '{ controlId: string; language: string; offer... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2322): Type '{ expression: () => { width: string; }; }' i... Remove this comment to see the full error message
          expression: () => ({
            width: '240px',
          }),
        }}
        itemRenderers={{
          // @ts-expect-error TS(2322): Type '{ metric_name: (v: $TSFixMe, onChange: $TSFi... Remove this comment to see the full error message
          metric_name: (
            v: $TSFixMe,
            onChange: $TSFixMe,
            _: $TSFixMe,
            record: $TSFixMe,
          ) => (
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
          verbose_name: (v: $TSFixMe, onChange: $TSFixMe) => (
            // @ts-expect-error TS(2322): Type '{ canEdit: true; value: any; onChange: any; ... Remove this comment to see the full error message
            <TextControl canEdit value={v} onChange={onChange} />
          ),
          expression: (v: $TSFixMe, onChange: $TSFixMe) => (
            <TextAreaControl
              // @ts-expect-error TS(2322): Type '{ canEdit: true; initialValue: any; onChange... Remove this comment to see the full error message
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
          description: (v: $TSFixMe, onChange: $TSFixMe, label: $TSFixMe) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />
          ),
          d3format: (v: $TSFixMe, onChange: $TSFixMe, label: $TSFixMe) => (
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
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource, activeTabKey } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
    // @ts-expect-error TS(2339): Property 'theme' does not exist on type 'Readonly<... Remove this comment to see the full error message
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
              // @ts-expect-error TS(2554): Expected 0 arguments, but got 1.
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
                  // @ts-expect-error TS(2339): Property 'databaseColumns' does not exist on type ... Remove this comment to see the full error message
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
                        // @ts-expect-error TS(2339): Property 'isEditMode' does not exist on type 'Read... Remove this comment to see the full error message
                        disabled={this.state.isEditMode}
                      >
                        <Icons.DatabaseOutlined iconSize="m" />
                        {t('Sync columns from source')}
                      </Button>
                    </StyledButtonWrapper>
                  </ColumnButtonWrapper>
                  <ColumnCollectionTable
                    // @ts-expect-error TS(2322): Type '{ className: string; columns: any; datasourc... Remove this comment to see the full error message
                    className="columns-table"
                    // @ts-expect-error TS(2339): Property 'databaseColumns' does not exist on type ... Remove this comment to see the full error message
                    columns={this.state.databaseColumns}
                    datasource={datasource}
                    onColumnsChange={databaseColumns =>
                      this.setColumns({ databaseColumns })
                    }
                    onDatasourceChange={this.onDatasourceChange}
                  />
                  // @ts-expect-error TS(2339): Property 'metadataLoading' does not exist on type ... Remove this comment to see the full error message
                  {this.state.metadataLoading && <Loading />}
                </StyledColumnsTabWrapper>
              ),
            },
            {
              key: TABS_KEYS.CALCULATED_COLUMNS,
              label: (
                <CollectionTabTitle
                  // @ts-expect-error TS(2339): Property 'calculatedColumns' does not exist on typ... Remove this comment to see the full error message
                  collection={this.state.calculatedColumns}
                  title={t('Calculated columns')}
                />
              ),
              children: (
                <StyledColumnsTabWrapper>
                  <ColumnCollectionTable
                    // @ts-expect-error TS(2339): Property 'calculatedColumns' does not exist on typ... Remove this comment to see the full error message
                    columns={this.state.calculatedColumns}
                    onColumnsChange={calculatedColumns =>
                      this.setColumns({ calculatedColumns })
                    }
                    // @ts-expect-error TS(2322): Type '{ columns: any; onColumnsChange: (calculated... Remove this comment to see the full error message
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

  componentWillUnmount() {
    // @ts-expect-error TS(2339): Property 'resetQuery' does not exist on type 'Read... Remove this comment to see the full error message
    this.props.resetQuery();
  }
}

// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
DatasourceEditor.defaultProps = defaultProps;
// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
DatasourceEditor.propTypes = propTypes;

const DataSourceComponent = withTheme(DatasourceEditor);

const mapDispatchToProps = (dispatch: $TSFixMe) => ({
  runQuery: (payload: $TSFixMe) => dispatch(executeQuery(payload)),
  resetQuery: () => dispatch(resetDatabaseState()),
});
const mapStateToProps = (state: $TSFixMe) => ({
  test: state.queryApi,
  database: state.database,
});
export default withToasts(
  connect(mapStateToProps, mapDispatchToProps)(DataSourceComponent),
);
