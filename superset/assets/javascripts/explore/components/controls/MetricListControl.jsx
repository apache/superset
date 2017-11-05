import React, { PropTypes } from 'react';
import shortid from 'shortid';

import ControlHeader from '../ControlHeader';
import Metric from './Metric';

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.array,
};

const defaultProps = {
  onChange: () => {},
  value: [],
};

export default class MetricListControl extends React.Component {
  constructor(props) {
    super(props);
    let metrics = props.value || [];
    /* eslint-disable no-param-reassign */
    metrics = metrics.map((m) => {
      m.uid = shortid.generate();
      return m;
    });
    this.state = { metrics };
  }
  onChange() {
    this.props.onChange(this.state.metrics, this.validate());
  }
  validate() {
    const labels = {};
    this.state.metrics.forEach((m) => {
      labels[m.label] = null;
    });
    if (Object.keys(labels).length < this.state.metrics.length) {
      return ['Provide a unique label for each metric'];
    }
    return null;
  }
  deleteMetric(uid) {
    const metrics = this.state.metrics.filter(m => m.uid !== uid);
    this.setState({ metrics }, this.onChange);
  }
  changeMetric(uid, metric) {
    const metrics = this.state.metrics.map((m) => {
      if (uid === m.uid) {
        metric.uid = uid;
        return metric;
      }
      return m;
    });
    this.setState({ metrics }, this.onChange);
  }
  addMetric() {
    const metrics = this.state.metrics.slice();
    const label = 'unlabeled metric ' + this.state.metrics.length;
    metrics.push({
      label,
      uid: shortid.generate(),
      expr: 'COUNT(*)',
      metricType: 'expr',
    });
    this.setState({ metrics }, this.onChange);
  }
  render() {
    return (
      <div className="MetricListControl">
        <ControlHeader {...this.props} />
        {this.state.metrics.map(metric => (
          <Metric
            key={metric.uid}
            metric={metric}
            datasource={this.props.datasource}
            onChange={this.changeMetric.bind(this, metric.uid)}
            onDelete={this.deleteMetric.bind(this, metric.uid)}
          />
        ))}
        <a onClick={this.addMetric.bind(this)} className="pointer">
          <i className="fa fa-plus-circle" />
        </a>
      </div>
    );
  }
}

MetricListControl.propTypes = propTypes;
MetricListControl.defaultProps = defaultProps;
