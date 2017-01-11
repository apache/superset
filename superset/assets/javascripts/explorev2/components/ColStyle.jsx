import React from 'react';
// import { Tab, Row, Col, Nav, NavItem } from 'react-bootstrap';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  form_data: React.PropTypes.object.isRequired,
  colStyle: React.PropTypes.object.isRequired,
};

export default class ColStyle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metricChoices: this.props.form_data.groupby.concat(this.props.form_data.metrics),
    };
  }
  changeMetric(colStyle, col) {
    const val = (col) ? col.value : null;
    this.props.actions.changeColStyle(colStyle, 'metric', val);
  }
  changeValue(colStyle, event) {
    this.props.actions.changeColStyle(colStyle, 'value', event.target.value);
  }
  removeColStyle(colStyle) {
    this.props.actions.removeColStyle(colStyle);
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
            options={this.state.metricChoices.map((o) => ({ value: o, label: o }))}
            value={this.props.colStyle.metric}
            autosize={false}
            onChange={this.changeMetric.bind(this, this.props.colStyle)}
          />
          <div className="col-lg-5">
            <input
              type="text"
              onChange={this.changeValue.bind(this, this.props.colStyle)}
              value={this.props.colStyle.value}
              className="form-control input-sm"
              placeholder="样式"
            />
          </div>

          <div className="col-lg-1">
            <Button
              id="remove-button"
              bsSize="small"
              onClick={this.removeColStyle.bind(this, this.props.colStyle)}
            >
              <i className="fa fa-minus" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

ColStyle.propTypes = propTypes;
