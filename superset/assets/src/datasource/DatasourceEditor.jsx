import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Col, Label, Tabs, Tab, Well } from 'react-bootstrap';
import shortid from 'shortid';
import $ from 'jquery';

import { t } from '../locales';

import Button from '../components/Button';
import Loading from '../components/Loading';
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

import './main.css';

const checkboxGenerator = (d, onChange) => <CheckboxControl value={d} onChange={onChange} />;
const styleMonospace = { fontFamily: 'monospace' };
const DATA_TYPES = ['STRING', 'NUMBER', 'DATETIME'];

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
  columns, onChange, editableColumnName, showExpression, allowAddItem,
  allowEditDataType, itemGenerator,
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
            {showExpression &&
              <Field
                fieldKey="expression"
                label={t('SQL Expression')}
                control={<TextControl />}
              />}
            <Field
              fieldKey="verbose_name"
              label={t('Label')}
              control={<TextControl />}
            />
            {allowEditDataType &&
              <Field
                fieldKey="type"
                label={t('Data Type')}
                control={<SelectControl choices={DATA_TYPES} name="type" />}
              />}
            <Field
              fieldKey="python_date_format"
              label={t('Datetime Format')}
              descr={
                <div>
                  {t('The pattern of the timestamp format, use ')}
                  <a href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                    {t('python datetime string pattern')}
                  </a>
                  {t(` expression. If time is stored in epoch format, put \`epoch_s\` or
                      \`epoch_ms\`. Leave \`Database Expression\`
                      below empty if timestamp is stored in '
                      String or Integer(epoch) type`)}
                </div>
              }
              control={<TextControl />}
            />
            <Field
              fieldKey="database_expression"
              label={t('Database Expression')}
              descr={
                <div>
                  {t(`
                    The database expression to cast internal datetime
                    constants to database date/timestamp type according to the DBAPI.
                    The expression should follow the pattern of
                    %Y-%m-%d %H:%M:%S, based on different DBAPI.
                    The string should be a python string formatter
                    \`Ex: TO_DATE('{}', 'YYYY-MM-DD HH24:MI:SS')\` for Oracle
                    Superset uses default expression based on DB URI if this
                    field is blank.
                  `)}
                </div>
              }
              control={<TextControl />}
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
        column_name: (v, onItemChange) => (
          editableColumnName ?
            <EditableTitle canEdit title={v} onSaveTitle={onItemChange} /> :
            v
        ),
        type: d => <Label style={{ fontSize: '75%' }}>{d}</Label>,
        is_dttm: checkboxGenerator,
        filterable: checkboxGenerator,
        groupby: checkboxGenerator,
      }}
    />);
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
      <div><strong>{label}</strong></div>
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
    <Well style={{ marginTop: 20 }}>
      {children}
    </Well>
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
};
const defaultProps = {
  onChange: () => {},
};
export class DatasourceEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      datasource: props.datasource,
      showAlert: true,
      errors: [],
      isDruid: props.datasource.type === 'druid',
      isSqla: props.datasource.type === 'table',
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(col => !!col.expression),
      metadataLoading: false,
      activeTabKey: 1,
    };

    this.onChange = this.onChange.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.hideAlert = this.hideAlert.bind(this);
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
  onDatasourceChange(newDatasource) {
    this.setState({ datasource: newDatasource }, this.validateAndChange);
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
  mergeColumns(cols) {
    let { databaseColumns } = this.state;
    let hasChanged;
    const currentColNames = databaseColumns.map(col => col.column_name);
    cols.forEach((col) => {
      if (currentColNames.indexOf(col.name) < 0) {
        // Adding columns
        databaseColumns = databaseColumns.concat([{
          id: shortid.generate(),
          column_name: col.name,
          type: col.type,
          groupby: true,
          filterable: true,
        }]);
        hasChanged = true;
      }
    });
    if (hasChanged) {
      this.setColumns({ databaseColumns });
    }
  }
  syncMetadata() {
    const datasource = this.state.datasource;
    const url = `/datasource/external_metadata/${datasource.type}/${datasource.id}/`;
    this.setState({ metadataLoading: true });
    const success = (data) => {
      this.mergeColumns(data);
      this.props.addSuccessToast(t('Metadata has been synced'));
      this.setState({ metadataLoading: false });
    };
    const error = (err) => {
      let msg = t('An error has occurred');
      if (err.responseJSON && err.responseJSON.error) {
        msg = err.responseJSON.error;
      }
      this.props.addDangerToast(msg);
      this.setState({ metadataLoading: false });
    };
    $.ajax({
      url,
      type: 'GET',
      success,
      error,
    });
  }
  findDuplicates(arr, accessor) {
    const seen = {};
    const dups = [];
    arr.forEach((obj) => {
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
    errors = errors.concat(dups.map(name => t('Column name [%s] is duplicated', name)));

    // Looking for duplicate metric_name
    dups = this.findDuplicates(datasource.metrics, obj => obj.metric_name);
    errors = errors.concat(dups.map(name => t('Metric name [%s] is duplicated', name)));

    // Making sure calculatedColumns have an expression defined
    const noFilterCalcCols = this.state.calculatedColumns.filter(
      col => !col.expression && !col.json);
    errors = errors.concat(noFilterCalcCols.map(
      col => t('Calculated column [%s] requires an expression', col.column_name)));

    this.setState({ errors }, callback);
  }
  hideAlert() {
    this.setState({ showAlert: false });
  }
  handleTabSelect(activeTabKey) {
    this.setState({ activeTabKey });
  }
  renderSettingsFieldset() {
    const datasource = this.state.datasource;
    return (
      <Fieldset title={t('Basic')} item={datasource} onChange={this.onDatasourceChange}>
        <Field
          fieldKey="description"
          label={t('Description')}
          control={<TextAreaControl language="markdown" offerEditInModal={false} />}
        />
        <Field
          fieldKey="default_endpoint"
          label={t('Default URL')}
          descr={t('Default URL to redirect to when accessing from the datasource list page')}
          control={<TextControl />}
        />
        <Field
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          descr={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        <Field
          fieldKey="owner"
          label={t('Owner')}
          descr={t('Owner of the datasource')}
          control={
            <SelectAsyncControl
              dataEndpoint="/users/api/read"
              multi={false}
              mutator={data => data.pks.map((pk, i) => ({
                value: pk,
                label: `${data.result[i].first_name} ${data.result[i].last_name}`,
              }))}
            />}
          controlProps={{
          }}
        />
      </Fieldset>
    );
  }
  renderAdvancedFieldset() {
    const datasource = this.state.datasource;
    return (
      <Fieldset title={t('Advanced')} item={datasource} onChange={this.onDatasourceChange}>
        { this.state.isSqla &&
          <Field
            fieldKey="sql"
            label={t('SQL')}
            descr={t(
              'When specifying SQL, the datasource acts as a view. ' +
              'Superset will use this statement as a subquery while grouping and filtering ' +
              'on the generated parent queries.')}
            control={<TextAreaControl language="sql" offerEditInModal={false} />}
          />
        }
        { this.state.isDruid &&
          <Field
            fieldKey="json"
            label={t('JSON')}
            descr={
              <div>
                {t('The JSON metric or post aggregation definition.')}
              </div>
            }
            control={<TextAreaControl language="json" offerEditInModal={false} />}
          />
        }
        <Field
          fieldKey="cache_timeout"
          label={t('Cache Timeout')}
          descr={t('The duration of time in seconds before the cache is invalidated')}
          control={<TextControl />}
        />
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl />}
        />
      </Fieldset>);
  }
  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;
    return (
      <Tab
        title={<CollectionTabTitle collection={spatials} title={t('Spatial')} />}
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
              <EditableTitle canEdit title={d} onSaveTitle={onChange} />),
            config: (v, onChange) => (
              <SpatialControl value={v} onChange={onChange} choices={allCols} />
            ),
          }}
        />
      </Tab>);
  }
  renderErrors() {
    if (this.state.errors.length > 0) {
      return (
        <Alert bsStyle="danger">
          {this.state.errors.map(err => <div key={err}>{err}</div>)}
        </Alert>);
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
                fieldKey="description"
                label={t('Description')}
                control={<TextControl />}
              />
              <Field
                fieldKey="d3format"
                label={t('D3 Format')}
                control={<TextControl />}
              />
              <Field
                label={t('Warning Message')}
                fieldKey="warning_text"
                description={t('Warning message to display in the metric selector')}
                control={<TextControl />}
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
            <EditableTitle canEdit title={v} onSaveTitle={onChange} />),
          verbose_name: (v, onChange) => (
            <EditableTitle canEdit title={v} onSaveTitle={onChange} />),
          expression: (v, onChange) => (
            <EditableTitle
              canEdit
              title={v}
              onSaveTitle={onChange}
              style={styleMonospace}
            />),
          description: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />),
          d3format: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />),
        }}
        allowDeletes
      />);
  }
  render() {
    const datasource = this.state.datasource;
    return (
      <div className="Datasource">
        {this.renderErrors()}
        <Tabs
          id="table-tabs"
          onSelect={this.handleTabSelect}
          defaultActiveKey={1}
        >
          <Tab eventKey={1} title={t('Settings')}>
            {this.state.activeTabKey === 1 &&
              <div>
                <Col md={6}>
                  <FormContainer>
                    {this.renderSettingsFieldset()}
                  </FormContainer>
                </Col>
                <Col md={6}>
                  <FormContainer>
                    {this.renderAdvancedFieldset()}
                  </FormContainer>
                </Col>
              </div>
            }
          </Tab>
          <Tab
            title={
              <CollectionTabTitle collection={this.state.databaseColumns} title={t('Columns')} />
            }
            eventKey={2}
          >
            {this.state.activeTabKey === 2 &&
              <div>
                <ColumnCollectionTable
                  columns={this.state.databaseColumns}
                  onChange={databaseColumns => this.setColumns({ databaseColumns })}
                />
                <Button
                  bsStyle="primary"
                  onClick={this.syncMetadata}
                  className="sync-from-source"
                  disabled={!!datasource.sql}
                  tooltip={datasource.sql ? t('This option is not yet available for views') : null}
                >
                  {t('Sync columns from source')}
                </Button>
                {this.state.metadataLoading && <Loading />}
              </div>
            }
          </Tab>
          <Tab
            title={
              <CollectionTabTitle
                collection={this.state.calculatedColumns}
                title={t('Calculated Columns')}
              />}
            eventKey={3}
          >
            {this.state.activeTabKey === 3 &&
              <ColumnCollectionTable
                columns={this.state.calculatedColumns}
                onChange={calculatedColumns => this.setColumns({ calculatedColumns })}
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
            }
          </Tab>
          <Tab
            title={<CollectionTabTitle collection={datasource.metrics} title={t('Metrics')} />}
            eventKey={4}
          >
            {this.state.activeTabKey === 4 && this.renderMetricCollection()}
          </Tab>
        </Tabs>
      </div>
    );
  }
}
DatasourceEditor.defaultProps = defaultProps;
DatasourceEditor.propTypes = propTypes;
export default withToasts(DatasourceEditor);
