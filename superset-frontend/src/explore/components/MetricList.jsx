import React, { PropTypes } from 'react';
import MetricField from './MetricField';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const propTypes = {
  initialMetrics: PropTypes.array.isRequired,
  datasource: PropTypes.object,
  onChange: PropTypes.func,
};

const defaultProps = {
  initialMetrics: [],
  onChange: () => {},
};

export default class MetricList extends React.Component {
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
  onChange() {
    console.log(this.state.metrics);
    this.props.onChange(this.state.metrics);
  }
  deleteMetric(metric) {
    this.setState({ metrics: this.state.metrics.filter(m => m !== metric) });
  }

  render() {
    if (!this.props.datasource) {
      return null;
    }
    const metrics = this.state.metrics || [];
    return (
      <div className="MetricList">
        <ControlLabelWithTooltip
          label={this.props.label}
          description={this.props.description}
        />
        <div className="MetricList">
          {metrics.map((metric, i) => (
            <MetricField
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
      </div>
    );
  }
}

MetricList.propTypes = propTypes;
MetricList.defaultProps = defaultProps;
