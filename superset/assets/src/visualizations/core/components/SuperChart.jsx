import React from 'react';
import Loadable from 'react-loadable';
import PropTypes from 'prop-types';
import { createSelector } from 'reselect';
import { getChartComponentRegistry, getChartTransformPropsRegistry, ChartProps } from '@superset-ui/chart';

const IDENTITY = x => x;

const propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
  chartProps: PropTypes.instanceOf(ChartProps),
  chartType: PropTypes.string.isRequired,
  preTransformProps: PropTypes.func,
  overrideTransformProps: PropTypes.func,
  postTransformProps: PropTypes.func,
  onRenderSuccess: PropTypes.func,
  onRenderFailure: PropTypes.func,
  skipRendering: PropTypes.bool,
};
const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
  onRenderSuccess() {},
  onRenderFailure() {},
  skipRendering: false,
};

class SuperChart extends React.PureComponent {
  constructor(props) {
    super(props);

    this.renderChart = this.renderChart.bind(this);
    this.renderLoading = this.renderLoading.bind(this);

    // memoized function so it will not recompute
    // and return previous value
    // unless one of
    // - preTransformProps
    // - transformProps
    // - postTransformProps
    // - chartProps
    // is changed.
    this.processChartProps = createSelector(
      input => input.preTransformProps,
      input => input.transformProps,
      input => input.postTransformProps,
      input => input.chartProps,
      (pre, transform, post, chartProps) => post(transform(pre(chartProps))),
    );

    const componentRegistry = getChartComponentRegistry();
    const transformPropsRegistry = getChartTransformPropsRegistry();

    // memoized function so it will not recompute
    // and return previous value
    // unless one of
    // - chartType
    // - overrideTransformProps
    // is changed.
    this.createLoadableRenderer = createSelector(
      input => input.chartType,
      input => input.overrideTransformProps,
      (chartType, overrideTransformProps) => {
        if (chartType) {
          return Loadable.Map({
            loader: {
              Chart: () => componentRegistry.getAsPromise(chartType),
              transformProps: overrideTransformProps
                ? () => Promise.resolve(overrideTransformProps)
                : () => transformPropsRegistry.getAsPromise(chartType),
            },
            loading: loadingProps => this.renderLoading(loadingProps, chartType),
            render: this.renderChart,
          });
        }
        return null;
      },
    );
  }

  renderChart(loaded, props) {
    const Chart = loaded.Chart.default || loaded.Chart;
    const transformProps = loaded.transformProps;
    const {
      chartProps,
      preTransformProps,
      postTransformProps,
    } = props;

    const result = (
      <Chart
        {...this.processChartProps({
          preTransformProps,
          transformProps,
          postTransformProps,
          chartProps,
        })}
      />
    );
    setTimeout(() => this.props.onRenderSuccess(), 0);
    return result;
  }

  renderLoading(loadableProps, chartType) {
    const { error } = loadableProps;

    if (error) {
      const result = (
        <div className="alert alert-warning" role="alert">
          <strong>ERROR</strong>&nbsp;
          <code>chartType="{chartType}"</code> &mdash;
          {JSON.stringify(error)}
        </div>
      );
      setTimeout(() => this.props.onRenderFailure(error), 0);
      return result;
    }

    return null;
  }

  render() {
    const {
      id,
      className,
      preTransformProps,
      postTransformProps,
      chartProps,
      skipRendering,
    } = this.props;

    const LoadableRenderer = this.createLoadableRenderer(this.props);

    // Use this to allow loading the vis components
    // without rendering (while waiting for data)
    if (skipRendering || !chartProps) {
      return null;
    }

    return (
      <div id={id} className={className}>
        {LoadableRenderer && (
          <LoadableRenderer
            preTransformProps={preTransformProps}
            postTransformProps={postTransformProps}
            chartProps={chartProps}
          />
        )}
      </div>
    );
  }
}

SuperChart.propTypes = propTypes;
SuperChart.defaultProps = defaultProps;

export default SuperChart;
