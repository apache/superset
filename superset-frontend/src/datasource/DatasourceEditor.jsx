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
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Col, Radio, Well } from 'react-bootstrap';
import Badge from 'src/common/components/Badge';
import shortid from 'shortid';
import { styled, SupersetClient, t, supersetTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import Tabs from 'src/common/components/Tabs';
import CertifiedIconWithTooltip from 'src/components/CertifiedIconWithTooltip';
import DatabaseSelector from 'src/components/DatabaseSelector';
import Icon from 'src/components/Icon';
import Label from 'src/components/Label';
import Loading from 'src/components/Loading';
import TableSelector from 'src/components/TableSelector';
import EditableTitle from 'src/components/EditableTitle';

import { getClientErrorObject } from 'src/utils/getClientErrorObject';

import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
import SelectControl from 'src/explore/components/controls/SelectControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import SelectAsyncControl from 'src/explore/components/controls/SelectAsyncControl';
import SpatialControl from 'src/explore/components/controls/SpatialControl';

import CollectionTable from 'src/CRUD/CollectionTable';
import Fieldset from 'src/CRUD/Fieldset';
import Field from 'src/CRUD/Field';

import withToasts from 'src/messageToasts/enhancers/withToasts';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';

const DatasourceContainer = styled.div`
  .change-warning {
    margin: 16px 10px 0;
    color: ${({ theme }) => theme.colors.warning.base};
  }

  .change-warning .bold {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  > svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const EditLockContainer = styled.div`
  font-size: ${supersetTheme.typography.sizes.s}px;
  display: flex;
  align-items: center;
  a {
    padding: 0 10px;
  }
`;

const ColumnButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.gridUnit * 2}px`}
`;

const checkboxGenerator = (d, onChange) => (
  <CheckboxControl value={d} onChange={onChange} />
);
const DATA_TYPES = ['STRING', 'NUMERIC', 'DATETIME'];

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
    <div data-test={`collection-tab-${title}`}>
      {title} <Badge count={collection ? collection.length : 0} showZero />
    </div>
  );
}

CollectionTabTitle.propTypes = {
  title: PropTypes.string,
  collection: PropTypes.array,
};

function ColumnCollectionTable({
  columns,
  onChange,
  editableColumnName,
  showExpression,
  allowAddItem,
  allowEditDataType,
  itemGenerator,
}) {
  return (
    <CollectionTable
      collection={columns}
      tableColumns={['column_name', 'type', 'is_dttm', 'filterable', 'groupby']}
      allowDeletes
      allowAddItem={allowAddItem}
      itemGenerator={itemGenerator}
      stickyHeader
      expandFieldset={
        <FormContainer>
          <Fieldset compact>
            {showExpression && (
              <Field
                fieldKey="expression"
                label={t('SQL Expression')}
                control={
                  <TextAreaControl
                    language="markdown"
                    offerEditInModal={false}
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
                label={t('Data Type')}
                control={
                  <SelectControl choices={DATA_TYPES} name="type" freeForm />
                }
              />
            )}
            <Field
              fieldKey="python_date_format"
              label={t('Datetime Format')}
              description={
                /* Note the fragmented translations may not work. */
                <div>
                  {t('The pattern of timestamp format. For strings use ')}
                  <a href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                    {t('python datetime string pattern')}
                  </a>
                  {t(' expression which needs to adhere to the ')}
                  <a href="https://en.wikipedia.org/wiki/ISO_8601">
                    {t('ISO 8601')}
                  </a>
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
                  placeholder="%Y/%m/%d"
                />
              }
            />
          </Fieldset>
        </FormContainer>
      }
      columnLabels={{
        column_name: t('Column'),
        type: t('Data Type'),
        groupby: t('Is Dimension'),
        is_dttm: t('Is Temporal'),
        filterable: t('Is Filterable'),
      }}
      onChange={onChange}
      itemRenderers={{
        column_name: (v, onItemChange) =>
          editableColumnName ? (
            <EditableTitle canEdit title={v} onSaveTitle={onItemChange} />
          ) : (
            v
          ),
        type: d => <Label>{d}</Label>,
        is_dttm: checkboxGenerator,
        filterable: checkboxGenerator,
        groupby: checkboxGenerator,
      }}
    />
  );
}
ColumnCollectionTable.propTypes = {
  columns: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
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
    column_name: '<new column>',
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
  return <Well style={{ marginTop: 20 }}>{children}</Well>;
}

FormContainer.propTypes = {
  children: PropTypes.node,
};

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

class DatasourceEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      datasource: props.datasource,
      errors: [],
      isDruid:
        props.datasource.type === 'druid' ||
        props.datasource.datasource_type === 'druid',
      isSqla:
        props.datasource.datasource_type === 'table' ||
        props.datasource.type === 'table',
      isEditMode: false,
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(
        col => !!col.expression,
      ),
      metadataLoading: false,
      activeTabKey: 0,
      datasourceType: props.datasource.sql
        ? DATASOURCE_TYPES.virtual.key
        : DATASOURCE_TYPES.physical.key,
    };

    this.onChange = this.onChange.bind(this);
    this.onChangeEditMode = this.onChangeEditMode.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.syncMetadata = this.syncMetadata.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.validateAndChange = this.validateAndChange.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);
    this.allowEditSource = !isFeatureEnabled(
      FeatureFlag.DISABLE_DATASET_SOURCE_EDIT,
    );
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
    this.setState(prevState => ({ isEditMode: !prevState.isEditMode }));
  }

  onDatasourceChange(datasource) {
    this.setState({ datasource }, this.validateAndChange);
  }

  onDatasourcePropChange(attr, value) {
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState(
      prevState => ({
        datasource: { ...prevState.datasource, [attr]: value },
      }),
      this.onDatasourceChange(datasource),
    );
  }

  onDatasourceTypeChange(datasourceType) {
    this.setState({ datasourceType });
  }

  setColumns(obj) {
    this.setState(obj, this.validateAndChange);
  }

  validateAndChange() {
    this.validate(this.onChange);
  }

  updateColumns(cols) {
    const { databaseColumns } = this.state;
    const databaseColumnNames = cols.map(col => col.name);
    const currentCols = databaseColumns.reduce(
      (agg, col) => ({
        ...agg,
        [col.column_name]: col,
      }),
      {},
    );
    const finalColumns = [];
    const results = {
      added: [],
      modified: [],
      removed: databaseColumns
        .map(col => col.column_name)
        .filter(col => !databaseColumnNames.includes(col)),
    };
    cols.forEach(col => {
      const currentCol = currentCols[col.name];
      if (!currentCol) {
        // new column
        finalColumns.push({
          id: shortid.generate(),
          column_name: col.name,
          type: col.type,
          groupby: true,
          filterable: true,
        });
        results.added.push(col.name);
      } else if (currentCol.type !== col.type) {
        // modified column
        finalColumns.push({
          ...currentCol,
          type: col.type,
        });
        results.modified.push(col.name);
      } else {
        // unchanged
        finalColumns.push(currentCol);
      }
    });
    if (
      results.added.length ||
      results.modified.length ||
      results.removed.length
    ) {
      this.setColumns({ databaseColumns: finalColumns });
    }
    return results;
  }

  syncMetadata() {
    const { datasource } = this.state;
    const endpoint = `/datasource/external_metadata/${
      datasource.type || datasource.datasource_type
    }/${datasource.id}/`;
    this.setState({ metadataLoading: true });

    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const results = this.updateColumns(json);
        if (results.modified.length) {
          this.props.addSuccessToast(
            t('Modified columns: %s', results.modified.join(', ')),
          );
        }
        if (results.removed.length) {
          this.props.addSuccessToast(
            t('Removed columns: %s', results.removed.join(', ')),
          );
        }
        if (results.added.length) {
          this.props.addSuccessToast(
            t('New columns added: %s', results.added.join(', ')),
          );
        }
        this.props.addSuccessToast(t('Metadata has been synced'));
        this.setState({ metadataLoading: false });
      })
      .catch(response =>
        getClientErrorObject(response).then(({ error, statusText }) => {
          this.props.addDangerToast(
            error || statusText || t('An error has occurred'),
          );
          this.setState({ metadataLoading: false });
        }),
      );
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

    this.setState({ errors }, callback);
  }

  handleTabSelect(activeTabKey) {
    this.setState({ activeTabKey });
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
            <TextAreaControl language="markdown" offerEditInModal={false} />
          }
        />
        <Field
          fieldKey="default_endpoint"
          label={t('Default URL')}
          description={t(
            'Default URL to redirect to when accessing from the dataset list page',
          )}
          control={<TextControl controlId="default_endpoint" />}
        />
        <Field
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          description={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="fetch_values_predicate"
            label={t('Autocomplete Query Predicate')}
            description={t(
              'When using "Autocomplete filters", this can be used to improve performance ' +
                'of the query fetching the values. Use this option to apply a ' +
                'predicate (WHERE clause) to the query selecting the distinct ' +
                'values from the table. Typically the intent would be to limit the scan ' +
                'by applying a relative time filter on a partitioned or indexed time-related field.',
            )}
            control={<TextControl controlId="fetch_values_predicate" />}
          />
        )}
        {this.state.isSqla && (
          <Field
            fieldKey="extra"
            label={t('Extra')}
            description={t(
              'Extra data to specify table metadata. Currently supports ' +
                'certification data of the format: `{ "certification": { "certified_by": ' +
                '"Data Platform Team", "details": "This table is the source of truth." ' +
                '} }`.',
            )}
            control={
              <TextAreaControl
                controlId="extra"
                language="json"
                offerEditInModal={false}
              />
            }
          />
        )}
        <Field
          fieldKey="owners"
          label={t('Owners')}
          description={t('Owners of the dataset')}
          control={
            <SelectAsyncControl
              dataEndpoint="api/v1/dataset/related/owners"
              multi
              mutator={data =>
                data.result.map(pk => ({
                  value: pk.value,
                  label: `${pk.text}`,
                }))
              }
            />
          }
          controlProps={{}}
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
          label={t('Cache Timeout')}
          description={t(
            'The duration of time in seconds before the cache is invalidated',
          )}
          control={<TextControl controlId="cache_timeout" />}
        />
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl controlId="offset" />}
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
      </Fieldset>
    );
  }

  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;
    return (
      <Tabs.TabPane
        tab={<CollectionTabTitle collection={spatials} title={t('Spatial')} />}
        key={4}
      >
        <CollectionTable
          tableColumns={['name', 'config']}
          onChange={this.onDatasourcePropChange.bind(this, 'spatials')}
          itemGenerator={() => ({
            name: '<new spatial>',
            type: '<no type>',
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
      </Tabs.TabPane>
    );
  }

  renderSourceFieldset() {
    const { datasource } = this.state;
    return (
      <div>
        <div className="m-l-10 m-t-20 m-b-10">
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
        <hr />
        <Fieldset item={datasource} onChange={this.onDatasourceChange} compact>
          {this.state.datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              {this.state.isSqla && (
                <>
                  <Field
                    fieldKey="databaseSelector"
                    label={t('virtual')}
                    control={
                      <DatabaseSelector
                        dbId={datasource.database.id}
                        schema={datasource.schema}
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
                    }
                  />
                  <Field
                    fieldKey="table_name"
                    label={t('dataset name')}
                    control={
                      <TextControl
                        controlId="table_name"
                        onChange={table => {
                          this.onDatasourcePropChange('table_name', table);
                        }}
                        placeholder={t('dataset name')}
                        disabled={!this.state.isEditMode}
                      />
                    }
                  />
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
                        language="sql"
                        offerEditInModal={false}
                        minLines={20}
                        maxLines={20}
                        readOnly={!this.state.isEditMode}
                      />
                    }
                  />
                </>
              )}
              {this.state.isDruid && (
                <Field
                  fieldKey="json"
                  label={t('JSON')}
                  description={
                    <div>
                      {t('The JSON metric or post aggregation definition.')}
                    </div>
                  }
                  control={
                    <TextAreaControl language="json" offerEditInModal={false} />
                  }
                />
              )}
            </div>
          )}
          {this.state.datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col md={6}>
              {this.state.isSqla && (
                <Field
                  fieldKey="tableSelector"
                  label={t('Physical')}
                  control={
                    <TableSelector
                      clearable={false}
                      dbId={datasource.database.id}
                      handleError={this.props.addDangerToast}
                      schema={datasource.schema}
                      sqlLabMode={false}
                      tableName={datasource.table_name}
                      onSchemaChange={
                        this.state.isEditMode
                          ? schema =>
                              this.onDatasourcePropChange('schema', schema)
                          : undefined
                      }
                      onDbChange={
                        this.state.isEditMode
                          ? database =>
                              this.onDatasourcePropChange('database', database)
                          : undefined
                      }
                      onTableChange={
                        this.state.isEditMode
                          ? table =>
                              this.onDatasourcePropChange('table_name', table)
                          : undefined
                      }
                      readOnly={!this.state.isEditMode}
                    />
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
        {this.allowEditSource && (
          <EditLockContainer>
            <span role="button" tabIndex={0} onClick={this.onChangeEditMode}>
              <Icon
                color={supersetTheme.colors.grayscale.base}
                name={this.state.isEditMode ? 'lock-unlocked' : 'lock-locked'}
              />
            </span>
            {!this.state.isEditMode && (
              <div>{t('Click the lock to make changes.')}</div>
            )}
            {this.state.isEditMode && (
              <div>{t('Click the lock to prevent further changes.')}</div>
            )}
          </EditLockContainer>
        )}
      </div>
    );
  }

  renderErrors() {
    if (this.state.errors.length > 0) {
      return (
        <Alert bsStyle="danger">
          {this.state.errors.map(err => (
            <div key={err}>{err}</div>
          ))}
        </Alert>
      );
    }
    return null;
  }

  renderMetricCollection() {
    return (
      <CollectionTable
        tableColumns={['metric_name', 'verbose_name', 'expression']}
        columnLabels={{
          metric_name: t('Metric'),
          verbose_name: t('Label'),
          expression: t('SQL Expression'),
        }}
        expandFieldset={
          <FormContainer>
            <Fieldset compact>
              <Field
                fieldKey="verbose_name"
                label={t('Label')}
                control={<TextControl controlId="verbose_name" />}
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
              <Field
                fieldKey="d3format"
                label={t('D3 Format')}
                control={
                  <TextControl controlId="d3format" placeholder="%y/%m/%d" />
                }
              />
              <Field
                label={t('Warning Message')}
                fieldKey="warning_text"
                description={t(
                  'Warning message to display in the metric selector',
                )}
                control={
                  <TextControl
                    controlId="warning_text"
                    placeholder={t('Warning Message')}
                  />
                }
              />
              <Field
                label={t('Certified By')}
                fieldKey="certified_by"
                description={t(
                  'Person or group that has certified this metric',
                )}
                control={
                  <TextControl
                    controlId="certified_by"
                    placeholder={t('Certified By')}
                  />
                }
              />
              <Field
                label={t('Certification Details')}
                fieldKey="certification_details"
                description={t('Details of the certification')}
                control={
                  <TextControl
                    controlId="certification_details"
                    placeholder={t('Certification Details')}
                  />
                }
              />
            </Fieldset>
          </FormContainer>
        }
        collection={this.state.datasource.metrics}
        allowAddItem
        onChange={this.onDatasourcePropChange.bind(this, 'metrics')}
        itemGenerator={() => ({
          metric_name: '<new metric>',
          verbose_name: '',
          expression: '',
        })}
        itemRenderers={{
          metric_name: (v, onChange, _, record) => (
            <FlexRowContainer>
              {record.is_certified && (
                <CertifiedIconWithTooltip
                  certifiedBy={record.certified_by}
                  details={record.certification_details}
                />
              )}
              <EditableTitle canEdit title={v} onSaveTitle={onChange} />
            </FlexRowContainer>
          ),
          verbose_name: (v, onChange) => (
            <EditableTitle canEdit title={v} onSaveTitle={onChange} />
          ),
          expression: (v, onChange) => (
            <EditableTitle
              canEdit
              title={v}
              onSaveTitle={onChange}
              extraClasses={['datasource-sql-expression']}
              multiLine
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
    return (
      <DatasourceContainer>
        {this.renderErrors()}
        <div className="m-t-10">
          <Alert bsStyle="warning">
            <strong>{t('Be careful.')} </strong>
            {t(
              'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
            )}
          </Alert>
        </div>
        <Tabs
          fullWidth={false}
          id="table-tabs"
          data-test="edit-dataset-tabs"
          onChange={this.handleTabSelect}
          defaultActiveKey={activeTabKey}
        >
          <Tabs.TabPane key={0} tab={t('Source')}>
            {this.renderSourceFieldset()}
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={datasource.metrics}
                title={t('Metrics')}
              />
            }
            key={1}
          >
            {this.renderMetricCollection()}
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={this.state.databaseColumns}
                title={t('Columns')}
              />
            }
            key={2}
          >
            <div>
              <ColumnButtonWrapper>
                <span className="m-t-10 m-r-10">
                  <Button
                    buttonSize="sm"
                    buttonStyle="primary"
                    onClick={this.syncMetadata}
                    className="sync-from-source"
                  >
                    <i className="fa fa-database" />{' '}
                    {t('Sync columns from source')}
                  </Button>
                </span>
              </ColumnButtonWrapper>
              <ColumnCollectionTable
                className="columns-table"
                columns={this.state.databaseColumns}
                onChange={databaseColumns =>
                  this.setColumns({ databaseColumns })
                }
              />
              {this.state.metadataLoading && <Loading />}
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={this.state.calculatedColumns}
                title={t('Calculated Columns')}
              />
            }
            key={3}
          >
            <ColumnCollectionTable
              columns={this.state.calculatedColumns}
              onChange={calculatedColumns =>
                this.setColumns({ calculatedColumns })
              }
              editableColumnName
              showExpression
              allowAddItem
              allowEditDataType
              itemGenerator={() => ({
                column_name: '<new column>',
                filterable: true,
                groupby: true,
                expression: '<enter SQL expression here>',
                __expanded: true,
              })}
            />
          </Tabs.TabPane>
          <Tabs.TabPane key={4} tab={t('Settings')}>
            <div>
              <Col md={6}>
                <FormContainer>{this.renderSettingsFieldset()}</FormContainer>
              </Col>
              <Col md={6}>
                <FormContainer>{this.renderAdvancedFieldset()}</FormContainer>
              </Col>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </DatasourceContainer>
    );
  }
}

DatasourceEditor.defaultProps = defaultProps;
DatasourceEditor.propTypes = propTypes;

export default withToasts(DatasourceEditor);
