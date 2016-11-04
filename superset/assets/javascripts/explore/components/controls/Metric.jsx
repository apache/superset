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
  column: PropTypes.string,
  metricType: PropTypes.string,
  onChange: PropTypes.func,
  initialMetricType: PropTypes.string,
  initialLabel: PropTypes.string,
  initialSql: PropTypes.string,
  onDelete: PropTypes.func,
};

const defaultProps = {
  initialMetricType: 'free',
  initialLabel: 'row_count',
  initialSql: 'COUNT(*)',
};

export default class Metric extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      aggregate: null,
      label: props.initialLabel,
      metricType: props.initialMetricType,
      metricName: null,
      sql: props.initialSql,
    };
  }
  onChange() {
    this.props.onChange(this.state);
  }
  onDelete() {
    this.props.onDelete();
  }
  setMetricType(v) {
    this.setState({ metricType: v });
  }
  changeLabel(e) {
    const label = e.target.value;
    this.setState({ label }, this.onChange);
  }
  changeExpression(e) {
    const sql = e.target.value;
    this.setState({ sql, columnName: null, aggregate: null }, this.onChange);
  }
  optionify(arr) {
    return arr.map(s => ({ value: s, label: s }));
  }
  changeColumnSection() {
    let label;
    if (this.state.aggregate && this.state.column) {
      label = this.state.aggregate + '__' + this.state.column.column_name;
    } else {
      label = '';
    }
    this.setState({ label }, this.onChange);
  }
  changeAggregate(opt) {
    const aggregate = opt ? opt.value : null;
    this.setState({ aggregate }, this.changeColumnSection);
  }
  changeRadio(e) {
    this.setState({ metricType: e.target.value });
  }
  changeMetric(metric) {
    let label;
    if (metric) {
      label = metric.metric_name;
    }
    this.setState({ label, metric }, this.onChange);
  }
  changeColumn(column) {
    let aggregate = this.state.aggregate;
    if (column) {
      if (!aggregate) {
        if (isNum(column.type)) {
          aggregate = 'SUM';
        } else {
          aggregate = 'COUNT_DISTINCT';
        }
      }
    } else {
      aggregate = null;
    }
    this.setState({ column, aggregate }, this.changeColumnSection);
  }
  renderOverlay() {
    let aggregateOptions = [];
    const column = this.state.column;
    if (column) {
      if (isNum(column.type)) {
        aggregateOptions = Object.keys(numericAggFunctions);
      } else {
        aggregateOptions = Object.keys(nonNumericAggFunctions);
      }
    }
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
        <div className={metricType !== 'column' ? 'dimmed' : ''}>
          <Row>
            <Col md={1}>
              <Radio
                name="metricType"
                inline
                value="column"
                onChange={this.changeRadio.bind(this)}
                checked={this.state.metricType === 'column'}
              />
            </Col>
            <Col md={11}>
              <div className="m-b-5">
                <Select
                  name="select-schema"
                  placeholder="Column"
                  onFocus={this.setMetricType.bind(this, 'column')}
                  options={this.props.datasource.columns}
                  onChange={this.changeColumn.bind(this)}
                  value={this.state.column}
                  autosize={false}
                  optionRenderer={c => <ColumnOption column={c} />}
                  valueRenderer={c => <ColumnOption prefix='Column: ' column={c} />}
                />
              </div>
              <div>
                <Select
                  name="select-schema"
                  placeholder="Aggregate function"
                  onFocus={this.setMetricType.bind(this, 'column')}
                  disabled={aggregateOptions.length === 0}
                  options={this.optionify(aggregateOptions)}
                  value={this.state.aggregate}
                  autosize={false}
                  onChange={this.changeAggregate.bind(this)}
                  valueRenderer={o => (
                    <div>
                      <span className="text-muted">Aggregate:</span> {o.label}
                    </div>
                  )}
                />
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
              <Select
                name="select-schema"
                placeholder="Predefined metric"
                options={this.props.datasource.metrics}
                onFocus={this.setMetricType.bind(this, 'metric')}
                value={this.state.metric}
                autosize={false}
                onChange={this.changeMetric.bind(this)}
                optionRenderer={m => <MetricOption metric={m} />}
                valueRenderer={m => <MetricOption prefix='Metric: ' metric={m} />}
              />
            </Col>
          </Row>
        </div>
        <hr />
        <div className={metricType !== 'free' ? 'dimmed' : ''}>
          <Row>
            <Col md={1}>
              <Radio
                inline
                name="metricType"
                value="free"
                onChange={this.changeRadio.bind(this)}
                checked={this.state.metricType === 'free'}
              />
            </Col>
            <Col md={11}>
              <FormGroup bsSize="sm" controlId="sql">
                <InputGroup bsSize="sm">
                  <InputGroup.Addon>SQL</InputGroup.Addon>
                  <FormControl
                    type="text"
                    value={this.state.sql}
                    onFocus={this.setMetricType.bind(this, 'free')}
                    placeholder="Free form SQL"
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
      deleteButton = <i className="fa fa-times" onClick={this.onDelete.bind(this)} />;
    }
    const trigger = (
      <OverlayTrigger
        trigger="click"
        placement="right"
        rootClose
        overlay={this.renderOverlay()}
      >
        <i className="fa fa-edit" role="button" />
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
Metric.defaultProps = defaultProps;
