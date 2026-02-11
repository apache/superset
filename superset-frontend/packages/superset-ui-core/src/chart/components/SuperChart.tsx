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
  ReactNode,
  RefObject,
  ComponentType,
  Fragment,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import {
  ErrorBoundary,
  ErrorBoundaryProps,
  FallbackProps,
} from 'react-error-boundary';
import { ParentSize } from '@visx/responsive';
import { createSelector } from 'reselect';
import { useTheme } from '@emotion/react';
import { parseLength, Dimension } from '../../dimension';
import getChartMetadataRegistry from '../registries/ChartMetadataRegistrySingleton';
import SuperChartCore, {
  Props as SuperChartCoreProps,
  SuperChartCoreRef,
} from './SuperChartCore';
import DefaultFallbackComponent from './FallbackComponent';
import ChartProps, { ChartPropsConfig } from '../models/ChartProps';
import NoResultsComponent from './NoResultsComponent';
import { isMatrixifyEnabled } from '../types/matrixify';
import MatrixifyGridRenderer from './Matrixify/MatrixifyGridRenderer';
import { SupersetTheme } from '@apache-superset/core/ui';

export type FallbackPropsWithDimension = FallbackProps & Partial<Dimension>;

export type WrapperProps = Dimension & {
  children: ReactNode;
};

export type Props = Omit<SuperChartCoreProps, 'chartProps'> &
  Omit<ChartPropsConfig, 'width' | 'height'> & {
    /**
     * Set this to true to disable error boundary built-in in SuperChart
     * and let the error propagate to upper level
     * and handle by yourself
     */
    disableErrorBoundary?: boolean;
    /** debounceTime to check for container resize */
    debounceTime?: number;
    /** enable "No Results" message if empty result set */
    enableNoResults?: boolean;
    /** Component to render when there are unexpected errors */
    FallbackComponent?: ComponentType<FallbackPropsWithDimension>;
    /** Event listener for unexpected errors from chart */
    onErrorBoundary?: ErrorBoundaryProps['onError'];
    /** Prop for form plugins using superchart */
    showOverflow?: boolean;
    /** Prop for popovercontainer ref */
    parentRef?: RefObject<any>;
    /** Prop for chart ref */
    inputRef?: RefObject<any>;
    /** Chart width */
    height?: number | string;
    /** Chart height */
    width?: number | string;
    /**
     * Component to wrap the actual chart
     * after the dynamic width and height are determined.
     * This can be useful for handling tooltip z-index, etc.
     * e.g. <div style={{ position: 'fixed' }} />
     * You cannot just wrap this same component outside of SuperChart
     * when using dynamic width or height
     * because it will clash with auto-sizing.
     */
    Wrapper?: ComponentType<WrapperProps>;
    /**
     * Component to display when query returns no results.
     * If not defined, NoResultsComponent is used
     */
    noResults?: ReactNode;
    /**
     * Determines is the context menu related to the chart is open
     */
    inContextMenu?: boolean;
  };

