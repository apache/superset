import React from 'react';
import PropTypes from 'prop-types';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';

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
  vizType: PropTypes.string.isRequired,
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
    const { vizType, overrideTransformProps } = this.props;
    if (nextProps.vizType !== vizType
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

  loadChartType({ vizType, overrideTransformProps }) {
    if (this.mounted) {
      // Clear state
      this.setState({
        status: vizType ? STATUS.IDLE : STATUS.LOADING,
        error: null,
        Renderer: null,
        transformProps: null,
      });

      if (vizType) {
        const componentPromise = getChartComponentRegistry().getAsPromise(vizType);
        const transformPropsPromise = overrideTransformProps
          ? Promise.resolve(overrideTransformProps)
          : getChartTransformPropsRegistry().getAsPromise(vizType);

        Promise.all([componentPromise, transformPropsPromise])
          .then(
            // on success
            ([Renderer, transformProps]) => {
              if (this.mounted) {
                this.setState({
                  status: STATUS.SUCCESS,
                  Renderer,
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
                  Renderer: () => (
                    <div className="alert alert-warning" role="alert">
                      <strong>ERROR</strong>
                      Chart vizType: <code>{vizType}</code> &mdash;
                      {error}
                    </div>
                  ),
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
      id,
      className,
      preTransformProps,
      overrideTransformProps,
      postTransformProps,
      onRenderSuccess,
      onRenderFailure,
      ...otherProps
    } = this.props;

    const vizType = this.props.vizType;

    const { status, error, Renderer, transformProps } = this.state;

    switch (status) {
      case STATUS.SUCCESS:
        return (
          <Renderer
            vizType={vizType}
            {...postTransformProps(transformProps(preTransformProps(otherProps)))}
          />
        );
      case STATUS.FAILURE:
        return (
          <div className="alert alert-warning" role="alert">
            <strong>ERROR</strong>
            Chart vizType: <code>{vizType}</code> &mdash;
            {error}
          </div>
        );
      case STATUS.LOADING:
        return (
          <span>Loading...</span>
        );
      default:
      case STATUS.IDLE:
        return (
          <div className="alert alert-warning" role="alert">
            <code>vizType</code> is not specified.
          </div>
        );
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
