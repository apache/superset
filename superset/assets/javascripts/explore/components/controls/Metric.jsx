import React, { PropTypes } from 'react';
import Select from 'react-select';
import {
  Col,
  FormControl,
  FormGroup,
  InputGroup,
  Label,
  OverlayTrigger,
  Popover,
  Radio,
  Row,
} from 'react-bootstrap';

import MetricOption from '../../../components/MetricOption';
import ColumnOption from '../../../components/ColumnOption';

const NUMERIC_TYPES = ['INT', 'INTEGER', 'BIGINT', 'DOUBLE', 'FLOAT', 'NUMERIC'];
function isNum(type) {
  return NUMERIC_TYPES.some(s => type.startsWith(s));
}
const nonNumericAggFunctions = {
  COUNT_DISTINCT: 'COUNT(DISTINCT {})',
  COUNT: 'COUNT({})',
};
const numericAggFunctions = {
  SUM: 'SUM({})',
  AVG: 'AVG({})',
  MIN: 'MIN({})',
  MAX: 'MAX({})',
  COUNT_DISTINCT: 'COUNT(DISTINCT {})',
  COUNT: 'COUNT({})',
};

const propTypes = {
  datasource: PropTypes.object,
  onChange: PropTypes.func,
  onDelete: PropTypes.func,
  metric: PropTypes.object.isRequired,
};

