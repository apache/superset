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
/* eslint-disable react/jsx-sort-default-props, react/sort-prop-types */
import React from 'react';
import PropTypes from 'prop-types';
import { extent as d3Extent } from 'd3-array';
import { ensureIsArray } from '@superset-ui/core';
import HorizonRow, { DEFAULT_COLORS } from './HorizonRow';
import './HorizonChart.css';

const propTypes = {
  className: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  seriesHeight: PropTypes.number,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.arrayOf(PropTypes.string),
      values: PropTypes.arrayOf(
        PropTypes.shape({
          y: PropTypes.number,
        }),
      ),
    }),
  ).isRequired,
  // number of bands in each direction (positive / negative)
  bands: PropTypes.number,
  colors: PropTypes.arrayOf(PropTypes.string),
  colorScale: PropTypes.string,
  mode: PropTypes.string,
  offsetX: PropTypes.number,
};
const defaultProps = {
  className: '',
  width: 800,
  height: 600,
  seriesHeight: 20,
  bands: Math.floor(DEFAULT_COLORS.length / 2),
  colors: DEFAULT_COLORS,
  colorScale: 'series',
  mode: 'offset',
  offsetX: 0,
};

class HorizonChart extends React.PureComponent {
  render() {
    const {
      className,
      width,
      height,
      data,
      seriesHeight,
      bands,
      colors,
      colorScale,
      mode,
      offsetX,
    } = this.props;

    let yDomain;
    if (colorScale === 'overall') {
      const allValues = data.reduce(
        (acc, current) => acc.concat(current.values),
        [],
      );
      yDomain = d3Extent(allValues, d => d.y);
    }

    return (
      <div
        className={`superset-legacy-chart-horizon ${className}`}
        style={{ height }}
      >
        {data.map(row => (
          <HorizonRow
            key={row.key}
            width={width}
            height={seriesHeight}
            title={ensureIsArray(row.key).join(', ')}
            data={row.values}
            bands={bands}
            colors={colors}
            colorScale={colorScale}
            mode={mode}
            offsetX={offsetX}
            yDomain={yDomain}
          />
        ))}
      </div>
    );
  }
}

HorizonChart.propTypes = propTypes;
HorizonChart.defaultProps = defaultProps;

export default HorizonChart;
