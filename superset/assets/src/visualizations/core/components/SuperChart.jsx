/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { createSelector } from 'reselect';
import { getChartComponentRegistry, getChartTransformPropsRegistry, ChartProps } from '@superset-ui/chart';
import createLoadableRenderer from './createLoadableRenderer';
import { safeStringify } from '../../../utils/safeStringify';

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
          const LoadableRenderer = createLoadableRenderer({
            loader: {
              Chart: () => componentRegistry.getAsPromise(chartType),
              transformProps: overrideTransformProps
                ? () => Promise.resolve(overrideTransformProps)
                : () => transformPropsRegistry.getAsPromise(chartType),
            },
            loading: loadingProps => this.renderLoading(loadingProps, chartType),
            render: this.renderChart,
          });

          // Trigger preloading.
          LoadableRenderer.preload();

          return LoadableRenderer;
        }
        return null;
      },
    );
  }


  renderChart(loaded, props) {
    const Chart = loaded.Chart.default || loaded.Chart;
    const transformProps = loaded.transformProps.default || loaded.transformProps;
    const {
      chartProps,
      preTransformProps,
      postTransformProps,
    } = props;

    return (
      <Chart
        {...this.processChartProps({
          preTransformProps,
          transformProps,
          postTransformProps,
          chartProps,
        })}
      />
    );
  }

  renderLoading(loadingProps, chartType) {
    const { error } = loadingProps;

    if (error) {
      return (
        <div className="alert alert-warning" role="alert">
          <strong>ERROR</strong>&nbsp;
          <code>chartType="{chartType}"</code> &mdash;
          {safeStringify(error)}
        </div>
      );
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
      onRenderSuccess,
      onRenderFailure,
    } = this.props;

    // Create LoadableRenderer and start preloading
    // the lazy-loaded Chart components
    const LoadableRenderer = this.createLoadableRenderer(this.props);

    // Do not render if chartProps is not available.
    // but the pre-loading has been started in this.createLoadableRenderer
    // to prepare for rendering once chartProps becomes available.
    if (!chartProps) {
      return null;
    }

    return (
      <div id={id} className={className}>
        {LoadableRenderer && (
          <LoadableRenderer
            preTransformProps={preTransformProps}
            postTransformProps={postTransformProps}
            chartProps={chartProps}
            onRenderSuccess={onRenderSuccess}
            onRenderFailure={onRenderFailure}
          />
        )}
      </div>
    );
  }
}

SuperChart.propTypes = propTypes;
SuperChart.defaultProps = defaultProps;

export default SuperChart;
