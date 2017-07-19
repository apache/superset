import $ from 'jquery';
import { connect } from 'react-redux';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import visMap from '../../../visualizations/main';

import { addFilter, removeFilter, changeInterval } from '../actions/querySettingsActions';
import { getMockedSliceObject } from '../formDataUtils/sliceObject';


const propTypes = {
  containerId: PropTypes.string.isRequired,
  error: PropTypes.string,
  outdated: PropTypes.bool,
  isRunning: PropTypes.bool,
  formData: PropTypes.object,
  data: PropTypes.oneOfType(
      [PropTypes.object, PropTypes.arrayOf(PropTypes.object)]),
  columns: PropTypes.arrayOf(PropTypes.object),
  selectedMetrics: PropTypes.object,
  metrics: PropTypes.arrayOf(PropTypes.object),

  intervalCallback: PropTypes.func,
  handleAddFilter: PropTypes.func,
  handleRemoveFilter: PropTypes.func,
};

/**
 * This component takes care of rendering one of multiple charts
 */
class ChartContainer extends PureComponent {
  constructor(props) {
    super(props);
    this.update = this.update.bind(this);
    this.getCharts = this.getCharts.bind(this);
  }

  componentDidMount() { this.update(); }
  componentDidUpdate(prevProps) {
    if (prevProps.formData !== this.props.formData ||
        prevProps.data !== this.props.data) {
      this.update();
    }
  }

  /**
   * This function splits the data into multiple charts
   * @param data to be rendered
   * @param metrics to adapt legend and axis labels
   * @param formData which defines the visualization configuration
   */
  getCharts(data, metrics, separateCharts) {
    if (!data) {
      return [];
    } else if (separateCharts && Array.isArray(data) && metrics && metrics.length > 1) {
      const separatedData = [];
      for (const metric of metrics) {
        let series = data.filter((c) => {
          if (Array.isArray(c.key)) {
            return c.key[0] === metric.id;
          }
          return c.key === metric.id;
        });
        series = series.map(c => ({
          ...c,
        }));
        if (series.length) {
          separatedData.push(series);
        }
      }
      return separatedData;
    }
    return [data];
  }

  deleteGraphs(containerId) {
    $(`[id^=${containerId}-]`).toArray()
        .forEach(x => $(x).children().remove());
  }

  update() {
    const { error, data, formData, containerId, selectedMetrics, columns,
    intervalCallback, handleAddFilter, handleRemoveFilter } = this.props;
    const metrics = this.props.metrics.filter(x => selectedMetrics[x.id]).sort(x => x.name);
    if (!error && data && formData.viz_type) {
      // eslint-disable-next-line camelcase
      const charts = this.getCharts(data, metrics, formData.separate_charts);
      if (charts.length > 1) {
        charts.filter(x => x).forEach((series, i) => {
          const fd = Object.assign({}, formData);
          const dataObj = {
            data: series,
            intervalCallback,
          };
          const container = `${containerId}-${i}`;
          fd.y_axis_label = metrics[i].name;
          visMap[formData.viz_type](
                getMockedSliceObject(container,
                    fd,
                    metrics.concat(columns),
                    metrics.length,
                    handleAddFilter,
                    handleRemoveFilter),
                dataObj,
            );
        });
      } else if (charts.length && charts[0]) {
        this.deleteGraphs(containerId);
        const dataObj = {
          data: charts[0],
          intervalCallback,
        };
        visMap[formData.viz_type](getMockedSliceObject(`${containerId}-0`,
            formData,
            metrics.concat(columns),
            1,
            handleAddFilter,
            handleRemoveFilter), dataObj);
      }
    }
  }

  render() {
    const { selectedMetrics, containerId, error, isRunning, formData, outdated } = this.props;

    const chartContainers = [`${containerId}-0`];
    const num = Object.keys(selectedMetrics).length;
    if (formData.separate_charts && num > 1) {
      for (let i = 1; i < num; i++) {
        chartContainers.push(`${containerId}-${i}`);
      }
    }

    if (error) {
      this.deleteGraphs(containerId);
    }

    return (
      <div>
        <div id={containerId} style={{ marginBottom: '2rem' }}>
          {chartContainers.map((chart, index) =>
              (<div
                key={index}
                id={chart}
                className={formData.viz_type}
                style={{
                  opacity: isRunning || outdated ? '0.25' : '1',
                  backgroundImage: isRunning ? 'url(/static/assets/images/loading.gif)' : '',
                  backgroundRepeat: 'no-repeat',
                  backgroundAttachment: 'fixed',
                  backgroundPosition: 'center',
                  textAlign: 'center',
                  color: error ? 'red' : 'black',
                }}
              >
                {error}
              </div>),
            )}
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}

ChartContainer.propTypes = propTypes;

const mapStateToProps = state => ({
  isRunning: state.controls.isRunning,
  outdated: state.vizData.outdated,
  error: state.controls.error,
  data: state.vizData.data,
  formData: state.vizData.formData,
  metrics: state.refData.metrics,
  columns: state.refData.columns,
  selectedMetrics: state.settings.present.query.metrics,
});

const mapDispatchToProps = dispatch => ({
  intervalCallback: (intervalStart, intervalEnd) =>
    dispatch(changeInterval(intervalStart, intervalEnd)),
  handleAddFilter: filter => dispatch(addFilter(filter)),
  handleRemoveFilter: filter => dispatch(removeFilter(filter)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ChartContainer);
