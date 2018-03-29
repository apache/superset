import React from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, FormGroup, Popover, Tab, Tabs } from 'react-bootstrap';
import VirtualizedSelect from 'react-virtualized-select';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';

import { AGGREGATES } from '../constants';
import { t } from '../../locales';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import AdhocMetricEditPopoverTitle from './AdhocMetricEditPopoverTitle';
import columnType from '../propTypes/columnType';
import AdhocMetric, { EXPRESSION_TYPES } from '../AdhocMetric';
import ColumnOption from '../../components/ColumnOption';
import { sqlWords } from '../../SqlLab/components/AceEditorWrapper';

const langTools = ace.acequire('ace/ext/language_tools');

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  datasourceType: PropTypes.string,
};

const defaultProps = {
  columns: [],
};

export default class AdhocMetricEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onSqlExpressionChange = this.onSqlExpressionChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.state = { adhocMetric: this.props.adhocMetric }; this.selectProps = { multi: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: true,
      selectWrap: VirtualizedSelect,
    };
    if (langTools) {
      const words = sqlWords.concat(this.props.columns.map(column => (
        { name: column.column_name, value: column.column_name, score: 50, meta: 'column' }
      )));
      const completer = {
        getCompletions: (aceEditor, session, pos, prefix, callback) => {
          callback(null, words);
        },
      };
      langTools.setCompleters([completer]);
    }
  }

  onSave() {
    this.props.onChange(this.state.adhocMetric);
    this.props.onClose();
  }

  onColumnChange(column) {
    this.setState({ adhocMetric: this.state.adhocMetric.duplicateWith({
      column,
      expressionType: EXPRESSION_TYPES.SIMPLE,
    }) });
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState({ adhocMetric: this.state.adhocMetric.duplicateWith({
      aggregate: aggregate && aggregate.aggregate,
      expressionType: EXPRESSION_TYPES.SIMPLE,
    }) });
  }

  onSqlExpressionChange(sqlExpression) {
    this.setState({ adhocMetric: this.state.adhocMetric.duplicateWith({
      sqlExpression,
      expressionType: EXPRESSION_TYPES.SQL,
    }) });
  }

  onLabelChange(e) {
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        label: e.target.value, hasCustomLabel: true,
      }),
    });
  }

  render() {
    const {
      adhocMetric: propsAdhocMetric,
      columns,
      onChange,
      onClose,
      datasourceType,
      ...popoverProps
    } = this.props;

    const { adhocMetric } = this.state;

    const columnSelectProps = {
      placeholder: t('%s column(s)', columns.length),
      options: columns,
      value: (adhocMetric.column && adhocMetric.column.column_name) ||
        adhocMetric.inferSqlExpressionColumn(),
      onChange: this.onColumnChange,
      optionRenderer: VirtualizedRendererWrap(option => (
        <ColumnOption column={option} showType />
      )),
      valueRenderer: column => column.column_name,
      valueKey: 'column_name',
    };

    const aggregateSelectProps = {
      placeholder: t('%s aggregates(s)', Object.keys(AGGREGATES).length),
      options: Object.keys(AGGREGATES).map(aggregate => ({ aggregate })),
      value: adhocMetric.aggregate || adhocMetric.inferSqlExpressionAggregate(),
      onChange: this.onAggregateChange,
      optionRenderer: VirtualizedRendererWrap(aggregate => aggregate.aggregate),
      valueRenderer: aggregate => aggregate.aggregate,
      valueKey: 'aggregate',
    };

    if (this.props.datasourceType === 'druid') {
      aggregateSelectProps.options = aggregateSelectProps.options.filter((
        option => option.aggregate !== 'AVG'
      ));
    }

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        adhocMetric={adhocMetric}
        onChange={this.onLabelChange}
      />
    );

    const stateIsValid = adhocMetric.isValid();
    const hasUnsavedChanges = adhocMetric.equals(propsAdhocMetric);

    return (
      <Popover
        id="metrics-edit-popover"
        title={popoverTitle}
        {...popoverProps}
      >
        <Tabs
          id="adhoc-metric-edit-tabs"
          defaultActiveKey={adhocMetric.expressionType}
          className="adhoc-metric-edit-tabs"
        >
          <Tab className="adhoc-metric-edit-tab" eventKey={EXPRESSION_TYPES.SIMPLE} title="Simple">
            <FormGroup>
              <ControlLabel><strong>column</strong></ControlLabel>
              <OnPasteSelect {...this.selectProps} {...columnSelectProps} />
            </FormGroup>
            <FormGroup>
              <ControlLabel><strong>aggregate</strong></ControlLabel>
              <OnPasteSelect {...this.selectProps} {...aggregateSelectProps} />
            </FormGroup>
          </Tab>
          {
            this.props.datasourceType !== 'druid' &&
            <Tab className="adhoc-metric-edit-tab" eventKey={EXPRESSION_TYPES.SQL} title="Custom SQL">
              <FormGroup>
                <AceEditor
                  mode="sql"
                  theme="github"
                  height="120px"
                  onChange={this.onSqlExpressionChange}
                  width="100%"
                  showGutter={false}
                  value={adhocMetric.sqlExpression || adhocMetric.getDefaultLabel()}
                  editorProps={{ $blockScrolling: true }}
                  enableLiveAutocompletion
                />
              </FormGroup>
            </Tab>
          }
        </Tabs>
        <Button
          disabled={!stateIsValid}
          bsStyle={(hasUnsavedChanges || !stateIsValid) ? 'default' : 'primary'}
          bsSize="small"
          className="m-r-5"
          onClick={this.onSave}
        >
          Save
        </Button>
        <Button bsSize="small" onClick={this.props.onClose}>Close</Button>
      </Popover>
    );
  }
} AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
