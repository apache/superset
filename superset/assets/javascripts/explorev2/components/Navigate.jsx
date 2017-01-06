import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  navigate: React.PropTypes.object.isRequired,
  slices: React.PropTypes.object.isRequired,
};

export default class Navigate extends React.Component {
  changeMetric(navigate, col) {
    const val = (col) ? col.value : null;
    this.props.actions.changeNavigate(navigate, 'metric', val);
  }
  changeExpr(navigate, event) {
    this.props.actions.changeNavigate(navigate, 'expr', event.target.value);
  }
  changeSlice(navigate, col) {
    const val = (col) ? col.value : null;
    this.props.actions.changeNavigate(navigate, 'slice', val);
  }
  removeNavigate(navigate) {
    this.props.actions.removeNavigate(navigate);
  }
  render() {
    return (
      <div>
        <div className="row space-1">
          <Select
            className="col-lg-6"
            multi={false}
            name="select-column"
            placeholder="指标"
            options={this.props.form_data.metrics.map((o) => ({ value: o, label: o }))}
            value={this.props.navigate.metric}
            autosize={false}
            onChange={this.changeMetric.bind(this, this.props.navigate)}
          />
          <div className="col-lg-6">
            <input
              type="text"
              onChange={this.changeExpr.bind(this, this.props.navigate)}
              value={this.props.navigate.expr}
              className="form-control input-sm"
              placeholder="阀值"
            />
          </div>
        </div>
        <div className="row space-1">
          <Select
            className="col-lg-10"
            multi={false}
            name="select-column"
            placeholder="导航切片"
            options={this.props.slices.map((o) => ({ value: o[0]+'', label: o[1] }))}
            value={this.props.navigate.slice}
            autosize={false}
            onChange={this.changeSlice.bind(this, this.props.navigate)}
          />
          <div className="col-lg-2">
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeNavigate.bind(this, this.props.navigate)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

Navigate.propTypes = propTypes;
