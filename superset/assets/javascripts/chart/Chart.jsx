/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import Mustache from 'mustache';

import { d3format } from '../modules/utils';
import ChartBody from './ChartBody';

const propTypes = {
  containerId: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
};

const defaultProps = {
  addFilter: () => {},
  getFilters: () => ({}),
  clearFilter: () => {},
  removeFilter: () => {},
};

class Chart extends React.PureComponent {
  constructor(props) {
    super(props);

    // these properties are used by visualizations
    this.containerId = props.containerId;
    this.selector = `#${this.containerId}`;
    this.formData = props.formData;
    this.datasource = props.datasource;
    this.addFilter = this.addFilter.bind(this);
    this.getFilters = this.getFilters.bind(this);
    this.clearFilter = this.clearFilter.bind(this);
    this.removeFilter = this.removeFilter.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    this.containerId = nextProps.containerId;
    this.selector = `#${this.containerId}`;
    this.formData = nextProps.formData;
    this.datasource = nextProps.datasource;
  }

  getFilters() {
    return this.props.getFilters();
  }

  addFilter(col, vals, merge = true, refresh = true) {
    this.props.addFilter(col, vals, merge, refresh);
  }

  clearFilter() {
    this.props.clearFilter();
  }

  removeFilter(col, vals) {
    this.props.removeFilter(col, vals);
  }

  clearError() {
    this.setState({
      errorMsg: null,
    });
  }

  width() {
    return this.props.width ?
      this.props.width :
      this.container.el.offsetWidth;
  }

  height() {
    return this.props.height ?
      this.props.height :
      this.container.el.offsetHeight;
  }

  d3format(col, number) {
    const format =
      this.props.datasource.column_formats && this.props.datasource.column_formats[col] ?
      this.props.datasource.column_formats[col] : '0.3s';
    return d3format(format, number);
  }

  render_template(s) {
    const context = {
      width: this.width(),
      height: this.height(),
    };
    return Mustache.render(s, context);
  }

  render() {
    return (
      <ChartBody
        containerId={this.containerId}
        vizType={this.props.formData.viz_type}
        height={this.height.bind(this)}
        width={this.width.bind(this)}
        ref={(inner) => { this.container = inner; }}
      />
    );
  }
}

Chart.propTypes = propTypes;
Chart.defaultProps = defaultProps;

export default Chart;
