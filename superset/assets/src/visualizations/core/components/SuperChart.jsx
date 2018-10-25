import React from 'react';
import PropTypes from 'prop-types';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import ChartProps from '../models/ChartProps';

const STATUS = {
  IDLE: 1,
  LOADING: 2,
  SUCCESS: 3,
  FAILURE: 4,
};
const IDENTITY = x => x;

const propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
  chartProps: PropTypes.instanceOf(ChartProps).isRequired,
  chartType: PropTypes.string.isRequired,
  preTransformProps: PropTypes.func,
  overrideTransformProps: PropTypes.func,
  postTransformProps: PropTypes.func,
  onRenderSuccess: PropTypes.func,
  onRenderFailure: PropTypes.func,
};
const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
  onRenderSuccess() {},
  onRenderFailure() {},
};

class SuperChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      status: STATUS.IDLE,
      error: null,
      Renderer: null,
      transformProps: null,
    };
  }

  componentDidMount() {
    this.mounted = true;
    this.loadChartType(this.props);
  }

  componentWillReceiveProps(nextProps) {
    const { chartType, overrideTransformProps } = this.props;
    if (nextProps.chartType !== chartType
      || nextProps.overrideTransformProps !== overrideTransformProps
    ) {
      this.loadChartType(nextProps);
    }
  }

  componentDidUpdate() {
    const { onRenderSuccess, onRenderFailure } = this.props;
    const { status, error } = this.state;
    if (status === STATUS.SUCCESS) {
      onRenderSuccess();
    } else if (status === STATUS.FAILURE) {
      onRenderFailure(error);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  loadChartType({ chartType, overrideTransformProps }) {
    if (this.mounted) {
      // Clear state
      this.setState({
        status: chartType ? STATUS.IDLE : STATUS.LOADING,
        error: null,
        Renderer: null,
        transformProps: null,
      });

      if (chartType) {
        const componentPromise = getChartComponentRegistry().getAsPromise(chartType);
        const transformPropsPromise = overrideTransformProps
          ? Promise.resolve(overrideTransformProps)
          : getChartTransformPropsRegistry().getAsPromise(chartType);

        Promise.all([componentPromise, transformPropsPromise])
          .then(
            // on success
            ([Renderer, transformProps]) => {
              if (this.mounted) {
                this.setState({
                  status: STATUS.SUCCESS,
                  // This is to provide backward-compatibility
                  // for modules that are not exported with "export default"
                  // such as module.exports = xxx
                  Renderer: Renderer.default || Renderer,
                  transformProps,
                });
              }
            },
            // on failure
            (error) => {
              if (this.mounted) {
                this.setState({
                  status: STATUS.FAILURE,
                  error,
                  transformProps: IDENTITY,
                });
              }
            },
          );
      }
    }
  }

  renderContent() {
    const {
      chartProps,
      preTransformProps: pre,
      postTransformProps: post,
      chartType,
    } = this.props;

    const {
      status,
      error,
      Renderer,
      transformProps,
    } = this.state;

    switch (status) {
      case STATUS.SUCCESS:
        return (
          <Renderer {...post(transformProps(pre(chartProps)))} />
        );
      case STATUS.FAILURE:
        return (
          <div className="alert alert-warning" role="alert">
            <strong>ERROR</strong>&nbsp;
            <code>chartType="{chartType}"</code> &mdash;
            {error}
          </div>
        );
      case STATUS.LOADING:
        return (
          <span>Loading...</span>
        );
      default:
      case STATUS.IDLE:
        return null;
    }
  }

  render() {
    const { id, className } = this.props;

    return (
      <div id={id} className={className}>
        {this.renderContent()}
      </div>
    );
  }
}

SuperChart.propTypes = propTypes;
SuperChart.defaultProps = defaultProps;

export default SuperChart;
