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
/* eslint-disable react/sort-prop-types, react/jsx-sort-default-props */
import { Component } from 'react';
import PropTypes from 'prop-types';
import { ParentSize } from '@vx/responsive';

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
  paddingTop: '5px',
  fontSize: '0.9em',
};

const CHART_STYLE_BASE = {
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
  position: 'relative',
};

class WithLegend extends Component {
  getContainerDirection() {
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
    const { className, width, height, position, renderChart, renderLegend } =
      this.props;

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
    const legendContainerStyle = {
      flexWrap: 'wrap',
      display: 'flex',
      flexDirection: legendDirection,
    };
    return (
      <div className={`with-legend ${className}`} style={style}>
        <div className="legend-container" style={legendStyle}>
          {renderLegend({
            // Pass flexDirection for @vx/legend to arrange legend items
            direction: legendDirection,
            style: legendContainerStyle,
          })}
        </div>
        <div className="main-container" style={chartStyle}>
          <ParentSize>
            {parent =>
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

WithLegend.propTypes = propTypes;
WithLegend.defaultProps = defaultProps;

export default WithLegend;
