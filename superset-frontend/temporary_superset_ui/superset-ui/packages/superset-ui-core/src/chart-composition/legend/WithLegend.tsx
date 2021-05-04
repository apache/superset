import React, { CSSProperties, ReactNode, PureComponent } from 'react';
import { ParentSize } from '@vx/responsive';

const defaultProps = {
  className: '',
  height: 'auto' as number | string,
  position: 'top',
  width: 'auto' as number | string,
};

type Props = {
  className: string;
  debounceTime?: number;
  width: number | string;
  height: number | string;
  legendJustifyContent?: 'center' | 'flex-start' | 'flex-end';
  position: 'top' | 'left' | 'bottom' | 'right';
  renderChart: (dim: { width: number; height: number }) => ReactNode;
  renderLegend?: (params: { direction: string }) => ReactNode;
} & Readonly<typeof defaultProps>;

const LEGEND_STYLE_BASE: CSSProperties = {
  display: 'flex',
  flexGrow: 0,
  flexShrink: 0,
  order: -1,
};

const CHART_STYLE_BASE: CSSProperties = {
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  position: 'relative',
};

class WithLegend extends PureComponent<Props, {}> {
  static defaultProps = defaultProps;

  getContainerDirection(): CSSProperties['flexDirection'] {
    const { position } = this.props;

    if (position === 'left') {
      return 'row';
    }
    if (position === 'right') {
      return 'row-reverse';
    }
    if (position === 'bottom') {
      return 'column-reverse';
    }

    return 'column';
  }

  getLegendJustifyContent() {
    const { legendJustifyContent, position } = this.props;
    if (legendJustifyContent) {
      return legendJustifyContent;
    }

    if (position === 'left' || position === 'right') {
      return 'flex-start';
    }

    return 'flex-end';
  }

  render() {
    const {
      className,
      debounceTime,
      width,
      height,
      position,
      renderChart,
      renderLegend,
    } = this.props;

    const isHorizontal = position === 'left' || position === 'right';

    const style: CSSProperties = {
      display: 'flex',
      flexDirection: this.getContainerDirection(),
      height,
      width,
    };

    const chartStyle: CSSProperties = { ...CHART_STYLE_BASE };
    if (isHorizontal) {
      chartStyle.width = 0;
    } else {
      chartStyle.height = 0;
    }

    const legendDirection = isHorizontal ? 'column' : 'row';
    const legendStyle: CSSProperties = {
      ...LEGEND_STYLE_BASE,
      flexDirection: legendDirection,
      justifyContent: this.getLegendJustifyContent(),
    };

    return (
      <div className={`with-legend ${className}`} style={style}>
        {renderLegend && (
          <div className="legend-container" style={legendStyle}>
            {renderLegend({
              // Pass flexDirection for @vx/legend to arrange legend items
              direction: legendDirection,
            })}
          </div>
        )}
        <div className="main-container" style={chartStyle}>
          <ParentSize debounceTime={debounceTime}>
            {(parent: { width: number; height: number }) =>
              parent.width > 0 && parent.height > 0
                ? // Only render when necessary
                  renderChart(parent)
                : null
            }
          </ParentSize>
        </div>
      </div>
    );
  }
}

export default WithLegend;
