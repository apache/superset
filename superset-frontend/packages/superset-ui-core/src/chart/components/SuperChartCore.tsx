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

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { t } from '@apache-superset/core';
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

export interface SuperChartCoreRef {
  container: HTMLElement | null;
}

const SuperChartCore = forwardRef<SuperChartCoreRef, Props>(
  function SuperChartCore(
    {
      id = '',
      className = '',
      chartProps = BLANK_CHART_PROPS,
      chartType,
      preTransformProps = IDENTITY,
      overrideTransformProps,
      postTransformProps = IDENTITY,
      onRenderSuccess = () => {},
      onRenderFailure = () => {},
    },
    ref,
  ) {
    const containerRef = useRef<HTMLElement | null>(null);

    // Expose container via ref
    useImperativeHandle(
      ref,
      () => ({
        get container() {
          return containerRef.current;
        },
      }),
      [],
    );

    /**
     * memoized function so it will not recompute and return previous value
     * unless one of
     * - preTransformProps
     * - chartProps
     * is changed.
     */
    const preSelector = useMemo(
      () =>
        createSelector(
          [
            (input: {
              chartProps: ChartProps;
              preTransformProps?: PreTransformProps;
            }) => input.chartProps,
            input => input.preTransformProps,
          ],
          (inputChartProps, pre = IDENTITY) => pre(inputChartProps),
        ),
      [],
    );

    /**
     * memoized function so it will not recompute and return previous value
     * unless one of the input arguments have changed.
     */
    const transformSelector = useMemo(
      () =>
        createSelector(
          [
            (input: {
              chartProps: ChartProps;
              transformProps?: TransformProps;
            }) => input.chartProps,
            input => input.transformProps,
          ],
          (preprocessedChartProps, transform = IDENTITY) =>
            transform(preprocessedChartProps),
        ),
      [],
    );

    /**
     * memoized function so it will not recompute and return previous value
     * unless one of the input arguments have changed.
     */
    const postSelector = useMemo(
      () =>
        createSelector(
          [
            (input: {
              chartProps: ChartProps;
              postTransformProps?: PostTransformProps;
            }) => input.chartProps,
            input => input.postTransformProps,
          ],
          (transformedChartProps, post = IDENTITY) =>
            post(transformedChartProps),
        ),
      [],
    );

    /**
     * Using each memoized function to retrieve the computed chartProps
     */
    const processChartProps = useCallback(
      ({
        chartProps: inputChartProps,
        preTransformProps: pre,
        transformProps,
        postTransformProps: post,
      }: {
        chartProps: ChartProps;
        preTransformProps?: PreTransformProps;
        transformProps?: TransformProps;
        postTransformProps?: PostTransformProps;
      }) =>
        postSelector({
          chartProps: transformSelector({
            chartProps: preSelector({
              chartProps: inputChartProps,
              preTransformProps: pre,
            }),
            transformProps,
          }),
          postTransformProps: post,
        }),
      [preSelector, transformSelector, postSelector],
    );

    const renderLoading = useCallback(
      (loadingProps: LoadingProps, loadingChartType: string) => {
        const { error } = loadingProps;

        if (error) {
          return (
            <div className="alert alert-warning" role="alert">
              <strong>{t('ERROR')}</strong>&nbsp;
              <code>chartType=&quot;{loadingChartType}&quot;</code> &mdash;
              {error.toString()}
            </div>
          );
        }

        return null;
      },
      [],
    );

    const renderChart = useCallback(
      (loaded: LoadedModules, props: RenderProps) => {
        const { Chart, transformProps } = loaded;
        const {
          chartProps: renderChartProps,
          preTransformProps: pre,
          postTransformProps: post,
        } = props;

        return (
          <Chart
            {...processChartProps({
              chartProps: renderChartProps,
              preTransformProps: pre,
              transformProps,
              postTransformProps: post,
            })}
          />
        );
      },
      [processChartProps],
    );

    /**
     * memoized function so it will not recompute
     * and return previous value
     * unless one of
     * - chartType
     * - overrideTransformProps
     * is changed.
     */
    const createLoadableRendererSelector = useMemo(
      () =>
        createSelector(
          [
            (input: {
              chartType: string;
              overrideTransformProps?: TransformProps;
            }) => input.chartType,
            input => input.overrideTransformProps,
          ],
          (selectorChartType, selectorOverrideTransformProps) => {
            if (selectorChartType) {
              const Renderer = createLoadableRenderer({
                loader: {
                  Chart: () =>
                    getChartComponentRegistry().getAsPromise(selectorChartType),
                  transformProps: selectorOverrideTransformProps
                    ? () => Promise.resolve(selectorOverrideTransformProps)
                    : () =>
                        getChartTransformPropsRegistry().getAsPromise(
                          selectorChartType,
                        ),
                },
                loading: (loadingProps: LoadingProps) =>
                  renderLoading(loadingProps, selectorChartType),
                render: renderChart,
              });

              // Trigger preloading.
              Renderer.preload();

              return Renderer;
            }

            return EMPTY;
          },
        ),
      [renderLoading, renderChart],
    );

    const setRef = useCallback((container: HTMLElement | null) => {
      containerRef.current = container;
    }, []);

    // Create LoadableRenderer and start preloading
    // the lazy-loaded Chart components
    const Renderer = createLoadableRendererSelector({
      chartType,
      overrideTransformProps,
    });

    // Do not render if chartProps is set to null.
    // but the pre-loading has been started in createLoadableRendererSelector
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
      <div {...containerProps} ref={setRef}>
        <Renderer
          preTransformProps={preTransformProps}
          postTransformProps={postTransformProps}
          chartProps={chartProps}
          onRenderSuccess={onRenderSuccess}
          onRenderFailure={onRenderFailure}
        />
      </div>
    );
  },
);

export default SuperChartCore;
