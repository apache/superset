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
import { Alert, Badge, Col, Tabs, Tab, Well } from 'react-bootstrap';
import shortid from 'shortid';
import styled from '@superset-ui/style';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import Label from 'src/components/Label';
import Button from 'src/components/Button';
import Loading from 'src/components/Loading';
import TableSelector from 'src/components/TableSelector';

import getClientErrorObject from '../utils/getClientErrorObject';
import CheckboxControl from '../explore/components/controls/CheckboxControl';
import TextControl from '../explore/components/controls/TextControl';
import SelectControl from '../explore/components/controls/SelectControl';
import TextAreaControl from '../explore/components/controls/TextAreaControl';
import SelectAsyncControl from '../explore/components/controls/SelectAsyncControl';
import SpatialControl from '../explore/components/controls/SpatialControl';
import CollectionTable from '../CRUD/CollectionTable';
import EditableTitle from '../components/EditableTitle';
import Fieldset from '../CRUD/Fieldset';
import Field from '../CRUD/Field';

import withToasts from '../messageToasts/enhancers/withToasts';

const DatasourceContainer = styled.div`
  .tab-content {
    height: 600px;
    overflow: auto;
  }

  .change-warning {
    margin: 16px 10px 0;
    color: ${({ theme }) => theme.colors.warning.base};
  }

  .change-warning .bold {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const checkboxGenerator = (d, onChange) => (
  <CheckboxControl value={d} onChange={onChange} />
);
const DATA_TYPES = ['STRING', 'NUMERIC', 'DATETIME'];

function CollectionTabTitle({ title, collection }) {
  return (
    <div>
      {title} <Badge>{collection ? collection.length : 0}</Badge>
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
              control={<TextControl placeholder={t('Label')} />}
            />
            <Field
              fieldKey="description"
              label={t('Description')}
              control={<TextControl placeholder={t('Description')} />}
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
              descr={
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
              control={<TextControl placeholder={'%y/%m/%d'} />}
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

export class DatasourceEditor extends React.PureComponent {
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
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(
        col => !!col.expression,
      ),
      metadataLoading: false,
      activeTabKey: 1,
    };

    this.onChange = this.onChange.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.syncMetadata = this.syncMetadata.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.validateAndChange = this.validateAndChange.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);
  }

  onChange() {
    const datasource = {
      ...this.state.datasource,
      columns: [...this.state.databaseColumns, ...this.state.calculatedColumns],
    };
    this.props.onChange(datasource, this.state.errors);
  }
  onDatasourceChange(datasource) {
    this.setState({ datasource }, this.validateAndChange);
  }

  onDatasourcePropChange(attr, value) {
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState({ datasource }, this.onDatasourceChange(datasource));
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
    // Handle carefully when the schema is empty
    const endpoint =
      `/datasource/external_metadata/${
        datasource.type || datasource.datasource_type
      }/${datasource.id}/` +
      `?db_id=${datasource.database.id}` +
      `&schema=${datasource.schema || ''}` +
      `&table_name=${datasource.datasource_name || datasource.table_name}`;
    this.setState({ metadataLoading: true });

    SupersetClient.get({ endpoint })
      .then(({ json }) => {
        const results = this.updateColumns(json);
        if (results.modified.length)
          this.props.addSuccessToast(
            t('Modified columns: %s', results.modified.join(', ')),
          );
        if (results.removed.length)
          this.props.addSuccessToast(
            t('Removed columns: %s', results.removed.join(', ')),
          );
        if (results.added.length)
          this.props.addSuccessToast(
            t('New columns added: %s', results.added.join(', ')),
          );
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
    const datasource = this.state.datasource;

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
    const datasource = this.state.datasource;
    return (
      <Fieldset
        title={t('Basic')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        {this.state.isSqla && (
          <Field
            fieldKey="tableSelector"
            label={t('Physical Table')}
            control={
              <TableSelector
                dbId={datasource.database.id}
                schema={datasource.schema}
                tableName={datasource.datasource_name}
                onSchemaChange={schema =>
                  this.onDatasourcePropChange('schema', schema)
                }
                onDbChange={database =>
                  this.onDatasourcePropChange('database', database)
                }
                onTableChange={table =>
                  this.onDatasourcePropChange('datasource_name', table)
                }
                sqlLabMode={false}
                clearable={false}
                handleError={this.props.addDangerToast}
              />
            }
            descr={t(
              'The pointer to a physical table. Keep in mind that the chart is ' +
                'associated to this Superset logical table, and this logical table points ' +
                'the physical table referenced here.',
            )}
          />
        )}
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
          descr={t(
            'Default URL to redirect to when accessing from the datasource list page',
          )}
          control={<TextControl />}
        />
        <Field
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          descr={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="fetch_values_predicate"
            label={t('Autocomplete Query Predicate')}
            descr={t(
              'When using "Autocomplete filters", this can be used to improve performance ' +
                'of the query fetching the values. Use this option to apply a ' +
                'predicate (WHERE clause) to the query selecting the distinct ' +
                'values from the table. Typically the intent would be to limit the scan ' +
                'by applying a relative time filter on a partitioned or indexed time-related field.',
            )}
            control={<TextControl />}
          />
        )}
        <Field
          fieldKey="owners"
          label={t('Owners')}
          descr={t('Owners of the datasource')}
          control={
            <SelectAsyncControl
              dataEndpoint="/users/api/read"
              multi
              mutator={data =>
                data.pks.map((pk, i) => ({
                  value: pk,
                  label: `${data.result[i].first_name} ${data.result[i].last_name}`,
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
    const datasource = this.state.datasource;
    return (
      <Fieldset
        title={t('Advanced')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        {this.state.isSqla && (
          <Field
            fieldKey="sql"
            label={t('SQL')}
            descr={t(
              'When specifying SQL, the datasource acts as a view. ' +
                'Superset will use this statement as a subquery while grouping and filtering ' +
                'on the generated parent queries.',
            )}
            control={
              <TextAreaControl language="sql" offerEditInModal={false} />
            }
          />
        )}
        {this.state.isDruid && (
          <Field
            fieldKey="json"
            label={t('JSON')}
            descr={
              <div>{t('The JSON metric or post aggregation definition.')}</div>
            }
            control={
              <TextAreaControl language="json" offerEditInModal={false} />
            }
          />
        )}
        <Field
          fieldKey="cache_timeout"
          label={t('Cache Timeout')}
          descr={t(
            'The duration of time in seconds before the cache is invalidated',
          )}
          control={<TextControl />}
        />
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl />}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="template_params"
            label={t('Template parameters')}
            descr={t(
              'A set of parameters that become available in the query using Jinja templating syntax',
            )}
            control={<TextControl />}
          />
        )}
      </Fieldset>
    );
  }

  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;
    return (
      <Tab
        title={
          <CollectionTabTitle collection={spatials} title={t('Spatial')} />
        }
        eventKey={4}
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
      </Tab>
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
            <Fieldset>
              <Field
                fieldKey="verbose_name"
                label={t('Label')}
                control={<TextControl />}
              />
              <Field
                fieldKey="description"
                label={t('Description')}
                control={<TextControl placeholder={t('Description')} />}
              />
              <Field
                fieldKey="d3format"
                label={t('D3 Format')}
                control={<TextControl placeholder="%y/%m/%d" />}
              />
              <Field
                label={t('Warning Message')}
                fieldKey="warning_text"
                description={t(
                  'Warning message to display in the metric selector',
                )}
                control={<TextControl placeholder={t('Warning Message')} />}
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
          metric_name: (v, onChange) => (
            <EditableTitle canEdit title={v} onSaveTitle={onChange} />
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
      />
    );
  }

  render() {
    const { datasource, activeTabKey } = this.state;
    return (
      <DatasourceContainer>
        {this.renderErrors()}
        <Tabs
          id="table-tabs"
          onSelect={this.handleTabSelect}
          defaultActiveKey={activeTabKey}
        >
          <Tab
            title={
              <CollectionTabTitle
                collection={datasource.metrics}
                title={t('Metrics')}
              />
            }
            eventKey={1}
          >
            {activeTabKey === 1 && this.renderMetricCollection()}
          </Tab>
          <Tab
            title={
              <CollectionTabTitle
                collection={this.state.databaseColumns}
                title={t('Columns')}
              />
            }
            eventKey={2}
          >
            {activeTabKey === 2 && (
              <div>
                <ColumnCollectionTable
                  columns={this.state.databaseColumns}
                  onChange={databaseColumns =>
                    this.setColumns({ databaseColumns })
                  }
                />
                <Button
                  bsStyle="primary"
                  onClick={this.syncMetadata}
                  className="sync-from-source"
                  disabled={!!datasource.sql}
                  tooltip={
                    datasource.sql
                      ? t('This option is not yet available for views')
                      : null
                  }
                >
                  {t('Sync columns from source')}
                </Button>
                {this.state.metadataLoading && <Loading />}
              </div>
            )}
          </Tab>
          <Tab
            title={
              <CollectionTabTitle
                collection={this.state.calculatedColumns}
                title={t('Calculated Columns')}
              />
            }
            eventKey={3}
          >
            {activeTabKey === 3 && (
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
            )}
          </Tab>
          <Tab eventKey={4} title={t('Settings')}>
            {activeTabKey === 4 && (
              <div>
                <div className="m-t-10">
                  <Alert bsStyle="warning">
                    <strong>{t('Be careful.')} </strong>
                    {t(
                      'Changing these settings will affect all charts using this datasource, including charts owned by other people.',
                    )}
                  </Alert>
                </div>
                <Col md={6}>
                  <FormContainer>{this.renderSettingsFieldset()}</FormContainer>
                </Col>
                <Col md={6}>
                  <FormContainer>{this.renderAdvancedFieldset()}</FormContainer>
                </Col>
              </div>
            )}
          </Tab>
        </Tabs>
      </DatasourceContainer>
    );
  }
}

DatasourceEditor.defaultProps = defaultProps;
DatasourceEditor.propTypes = propTypes;

export default withToasts(DatasourceEditor);
