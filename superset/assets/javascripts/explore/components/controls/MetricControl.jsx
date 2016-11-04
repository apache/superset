import React, { PropTypes } from 'react';
import ControlHeader from '../ControlHeader';
import Metric from './Metric';

const propTypes = {
  onChange: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
};

export default class MetricControl extends React.Component {
  onChange() {
    this.props.onChange(this.state);
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <Metric {...this.props} />
      </div>
    );
  }
}

MetricControl.propTypes = propTypes;
MetricControl.defaultProps = defaultProps;