function SuperChart({
  id,
  className,
  chartType,
  preTransformProps,
  overrideTransformProps,
  postTransformProps,
  onRenderSuccess,
  onRenderFailure,
  disableErrorBoundary,
  FallbackComponent = DefaultFallbackComponent,
  onErrorBoundary,
  Wrapper,
  queriesData,
  enableNoResults = true,
  noResults,
  theme: themeProp,
  debounceTime,
  height = 400,
  width = '100%',
  ...rest
}: Props): JSX.Element {
  /**
   * SuperChart's core ref
   */
  const coreRef = useRef<SuperChartCoreRef | null>(null);

  // Use theme from hook, falling back to prop if provided
  const themeFromContext = useTheme() as SupersetTheme;
  const theme = themeProp ?? themeFromContext;

  const createChartProps = useMemo(() => ChartProps.createSelector(), []);

  const parseDimension = useMemo(
    () =>
      createSelector(
        [
          ({ width: w }: { width: string | number; height: string | number }) =>
            w,
          ({
            height: h,
          }: {
            width: string | number;
            height: string | number;
          }) => h,
        ],
        (w, h) => {
          // Parse them in case they are % or 'auto'
          const widthInfo = parseLength(w);
          const heightInfo = parseLength(h);
          const boxHeight = heightInfo.isDynamic
            ? `${heightInfo.multiplier * 100}%`
            : heightInfo.value;
          const boxWidth = widthInfo.isDynamic
            ? `${widthInfo.multiplier * 100}%`
            : widthInfo.value;
          const style = {
            height: boxHeight,
            width: boxWidth,
          };

          // bounding box will ensure that when one dimension is not dynamic
          // e.g. height = 300
          // the auto size will be bound to that value instead of being 100% by default
          // e.g. height: 300 instead of height: '100%'
          const BoundingBox =
            widthInfo.isDynamic &&
            heightInfo.isDynamic &&
            widthInfo.multiplier === 1 &&
            heightInfo.multiplier === 1
              ? Fragment
              : ({ children }: { children: ReactNode }) => (
                  <div style={style}>{children}</div>
                );

          return { BoundingBox, heightInfo, widthInfo };
        },
      ),
    [],
  );

  const setRef = useCallback((core: SuperChartCoreRef | null) => {
    coreRef.current = core;
  }, []);

  const getQueryCount = useCallback(
    () => getChartMetadataRegistry().get(chartType)?.queryObjectCount ?? 1,
    [chartType],
  );

  const renderChart = useCallback(
    (chartWidth: number, chartHeight: number) => {
      const chartProps = createChartProps({
        ...rest,
        queriesData,
        height: chartHeight,
        width: chartWidth,
        theme,
      });

      // Check if Matrixify is enabled - use rawFormData (snake_case)
      const matrixifyEnabled = isMatrixifyEnabled(chartProps.rawFormData);

      if (matrixifyEnabled) {
        // When matrixify is enabled, queriesData is expected to be empty
        // since each cell fetches its own data via StatefulChart
        const matrixifyChart = (
          <MatrixifyGridRenderer
            formData={chartProps.rawFormData}
            datasource={chartProps.datasource}
            width={chartWidth}
            height={chartHeight}
            hooks={chartProps.hooks}
          />
        );

        // Apply wrapper if provided
        const wrappedChart = Wrapper ? (
          <Wrapper width={chartWidth} height={chartHeight}>
            {matrixifyChart}
          </Wrapper>
        ) : (
          matrixifyChart
        );

        // Include error boundary unless disabled
        return disableErrorBoundary === true ? (
          wrappedChart
        ) : (
          <ErrorBoundary
            FallbackComponent={props => (
              <FallbackComponent
                width={chartWidth}
                height={chartHeight}
                {...props}
              />
            )}
            onError={onErrorBoundary}
          >
            {wrappedChart}
          </ErrorBoundary>
        );
      }

      // Check for no results only for non-matrixified charts
      const noResultQueries =
        enableNoResults &&
        (!queriesData ||
          queriesData
            .slice(0, getQueryCount())
            .every(
              ({ data }) => !data || (Array.isArray(data) && data.length === 0),
            ));

      let chart: JSX.Element;
      if (noResultQueries) {
        chart = noResults ? (
          <>{noResults}</>
        ) : (
          <NoResultsComponent
            id={id}
            className={className}
            height={chartHeight}
            width={chartWidth}
          />
        );
      } else {
        const chartWithoutWrapper = (
          <SuperChartCore
            ref={setRef}
            id={id}
            className={className}
            chartType={chartType}
            chartProps={chartProps}
            preTransformProps={preTransformProps}
            overrideTransformProps={overrideTransformProps}
            postTransformProps={postTransformProps}
            onRenderSuccess={onRenderSuccess}
            onRenderFailure={onRenderFailure}
          />
        );
        chart = Wrapper ? (
          <Wrapper width={chartWidth} height={chartHeight}>
            {chartWithoutWrapper}
          </Wrapper>
        ) : (
          chartWithoutWrapper
        );
      }
      // Include the error boundary by default unless it is specifically disabled.
      return disableErrorBoundary === true ? (
        chart
      ) : (
        <ErrorBoundary
          FallbackComponent={props => (
            <FallbackComponent
              width={chartWidth}
              height={chartHeight}
              {...props}
            />
          )}
          onError={onErrorBoundary}
        >
          {chart}
        </ErrorBoundary>
      );
    },
    [
      createChartProps,
      rest,
      queriesData,
      theme,
      Wrapper,
      disableErrorBoundary,
      FallbackComponent,
      onErrorBoundary,
      enableNoResults,
      getQueryCount,
      noResults,
      id,
      className,
      setRef,
      chartType,
      preTransformProps,
      overrideTransformProps,
      postTransformProps,
      onRenderSuccess,
      onRenderFailure,
    ],
  );

  const { heightInfo, widthInfo, BoundingBox } = parseDimension({
    width,
    height,
  });

  // If any of the dimension is dynamic, get parent's dimension
  if (widthInfo.isDynamic || heightInfo.isDynamic) {
    return (
      <BoundingBox>
        <ParentSize debounceTime={debounceTime}>
          {({ width: parentWidth, height: parentHeight }) =>
            renderChart(
              widthInfo.isDynamic ? Math.floor(parentWidth) : widthInfo.value,
              heightInfo.isDynamic
                ? Math.floor(parentHeight)
                : heightInfo.value,
            )
          }
        </ParentSize>
      </BoundingBox>
    );
  }

  return renderChart(widthInfo.value, heightInfo.value);
}

export default SuperChart;
