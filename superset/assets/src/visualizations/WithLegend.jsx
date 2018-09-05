import React from 'react';
import PropTypes from 'prop-types';
import { ParentSize } from '@vx/responsive';
import './WithLegend.css';

const propTypes = {
  className: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  renderChart: PropTypes.func.isRequired,
  renderLegend: PropTypes.func.isRequired,
  position: PropTypes.oneOf(['top', 'left', 'bottom', 'right']),
  legendJustifyContent: PropTypes.oneOf(['center', 'flex-start', 'flex-end']),
};
const defaultProps = {
  className: '',
  width: 'auto',
  height: 'auto',
  position: 'top',
  legendJustifyContent: undefined,
};

const LEGEND_STYLE_BASE = {
  display: 'flex',
  flexGrow: 0,
  flexShrink: 0,
  order: -1,
};

const CHART_STYLE_BASE = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
  position: 'relative',
};

class WithLegend extends React.Component {
  getContainerDirection() {
    const { position } = this.props;
    switch (position) {
      case 'left': return 'row';
      case 'right': return 'row-reverse';
      case 'bottom': return 'column-reverse';
      default:
      case 'top': return 'column';
    }
  }

  getLegendJustifyContent() {
    const { legendJustifyContent, position } = this.props;
    if (legendJustifyContent) {
      return legendJustifyContent;
    }
    switch (position) {
      case 'left': return 'flex-start';
      case 'right': return 'flex-start';
      case 'bottom': return 'flex-end';
      default:
      case 'top': return 'flex-end';
    }
  }

  render() {
    const {
      className,
      width,
      height,
      position,
      renderChart,
      renderLegend,
    } = this.props;

    const isHorizontal = position === 'left' || position === 'right';

    const style = {
      display: 'flex',
      flexDirection: this.getContainerDirection(),
    };
    if (width) {
      style.width = width;
    }
    if (height) {
      style.height = height;
    }

    const chartStyle = { ...CHART_STYLE_BASE };
    if (isHorizontal) {
      chartStyle.width = 0;
    } else {
      chartStyle.height = 0;
    }

    const legendDirection = isHorizontal ? 'column' : 'row';
    const legendStyle = {
      ...LEGEND_STYLE_BASE,
      flexDirection: legendDirection,
      justifyContent: this.getLegendJustifyContent(),
    };

    return (
      <div className={`with-legend ${className}`} style={style}>
        <div className="legend-container" style={legendStyle}>
          {renderLegend({
            // Pass flexDirection for @vx/legend to arrange legend items
            direction: legendDirection,
          })}
        </div>
        <div className="main-container" style={chartStyle}>
          <ParentSize>{parent => (parent.width > 0 && parent.height > 0)
            // Only render when necessary
            ? renderChart(parent)
            : null}
          </ParentSize>
        </div>
      </div>
    );
  }
}

WithLegend.propTypes = propTypes;
WithLegend.defaultProps = defaultProps;

export default WithLegend;
