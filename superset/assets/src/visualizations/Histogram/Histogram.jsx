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
import PropTypes from 'prop-types';
import React from 'react';
import { Histogram, BarSeries, XAxis, YAxis } from '@data-ui/histogram';
import { chartTheme } from '@data-ui/theme';
import { LegendOrdinal } from '@vx/legend';
import { scaleOrdinal } from '@vx/scale';
import { CategoricalColorNamespace } from '@superset-ui/color';
import WithLegend from '../WithLegend';
import './Histogram.css';

const propTypes = {
  className: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    values: PropTypes.arrayOf(PropTypes.number),
  })).isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  colorScheme: PropTypes.string,
  normalized: PropTypes.bool,
  binCount: PropTypes.number,
  opacity: PropTypes.number,
  xAxisLabel: PropTypes.string,
  yAxisLabel: PropTypes.string,
};
const defaultProps = {
  className: '',
  colorScheme: '',
  normalized: false,
  binCount: 15,
  opacity: 1,
  xAxisLabel: '',
  yAxisLabel: '',
};

class CustomHistogram extends React.PureComponent {
  render() {
    const {
      className,
      data,
      width,
      height,
      binCount,
      colorScheme,
      normalized,
      opacity,
      xAxisLabel,
      yAxisLabel,
    } = this.props;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    const keys = data.map(d => d.key);
    const colorScale = scaleOrdinal({
      domain: keys,
      range: keys.map(colorFn),
    });

    return (
      <WithLegend
        className={`histogram-chart ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={({ direction }) => (
          <LegendOrdinal
            scale={colorScale}
            direction={direction}
            shape="rect"
            labelMargin="0 15px 0 0"
          />
        )}
        renderChart={parent => (
          <Histogram
            width={parent.width}
            height={parent.height}
            ariaLabel="Histogram"
            normalized={normalized}
            binCount={binCount}
            binType="numeric"
            renderTooltip={({ datum, color }) => (
              <div>
                <strong style={{ color }}>{datum.bin0} to {datum.bin1}</strong>
                <div><strong>count </strong>{datum.count}</div>
                <div><strong>cumulative </strong>{datum.cumulative}</div>
              </div>
            )}
            valueAccessor={datum => datum}
            theme={chartTheme}
          >
            {data.map(series => (
              <BarSeries
                key={series.key}
                animated
                rawData={series.values}
                fill={colorScale(series.key)}
                fillOpacity={opacity}
              />
            ))}
            <XAxis label={xAxisLabel} />
            <YAxis label={yAxisLabel} />
          </Histogram>
        )}
      />
    );
  }
}

CustomHistogram.propTypes = propTypes;
CustomHistogram.defaultProps = defaultProps;

export default CustomHistogram;
