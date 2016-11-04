import React, { PropTypes } from 'react';
import ControlHeader from '../ControlHeader';
import Metric from './Metric';

const propTypes = {
  initialMetrics: PropTypes.array.isRequired,
  datasource: PropTypes.object,
  onChange: PropTypes.func,
};

const defaultProps = {
  initialMetrics: [],
  onChange: () => {},
};

export default class MetricListControl extends React.Component {
  constructor(props) {
    super(props);
    const metrics = this.props.initialMetrics.slice();
    if (props.initialMetrics.length === 0) {
      metrics.push({
        metricType: 'free',
        metricLabel: 'row_count',
        sql: 'COUNT(*)',
      });
    }
    this.state = {
      metrics,
    };
  }
  onChange() {
    this.props.onChange(this.state.metrics);
  }
  deleteMetric(metric) {
    this.setState({ metrics: this.state.metrics.filter(m => m !== metric) });
  }
  changeMetric(i, metric) {
    const metrics = this.state.metrics.slice();
    metrics[i] = metric;
    this.setState({ metrics }, this.onChange);
  }
  addMetric() {
    const metrics = this.state.metrics.slice();
    const name = 'unlabeled metric ' + this.state.metrics.length;
    metrics.push({
      initialMetricType: 'free',
      initialLabel: name,
      initialSql: '',
    });
    this.setState({ metrics }, this.onChange);
  }
  render() {
    if (!this.props.datasource) {
      return null;
    }
    const metrics = this.state.metrics || [];
    return (
      <div className="MetricListControl">
        <ControlHeader {...this.props} />
        {metrics.map((metric, i) => (
          <Metric
            key={i}
            datasource={this.props.datasource}
            onChange={this.changeMetric.bind(this, i)}
            onDelete={this.deleteMetric.bind(this, metric)}
          />
        ))}
        <a onClick={this.addMetric.bind(this)} role="button">
          <i className="fa fa-plus-circle" />
        </a>
      </div>
    );
  }
}

MetricListControl.propTypes = propTypes;
MetricListControl.defaultProps = defaultProps;
