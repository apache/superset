import React, { PropTypes } from 'react';
import ControlHeader from '../ControlHeader';
import Metric from './Metric';

const propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.object.isRequired,
  datasource: PropTypes.object.isRequired,
};

const defaultProps = {
  onChange: () => {},
};

export default class MetricControl extends React.Component {
  onChange(value) {
    this.props.onChange(value);
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <Metric
          metric={this.props.value}
          datasource={this.props.datasource}
          onChange={this.onChange.bind(this)}
        />
      </div>
    );
  }
}

MetricControl.propTypes = propTypes;
MetricControl.defaultProps = defaultProps;
