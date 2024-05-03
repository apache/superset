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
import { reactify, css, styled } from '@superset-ui/core';
import { Global } from '@emotion/react';
import Component from './Heatmap';

function componentWillUnmount() {
  // Removes tooltips from the DOM
  document.querySelectorAll('.d3-tip').forEach(t => t.remove());
}

const ReactComponent = reactify(Component, { componentWillUnmount });

const Heatmap = ({ className, ...otherProps }) => (
  <div className={className}>
    <Global
      styles={theme => css`
        .d3-tip {
          line-height: 1;
          padding: ${theme.gridUnit * 3}px;
          background: ${theme.colors.grayscale.dark2};
          color: ${theme.colors.grayscale.light5};
          border-radius: 4px;
          pointer-events: none;
          z-index: 1000;
          font-size: ${theme.typography.sizes.s}px;
        }

        /* Creates a small triangle extender for the tooltip */
        .d3-tip:after {
          box-sizing: border-box;
          display: inline;
          font-size: ${theme.typography.sizes.xs};
          width: 100%;
          line-height: 1;
          color: ${theme.colors.grayscale.dark2};
          position: absolute;
          pointer-events: none;
        }

        /* Northward tooltips */
        .d3-tip.n:after {
          content: '\\25BC';
          margin: -${theme.gridUnit}px 0 0 0;
          top: 100%;
          left: 0;
          text-align: center;
        }

        /* Eastward tooltips */
        .d3-tip.e:after {
          content: '\\25C0';
          margin: -${theme.gridUnit}px 0 0 0;
          top: 50%;
          left: -${theme.gridUnit * 2}px;
        }

        /* Southward tooltips */
        .d3-tip.s:after {
          content: '\\25B2';
          margin: 0;
          top: -${theme.gridUnit * 2}px;
          left: 0;
          text-align: center;
        }

        /* Westward tooltips */
        .d3-tip.w:after {
          content: '\\25B6';
          margin: -${theme.gridUnit}px 0 0 0px;
          top: 50%;
          left: 100%;
        }
      `}
    />
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Heatmap)`
  ${({ theme }) => `
    .superset-legacy-chart-heatmap {
      position: relative;
      top: 0;
      left: 0;
      height: 100%;
    }

    .superset-legacy-chart-heatmap .axis text {
      font-size: ${theme.typography.sizes.xs}px;
      text-rendering: optimizeLegibility;
    }

    .superset-legacy-chart-heatmap .background-rect {
      stroke: ${theme.colors.grayscale.light2};
      fill-opacity: 0;
      pointer-events: all;
    }

    .superset-legacy-chart-heatmap .axis path,
    .superset-legacy-chart-heatmap .axis line {
      fill: none;
      stroke: ${theme.colors.grayscale.light2};
      shape-rendering: crispEdges;
    }

    .superset-legacy-chart-heatmap canvas,
    .superset-legacy-chart-heatmap img {
      image-rendering: optimizeSpeed; /* Older versions of FF */
      image-rendering: -moz-crisp-edges; /* FF 6.0+ */
      image-rendering: -webkit-optimize-contrast; /* Safari */
      image-rendering: -o-crisp-edges; /* OS X & Windows Opera (12.02+) */
      image-rendering: pixelated; /* Awesome future-browsers */
      -ms-interpolation-mode: nearest-neighbor; /* IE */
    }

    .superset-legacy-chart-heatmap .legendCells text {
      font-size: ${theme.typography.sizes.xs}px;
      font-weight: ${theme.typography.weights.normal};
      opacity: 0;
    }

    .superset-legacy-chart-heatmap .legendCells .cell:first-child text {
      opacity: 1;
    }

    .superset-legacy-chart-heatmap .legendCells .cell:last-child text {
      opacity: 1;
    }

    .dashboard .superset-legacy-chart-heatmap .axis text {
      font-size: ${theme.typography.sizes.xs}px;
      opacity: ${theme.opacity.heavy};
    }
  `}
`;
