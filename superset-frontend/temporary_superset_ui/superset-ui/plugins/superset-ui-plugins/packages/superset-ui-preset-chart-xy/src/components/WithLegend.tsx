/* eslint-disable sort-keys */
import React, { CSSProperties, ReactNode, PureComponent } from 'react';
import { ParentSize } from '@vx/responsive';
// eslint-disable-next-line import/no-unresolved
import * as CSS from 'csstype';

const defaultProps = {
  className: '',
  height: 'auto' as number | string,
  width: 'auto' as number | string,
  legendJustifyContent: undefined,
  position: 'top',
};

type Props = {
  className: string;
  width: number | string;
  height: number | string;
  legendJustifyContent: 'center' | 'flex-start' | 'flex-end';
  position: 'top' | 'left' | 'bottom' | 'right';
  renderChart: (dim: { width: number; height: number }) => ReactNode;
  renderLegend?: (params: { direction: string }) => ReactNode;
} & Readonly<typeof defaultProps>;

const LEGEND_STYLE_BASE: CSSProperties = {
  display: 'flex',
  flexGrow: 0,
  flexShrink: 0,
  fontSize: '0.9em',
  order: -1,
  paddingTop: '5px',
};

const CHART_STYLE_BASE: CSSProperties = {
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  position: 'relative',
};

class WithLegend extends PureComponent<Props, {}> {
  static defaultProps = defaultProps;

  getContainerDirection(): CSS.FlexDirectionProperty {
    const { position } = this.props;
    switch (position) {
      case 'left':
        return 'row';
      case 'right':
        return 'row-reverse';
      case 'bottom':
        return 'column-reverse';
      default:
      case 'top':
        return 'column';
    }
  }

  getLegendJustifyContent() {
    const { legendJustifyContent, position } = this.props;
    if (legendJustifyContent) {
      return legendJustifyContent;
    }
    switch (position) {
      case 'left':
        return 'flex-start';
      case 'right':
        return 'flex-start';
      case 'bottom':
        return 'flex-end';
      default:
      case 'top':
        return 'flex-end';
    }
  }

  render() {
    const { className, width, height, position, renderChart, renderLegend } = this.props;

    const isHorizontal = position === 'left' || position === 'right';

    const style: CSSProperties = {
      display: 'flex',
      flexDirection: this.getContainerDirection(),
    };
    if (width) {
      style.width = width;
    }
    if (height) {
      style.height = height;
    }

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
          <ParentSize>
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
