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
/* eslint-disable sort-keys, no-magic-numbers, complexity */
import PropTypes from 'prop-types';
import React from 'react';
import { LineSeries, XYChart } from '@data-ui/xy-chart';
import { themeShape } from '@data-ui/xy-chart/esm/utils/propShapes';
import { chartTheme } from '@data-ui/theme';
import { CategoricalColorNamespace } from '@superset-ui/color';
import createTooltip from './createTooltip';
import renderLegend from '../utils/renderLegend';
import XYChartLayout from '../utils/XYChartLayout';
import WithLegend from '../components/WithLegend';

chartTheme.gridStyles.stroke = '#f1f3f5';

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      values: PropTypes.arrayOf(PropTypes.number),
    }),
  ).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  margin: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
    bottom: PropTypes.number,
    right: PropTypes.number,
  }),
  encoding: PropTypes.shape({
    x: PropTypes.object,
    y: PropTypes.object,
    color: PropTypes.object,
  }).isRequired,
  theme: themeShape,
};

const defaultProps = {
  className: '',
  margin: { top: 10, right: 10, left: 10, bottom: 10 },
  theme: chartTheme,
};

class LineChart extends React.PureComponent {
  renderChart({ width, height }) {
    const { data, encoding, margin, theme } = this.props;

    const config = {
      width,
      height,
      minContentWidth: 0,
      minContentHeight: 0,
      margin,
      theme,
      encoding,
    };

    const colorFn = CategoricalColorNamespace.getScale(
      encoding.color.scale.scheme,
      encoding.color.scale.namespace,
    );

    const colorAccessor = encoding.color.accessor;

    const children = data.map(series => (
      <LineSeries
        key={series.key.join('/')}
        animated
        data={series.values}
        stroke={colorFn(colorAccessor(series))}
        strokeWidth={1.5}
      />
    ));

    const layout = new XYChartLayout({ ...config, children });

    return layout.createChartWithFrame(dim => (
      <XYChart
        width={dim.width}
        height={dim.height}
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={createTooltip(encoding.y.axis.tickFormat)}
        showYGrid
        // snapTooltipToDataX
        theme={config.theme}
        xScale={config.encoding.x.scale}
        yScale={config.encoding.y.scale}
      >
        {children}
        {layout.createXAxis()}
        {layout.createYAxis()}
      </XYChart>
    ));
  }

  render() {
    const { className, data, width, height, encoding } = this.props;

    return (
      <WithLegend
        className={`superset-chart-line ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={() => renderLegend(data, encoding.color)}
        renderChart={parent => this.renderChart(parent)}
        hideLegend={!encoding.color.legend}
      />
    );
  }
}

LineChart.propTypes = propTypes;
LineChart.defaultProps = defaultProps;

export default LineChart;
