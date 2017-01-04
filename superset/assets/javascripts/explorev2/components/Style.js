import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  style: React.PropTypes.object.isRequired,
};

export default class Style extends React.Component {
  changeMetric(style, col) {
    const val = (col) ? col.value : null;
    this.props.actions.changeStyle(style, 'metric', val);
  }
  changeExpr(style, event) {
    this.props.actions.changeStyle(style, 'expr', event.target.value);
  }
  changeValue(style, event) {
    this.props.actions.changeStyle(style, 'value', event.target.value);
  }
  removeStyle(style) {
    this.props.actions.removeStyle(style);
  }
  render() {
    return (
      <div>
        <div className="row space-1">
          <Select
            className="col-lg-12"
            multi={false}
            name="select-column"
            placeholder="Select metric"
            options={this.props.form_data.metrics.map((o) => ({ value: o, label: o }))}
            value={this.props.style.metric}
            autosize={false}
            onChange={this.changeMetric.bind(this, this.props.style)}
          />
        </div>
        <div className="row space-1">
          <div className="col-lg-4">
            <input
              type="text"
              onChange={this.changeExpr.bind(this, this.props.style)}
              value={this.props.style.expr}
              className="form-control input-sm"
              placeholder="阀值"
            />
          </div>
          <div className="col-lg-6">
            <input
              type="text"
              onChange={this.changeValue.bind(this, this.props.style)}
              value={this.props.style.value}
              className="form-control input-sm"
              placeholder="样式"
            />
          </div>
          <div className="col-lg-2">
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeStyle.bind(this, this.props.style)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

Style.propTypes = propTypes;
