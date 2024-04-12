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
import React from 'react';
import { styled, reactify, addAlpha } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Component from './ParallelCoordinates';

const ReactComponent = reactify(Component);

const ParallelCoordinates = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

ParallelCoordinates.propTypes = {
  className: PropTypes.string.isRequired,
};

export default styled(ParallelCoordinates)`
  ${({ theme }) => `
    .superset-legacy-chart-parallel-coordinates {
      div.grid {
        overflow: auto;
        div.row {
          &:hover {
            background-color: ${theme.colors.grayscale.light2};
          }
        }
      }
    }
    .parcoords svg,
    .parcoords canvas {
      font-size: ${theme.typography.sizes.s}px;
      position: absolute;
    }
    .parcoords > canvas {
      pointer-events: none;
    }

    .parcoords text.label {
      font: 100%;
      font-size: ${theme.typography.sizes.s}px;
      cursor: drag;
    }
    .parcoords rect.background {
      fill: transparent;
    }
    .parcoords rect.background:hover {
      fill: ${addAlpha(theme.colors.grayscale.base, 0.2)};
    }
    .parcoords .resize rect {
      fill: ${addAlpha(theme.colors.grayscale.dark2, 0.1)};
    }
    .parcoords rect.extent {
      fill: ${addAlpha(theme.colors.grayscale.light5, 0.25)};
      stroke: ${addAlpha(theme.colors.grayscale.dark2, 0.6)};
    }
    .parcoords .axis line,
    .parcoords .axis path {
      fill: none;
      stroke: ${theme.colors.grayscale.dark1};
      shape-rendering: crispEdges;
    }
    .parcoords canvas {
      opacity: 1;
      -moz-transition: opacity 0.3s;
      -webkit-transition: opacity 0.3s;
      -o-transition: opacity 0.3s;
    }
    .parcoords canvas.faded {
      opacity: ${theme.opacity.mediumLight};
    }
    .parcoords {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      background-color: ${theme.colors.grayscale.light5};
    }

    /* data table styles */
    .parcoords .row,
    .parcoords .header {
      clear: left;
      font-size: ${theme.typography.sizes.s}px;
      line-height: 18px;
      height: 18px;
      margin: 0px;
    }
    .parcoords .row:nth-of-type(odd) {
      background: ${addAlpha(theme.colors.grayscale.dark2, 0.05)};
    }
    .parcoords .header {
      font-weight: ${theme.typography.weights.bold};
    }
    .parcoords .cell {
      float: left;
      overflow: hidden;
      white-space: nowrap;
      width: 100px;
      height: 18px;
    }
    .parcoords .col-0 {
      width: 180px;
    }
  `}
`;