export default class Metric extends React.Component {
  constructor(props) {
    super(props);
    const datasource = props.datasource;
    const metric = props.metric;
    let column = datasource.columns[0];
    let predefMetric = datasource.metrics[0];
    if (metric.col) {
      column = datasource.columns.find(c => c.column_name === metric.col);
    }
    if (metric.metricName) {
      predefMetric = datasource.metrics.find(m => m.metric_name === metric.metricName);
    }
    this.state = {
      column,
      predefMetric,
      agg: metric.agg,
      label: metric.label,
      metricType: metric.metricType,
      expr: metric.expr,
    };
    this.onChange();
  }
  onChange() {
    const metric = {
      metricType: this.state.metricType,
      label: this.state.label,
    };
    if (this.state.metricType === 'metric') {
      metric.metricName = this.state.predefMetric.metric_name;
      metric.expr = this.state.predefMetric.expression;
    } else if (this.state.metricType === 'col') {
      metric.col = this.state.column.column_name;
      metric.agg = this.state.agg;
    } else if (this.state.metricType === 'expr') {
      metric.expr = this.state.expr;
    }
    this.props.onChange(metric);
  }
  onDelete() {
    this.props.onDelete();
  }
  setMetricType(v) {
    this.setState({ metricType: v }, this.onChange);
  }
  changeLabel(e) {
    const label = e.target.value;
    this.setState({ label }, this.onChange);
  }
  changeExpression(e) {
    const expr = e.target.value;
    this.setState({ expr, col: null, agg: null }, this.onChange);
  }
  optionify(arr) {
    return arr.map(s => ({ value: s, label: s }));
  }
  changeColumnSection() {
    let label;
    if (this.state.agg && this.state.column) {
      label = this.state.agg + '__' + this.state.column.column_name;
    } else {
      label = '';
    }
    this.setState({ label }, this.onChange);
  }
  changeagg(opt) {
    const agg = opt ? opt.value : null;
    this.setState({ agg }, this.changeColumnSection);
  }
  changeRadio(e) {
    this.setState({ metricType: e.target.value }, this.onChange);
  }
  changeMetric(predefMetric) {
    const label = predefMetric.verbose_name || predefMetric.metric_name;
    this.setState({ label, predefMetric }, this.onChange);
  }
  changeColumn(column) {
    let agg = this.state.agg;
    if (column) {
      if (!agg) {
        if (isNum(column.type)) {
          agg = 'SUM';
        } else {
          agg = 'COUNT_DISTINCT';
        }
      }
    } else {
      agg = null;
    }
    this.setState({ column, agg }, this.changeColumnSection);
  }
  renderColumnSelect() {
    return (
      <Select
        name="select-schema"
        placeholder="Column"
        clearable={false}
        onFocus={this.setMetricType.bind(this, 'col')}
        options={this.props.datasource.columns}
        onChange={this.changeColumn.bind(this)}
        value={this.state.column}
        autosize={false}
        optionRenderer={c => <ColumnOption column={c} />}
        valueRenderer={c => <ColumnOption prefix="Column: " column={c} />}
      />);
  }
  renderMetricSelect() {
    return (
      <Select
        name="select-schema"
        placeholder="Predefined metric"
        options={this.props.datasource.metrics}
        onFocus={this.setMetricType.bind(this, 'metric')}
        value={this.state.predefMetric}
        autosize={false}
        onChange={this.changeMetric.bind(this)}
        optionRenderer={m => <MetricOption metric={m} />}
        valueRenderer={m => <MetricOption prefix="Metric: " metric={m} />}
      />);
  }
  renderAggSelect() {
    let aggOptions = [];
    const column = this.state.column;
    if (column) {
      if (isNum(column.type)) {
        aggOptions = Object.keys(numericAggFunctions);
      } else {
        aggOptions = Object.keys(nonNumericAggFunctions);
      }
    }
    return (
      <Select
        name="select-schema"
        placeholder="agg function"
        clearable={false}
        onFocus={this.setMetricType.bind(this, 'col')}
        disabled={aggOptions.length === 0}
        options={this.optionify(aggOptions)}
        value={this.state.agg}
        autosize={false}
        onChange={this.changeagg.bind(this)}
        valueRenderer={o => (
          <div>
            <span className="text-muted">agg:</span> {o.label}
          </div>
        )}
      />);
  }
  renderOverlay() {
    const metricType = this.state.metricType;
    return (
      <Popover id="popover-positioned-right" title="Metric Definition">
        <FormGroup bsSize="sm" controlId="label">
          <InputGroup bsSize="sm">
            <InputGroup.Addon>Label</InputGroup.Addon>
            <FormControl
              type="text"
              value={this.state.label}
              placeholder="Label"
              onChange={this.changeLabel.bind(this)}
            />
          </InputGroup>
        </FormGroup>
        <hr />
        <div className={metricType !== 'col' ? 'dimmed' : ''}>
          <Row>
            <Col md={1}>
              <Radio
                name="metricType"
                inline
                value="col"
                onChange={this.changeRadio.bind(this)}
                checked={this.state.metricType === 'col'}
              />
            </Col>
            <Col md={11}>
              <div className="m-b-5">
                {this.renderColumnSelect()}
              </div>
              <div>
                {this.renderAggSelect()}
              </div>
            </Col>
          </Row>
        </div>
        <hr />
        <div className={metricType !== 'metric' ? 'dimmed' : ''}>
          <Row>
            <Col md={1}>
              <Radio
                inline
                name="metricType"
                value="metric"
                onChange={this.changeRadio.bind(this)}
                checked={this.state.metricType === 'metric'}
              />
            </Col>
            <Col md={11}>
              {this.renderMetricSelect()}
            </Col>
          </Row>
        </div>
        <hr />
        <div className={metricType !== 'expr' ? 'dimmed' : ''}>
          <Row>
            <Col md={1}>
              <Radio
                inline
                name="metricType"
                value="expr"
                onChange={this.changeRadio.bind(this)}
                checked={this.state.metricType === 'expr'}
              />
            </Col>
            <Col md={11}>
              <FormGroup bsSize="sm" controlId="expr">
                <InputGroup bsSize="sm">
                  <InputGroup.Addon>expr</InputGroup.Addon>
                  <FormControl
                    type="text"
                    value={this.state.expr}
                    onFocus={this.setMetricType.bind(this, 'expr')}
                    placeholder="Free form expr"
                    onChange={this.changeExpression.bind(this)}
                  />
                </InputGroup>
              </FormGroup>
            </Col>
          </Row>
        </div>
      </Popover>
    );
  }

  render() {
    if (!this.props.datasource) {
      return null;
    }
    let deleteButton;
    if (this.props.onDelete) {
      deleteButton = <i className="fa fa-times pointer" onClick={this.onDelete.bind(this)} />;
    }
    const trigger = (
      <OverlayTrigger
        trigger="click"
        placement="right"
        rootClose
        overlay={this.renderOverlay()}
      >
        <i className="fa fa-edit pointer" />
      </OverlayTrigger>
    );
    return (
      <Label
        className="Metric lead"
        style={{ display: 'inline-block', margin: '0 3 3 0', padding: '5px' }}
      >
        {this.state.label} {trigger} {deleteButton}
      </Label>
    );
  }
}

Metric.propTypes = propTypes;
