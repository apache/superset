import React, { ReactNode } from 'react';
import ErrorBoundary, { ErrorBoundaryProps, FallbackProps } from 'react-error-boundary';
import { ParentSize } from '@vx/responsive';
import { createSelector } from 'reselect';
import { parseLength, Dimension } from '../../dimension';
import SuperChartCore, { Props as SuperChartCoreProps } from './SuperChartCore';
import DefaultFallbackComponent from './FallbackComponent';
import ChartProps, { ChartPropsConfig } from '../models/ChartProps';
import NoResultsComponent from './NoResultsComponent';

const defaultProps = {
  FallbackComponent: DefaultFallbackComponent,
  height: 400 as string | number,
  width: '100%' as string | number,
  enableNoResults: true,
};

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
    FallbackComponent?: React.ComponentType<FallbackPropsWithDimension>;
    /** Event listener for unexpected errors from chart */
    onErrorBoundary?: ErrorBoundaryProps['onError'];
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
    Wrapper?: React.ComponentType<WrapperProps>;
  };

type PropsWithDefault = Props & Readonly<typeof defaultProps>;

export default class SuperChart extends React.PureComponent<Props, {}> {
  /**
   * SuperChart's core
   */
  core?: SuperChartCore | null;

  private createChartProps = ChartProps.createSelector();

  private parseDimension = createSelector(
    ({ width }: { width: string | number; height: string | number }) => width,
    ({ height }) => height,
    (width, height) => {
      // Parse them in case they are % or 'auto'
      const widthInfo = parseLength(width);
      const heightInfo = parseLength(height);

      const boxHeight = heightInfo.isDynamic ? `${heightInfo.multiplier * 100}%` : heightInfo.value;
      const boxWidth = widthInfo.isDynamic ? `${widthInfo.multiplier * 100}%` : widthInfo.value;
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
          ? React.Fragment
          : ({ children }: { children: ReactNode }) => <div style={style}>{children}</div>;

      return { BoundingBox, heightInfo, widthInfo };
    },
  );

  static defaultProps = defaultProps;

  private setRef = (core: SuperChartCore | null) => {
    this.core = core;
  };

  renderChart(width: number, height: number) {
    const {
      id,
      className,
      chartType,
      preTransformProps,
      overrideTransformProps,
      postTransformProps,
      onRenderSuccess,
      onRenderFailure,
      disableErrorBoundary,
      FallbackComponent,
      onErrorBoundary,
      Wrapper,
      queriesData,
      enableNoResults,
      ...rest
    } = this.props as PropsWithDefault;

    const chartProps = this.createChartProps({
      ...rest,
      queriesData,
      height,
      width,
    });

    let chart;
    // Render the no results component if the query data is null or empty
    const noResultQueries =
      enableNoResults &&
      (!queriesData ||
        queriesData.every(({ data }) => !data || (Array.isArray(data) && data.length === 0)));
    if (noResultQueries) {
      chart = <NoResultsComponent id={id} className={className} height={height} width={width} />;
    } else {
      const chartWithoutWrapper = (
        <SuperChartCore
          ref={this.setRef}
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
        <Wrapper width={width} height={height}>
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
        FallbackComponent={(props: FallbackProps) => (
          <FallbackComponent width={width} height={height} {...props} />
        )}
        onError={onErrorBoundary}
      >
        {chart}
      </ErrorBoundary>
    );
  }

  render() {
    const { heightInfo, widthInfo, BoundingBox } = this.parseDimension(
      this.props as PropsWithDefault,
    );

    // If any of the dimension is dynamic, get parent's dimension
    if (widthInfo.isDynamic || heightInfo.isDynamic) {
      const { debounceTime } = this.props;

      return (
        <BoundingBox>
          <ParentSize debounceTime={debounceTime}>
            {({ width, height }) =>
              this.renderChart(
                widthInfo.isDynamic ? Math.floor(width) : widthInfo.value,
                heightInfo.isDynamic ? Math.floor(height) : heightInfo.value,
              )
            }
          </ParentSize>
        </BoundingBox>
      );
    }

    return this.renderChart(widthInfo.value, heightInfo.value);
  }
}
