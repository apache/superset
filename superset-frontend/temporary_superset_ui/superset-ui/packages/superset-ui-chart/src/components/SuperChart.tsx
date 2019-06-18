import React from 'react';
import ErrorBoundary, { ErrorBoundaryProps, FallbackProps } from 'react-error-boundary';
import { parseLength } from '@superset-ui/dimension';
import { ParentSize } from '@vx/responsive';
import SuperChartCore, { Props as SuperChartCoreProps } from './SuperChartCore';
import DefaultFallbackComponent from './FallbackComponent';
import ChartProps, { ChartPropsConfig } from '../models/ChartProps';

const defaultProps = {
  FallbackComponent: DefaultFallbackComponent,
  // eslint-disable-next-line no-magic-numbers
  height: 400 as string | number,
  width: '100%' as string | number,
};

export type FallbackPropsWithDimension = FallbackProps & { width?: number; height?: number };

export type Props = Omit<SuperChartCoreProps, 'chartProps'> &
  Omit<ChartPropsConfig, 'width' | 'height'> & {
    disableErrorBoundary?: boolean;
    debounceTime?: number;
    FallbackComponent?: React.ComponentType<FallbackPropsWithDimension>;
    onErrorBoundary?: ErrorBoundaryProps['onError'];
    height?: number | string;
    width?: number | string;
  };

type PropsWithDefault = Props & Readonly<typeof defaultProps>;

export default class SuperChart extends React.PureComponent<Props, {}> {
  static defaultProps = defaultProps;

  /**
   * SuperChart's core
   */
  core?: SuperChartCore | null;

  private createChartProps = ChartProps.createSelector();

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
      ...rest
    } = this.props as PropsWithDefault;

    const chart = (
      <SuperChartCore
        ref={this.setRef}
        id={id}
        className={className}
        chartType={chartType}
        chartProps={this.createChartProps({
          ...rest,
          height,
          width,
        })}
        preTransformProps={preTransformProps}
        overrideTransformProps={overrideTransformProps}
        postTransformProps={postTransformProps}
        onRenderSuccess={onRenderSuccess}
        onRenderFailure={onRenderFailure}
      />
    );

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
    const { width: inputWidth, height: inputHeight } = this.props as PropsWithDefault;

    // Parse them in case they are % or 'auto'
    const widthInfo = parseLength(inputWidth);
    const heightInfo = parseLength(inputHeight);

    // If any of the dimension is dynamic, get parent's dimension
    if (widthInfo.isDynamic || heightInfo.isDynamic) {
      const { debounceTime } = this.props;

      return (
        <ParentSize debounceTime={debounceTime}>
          {({ width, height }) =>
            width > 0 &&
            height > 0 &&
            this.renderChart(
              widthInfo.isDynamic ? Math.floor(width * widthInfo.multiplier) : widthInfo.value,
              heightInfo.isDynamic ? Math.floor(height * heightInfo.multiplier) : heightInfo.value,
            )
          }
        </ParentSize>
      );
    }

    return this.renderChart(widthInfo.value, heightInfo.value);
  }
}
