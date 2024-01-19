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
import { reactify, styled } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Component from './NVD3Vis';
import { hideTooltips, removeTooltip } from './utils';

function componentWillUnmount() {
  const { id } = this.props;
  if (id !== null && id !== undefined) {
    removeTooltip(id);
  } else {
    hideTooltips(true);
  }
}

const ReactNVD3 = reactify(Component, { componentWillUnmount });

const NVD3 = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactNVD3 {...otherProps} />
  </div>
);

NVD3.propTypes = {
  className: PropTypes.string.isRequired,
};

export default styled(NVD3)`
  .superset-legacy-chart-nvd3-dist-bar,
  .superset-legacy-chart-nvd3-bar {
    overflow-x: auto !important;
    svg {
      &.nvd3-svg {
        width: auto;
        font-size: ${({ theme }) => theme.typography.sizes.m};
      }
    }
  }
  .superset-legacy-chart-nvd3 {
    nv-x text {
      font-size: ${({ theme }) => theme.typography.sizes.m};
    }
    g.superset path {
      stroke-dasharray: 5, 5;
    }
    .nvtooltip tr.highlight td {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      font-size: ${({ theme }) => theme.typography.sizes.m}px !important;
    }
    text.nv-axislabel {
      font-size: ${({ theme }) => theme.typography.sizes.m} !important;
    }
    g.solid path,
    line.solid {
      stroke-dasharray: unset;
    }
    g.dashed path,
    line.dashed {
      stroke-dasharray: 5, 5;
    }
    g.longDashed path,
    line.dotted {
      stroke-dasharray: 1, 1;
    }

    g.opacityLow path,
    line.opacityLow {
      stroke-opacity: 0.2;
    }

    g.opacityMedium path,
    line.opacityMedium {
      stroke-opacity: 0.5;
    }
    g.opacityHigh path,
    line.opacityHigh {
      stroke-opacity: 0.8;
    }
    g.time-shift-0 path,
    line.time-shift-0 {
      stroke-dasharray: 5, 5;
    }
    g.time-shift-1 path,
    line.time-shift-1 {
      stroke-dasharray: 1, 5;
    }
    g.time-shift-2 path,
    line.time-shift-3 {
      stroke-dasharray: 5, 1;
    }
    g.time-shift-3 path,
    line.time-shift-3 {
      stroke-dasharray: 5, 1;
    }
    g.time-shift-4 path,
    line.time-shift-4 {
      stroke-dasharray: 5, 10;
    }
    g.time-shift-5 path,
    line.time-shift-5 {
      stroke-dasharray: 0.9;
    }
    g.time-shift-6 path,
    line.time-shift-6 {
      stroke-dasharray: 15, 10, 5;
    }
    g.time-shift-7 path,
    line.time-shift-7 {
      stroke-dasharray: 15, 10, 5, 10;
    }
    g.time-shift-8 path,
    line.time-shift-8 {
      stroke-dasharray: 15, 10, 5, 10, 15;
    }
    g.time-shift-9 path,
    line.time-shift-9 {
      stroke-dasharray: 5, 5, 1, 5;
    }
    .nv-noData.body {
      font-size: ${({ theme }) => theme.typography.sizes.m};
      font-weight: ${({ theme }) => theme.typography.weights.normal};
    }
  }
  .superset-legacy-chart-nvd3-tr-highlight {
    border-top: 1px solid;
    border-bottom: 1px solid;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  .superset-legacy-chart-nvd3-tr-total {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  .nvtooltip {
    .tooltip-header {
      white-space: nowrap;
      font-weight: ${({ theme }) => theme.typography.weights.bold};
    }
    tbody tr:not(.tooltip-header) td:nth-of-type(2) {
      word-break: break-word;
    }
  }
  .d3-tip.nv-event-annotation-layer-table,
  .d3-tip.nv-event-annotation-layer-NATIVE {
    width: 200px;
    border-radius: 2px;
    background-color: ${({ theme }) => theme.colors.grayscale.base};
    fill-opacity: 0.6;
    margin: ${({ theme }) => theme.gridUnit * 2}px;
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    color: ${({ theme }) => theme.colors.grayscale.light5};
    &:after {
      content: '\\25BC';
      font-size: ${({ theme }) => theme.typography.sizes.m};
      color: ${({ theme }) => theme.colors.grayscale.base};
      position: absolute;
      bottom: -14px;
      left: 94px;
    }
  }
`;
