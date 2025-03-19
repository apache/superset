/*
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

/* eslint-disable react/jsx-sort-default-props */
import { PureComponent } from 'react';
import { t } from '@superset-ui/core';
import { createSelector } from 'reselect';
import getChartComponentRegistry from '../registries/ChartComponentRegistrySingleton';
import getChartTransformPropsRegistry from '../registries/ChartTransformPropsRegistrySingleton';
import ChartProps from '../models/ChartProps';
import createLoadableRenderer from './createLoadableRenderer';
import { ChartType } from '../models/ChartPlugin';
import {
  PreTransformProps,
  TransformProps,
  PostTransformProps,
} from '../types/TransformFunction';
import { HandlerFunction } from '../types/Base';

function IDENTITY<T>(x: T) {
  return x;
}

const EMPTY = () => null;

const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
  onRenderSuccess() {},
  onRenderFailure() {},
};

interface LoadingProps {
  error: { toString(): string };
}

interface LoadedModules {
  Chart: ChartType;
  transformProps: TransformProps;
}

interface RenderProps {
  chartProps: ChartProps;
  preTransformProps?: PreTransformProps;
  postTransformProps?: PostTransformProps;
}

const BLANK_CHART_PROPS = new ChartProps();

export type Props = {
  id?: string;
  className?: string;
  chartProps?: ChartProps | null;
  chartType: string;
  preTransformProps?: PreTransformProps;
  overrideTransformProps?: TransformProps;
  postTransformProps?: PostTransformProps;
  onRenderSuccess?: HandlerFunction;
  onRenderFailure?: HandlerFunction;
};

export default class SuperChartCore extends PureComponent<Props, {}> {
  /**
   * The HTML element that wraps all chart content
   */
  container?: HTMLElement | null;

  /**
   * memoized function so it will not recompute
   * and return previous value
   * unless one of
   * - preTransformProps
   * - transformProps
   * - postTransformProps
   * - chartProps
   * is changed.
   */
  processChartProps = createSelector(
    [
      (input: {
        chartProps: ChartProps;
        preTransformProps?: PreTransformProps;
        transformProps?: TransformProps;
        postTransformProps?: PostTransformProps;
      }) => input.chartProps,
      input => input.preTransformProps,
      input => input.transformProps,
      input => input.postTransformProps,
    ],
    (chartProps, pre = IDENTITY, transform = IDENTITY, post = IDENTITY) =>
      post(transform(pre(chartProps))),
  );

  /**
   * memoized function so it will not recompute
   * and return previous value
   * unless one of
   * - chartType
   * - overrideTransformProps
   * is changed.
   */
  private createLoadableRenderer = createSelector(
    [
      (input: { chartType: string; overrideTransformProps?: TransformProps }) =>
        input.chartType,
      input => input.overrideTransformProps,
    ],
    (chartType, overrideTransformProps) => {
      if (chartType) {
        const Renderer = createLoadableRenderer({
          loader: {
            Chart: () => getChartComponentRegistry().getAsPromise(chartType),
            transformProps: overrideTransformProps
              ? () => Promise.resolve(overrideTransformProps)
              : () => getChartTransformPropsRegistry().getAsPromise(chartType),
          },
          loading: (loadingProps: LoadingProps) =>
            this.renderLoading(loadingProps, chartType),
          render: this.renderChart,
        });

        // Trigger preloading.
        Renderer.preload();

        return Renderer;
      }

      return EMPTY;
    },
  );

  static defaultProps = defaultProps;

  private renderChart = (loaded: LoadedModules, props: RenderProps) => {
    const { Chart, transformProps } = loaded;
    const { chartProps, preTransformProps, postTransformProps } = props;

    return (
      <Chart
        {...this.processChartProps({
          chartProps,
          preTransformProps,
          transformProps,
          postTransformProps,
        })}
      />
    );
  };

  private renderLoading = (loadingProps: LoadingProps, chartType: string) => {
    const { error } = loadingProps;

    if (error) {
      return (
        <div className="alert alert-warning" role="alert">
          <strong>{t('ERROR')}</strong>&nbsp;
          <code>chartType=&quot;{chartType}&quot;</code> &mdash;
          {error.toString()}
        </div>
      );
    }

    return null;
  };

  private setRef = (container: HTMLElement | null) => {
    this.container = container;
  };

  render() {
    const {
      id,
      className,
      preTransformProps,
      postTransformProps,
      chartProps = BLANK_CHART_PROPS,
      onRenderSuccess,
      onRenderFailure,
    } = this.props;

    // Create LoadableRenderer and start preloading
    // the lazy-loaded Chart components
    const Renderer = this.createLoadableRenderer(this.props);

    // Do not render if chartProps is set to null.
    // but the pre-loading has been started in this.createLoadableRenderer
    // to prepare for rendering once chartProps becomes available.
    if (chartProps === null) {
      return null;
    }

    const containerProps: {
      id?: string;
      className?: string;
    } = {};
    if (id) {
      containerProps.id = id;
    }
    if (className) {
      containerProps.className = className;
    }

    return (
      <div {...containerProps} ref={this.setRef}>
        <Renderer
          preTransformProps={preTransformProps}
          postTransformProps={postTransformProps}
          chartProps={chartProps}
          onRenderSuccess={onRenderSuccess}
          onRenderFailure={onRenderFailure}
        />
      </div>
    );
  }
}
