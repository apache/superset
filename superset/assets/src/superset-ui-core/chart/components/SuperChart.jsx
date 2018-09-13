import React from 'react';
import PropTypes from 'prop-types';
import { createErrorMessage } from './ErrorMessageFactory';
import { loadChart } from '../registries/ChartLoaderRegistry';
import { loadTransformProps } from '../registries/TransformPropsLoaderRegistry';

const IDENTITY = x => x;

const propTypes = {
  id: PropTypes.string,
  className: PropTypes.string,
  type: PropTypes.string.isRequired,
  preTransformProps: PropTypes.func,
  overrideTransformProps: PropTypes.func,
  postTransformProps: PropTypes.func,
};
const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
};

class SuperChart extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      Renderer: null,
      transformProps: null,
    };
    this.loading = false;
  }

  componentDidMount() {
    const { type, overrideTransformProps } = this.props;
    this.loadChartType(type, overrideTransformProps);
  }

  componentWillReceiveProps(nextProps) {
    const { type, overrideTransformProps } = this.props;
    if (nextProps.type !== type
      || nextProps.overrideTransformProps !== overrideTransformProps
    ) {
      this.loadChartType(nextProps.type, nextProps.overrideTransformProps);
    }
  }

  loadChartType(type, overrideTransformProps) {
    // Clear state
    this.setState({
      Renderer: null,
      transformProps: null,
    });
    this.loading = false;

    if (type) {
      console.log('loadChart', loadChart);
      const componentPromise = loadChart(type);
      const transformPropsPromise = overrideTransformProps
        ? Promise.resolve(overrideTransformProps)
        : loadTransformProps(type);

      this.loading = Promise.all([componentPromise, transformPropsPromise])
        .then(
          // on success
          ([Renderer, transformProps]) => {
            this.setState({ Renderer, transformProps });
          },
          // on failure
          (error) => {
            this.setState({
              Renderer: createErrorMessage(type, error),
              transformProps: IDENTITY,
            });
          },
        );
    }
  }

  render() {
    const {
      id,
      className,
      preTransformProps,
      overrideTransformProps,
      postTransformProps,
      ...otherProps
    } = this.props;
    const type = this.props.type;

    const { Renderer } = this.state;

    // Loaded (both success and failure)
    if (Renderer && this.transformProps) {
      return (
        <Renderer
          id={id}
          className={className}
          type={type}
          {...postTransformProps(this.transformProps(preTransformProps(otherProps)))}
        />
      );
    }

    // Loading state
    if (this.loading) {
      return (
        <div id={id} className={className} type={type}>
          Loading...
        </div>
      );
    }

    // Initial state
    return (
      <div id={id} className={className} type={type} />
    );
  }
}

SuperChart.propTypes = propTypes;
SuperChart.defaultProps = defaultProps;

export default SuperChart;
