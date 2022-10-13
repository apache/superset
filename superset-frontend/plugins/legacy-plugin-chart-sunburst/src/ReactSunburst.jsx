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
import Component from './Sunburst';

const ReactComponent = reactify(Component);

const Sunburst = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Sunburst)`
  ${({ theme }) => `
    .superset-legacy-chart-sunburst text {
      text-rendering: optimizeLegibility;
    }
    .superset-legacy-chart-sunburst path {
      stroke: ${theme.colors.grayscale.light2};
      stroke-width: 0.5px;
    }
    .superset-legacy-chart-sunburst .center-label {
      text-anchor: middle;
      fill: ${theme.colors.grayscale.dark1};
      pointer-events: none;
    }
    .superset-legacy-chart-sunburst .path-abs-percent {
      font-size: ${theme.typography.sizes.m}px;
      font-weight: ${theme.typography.weights.bold};
    }
    .superset-legacy-chart-sunburst .path-cond-percent {
      font-size: ${theme.typography.sizes.s}px;
    }
    .superset-legacy-chart-sunburst .path-metrics {
      color: ${theme.colors.grayscale.base};
    }
    .superset-legacy-chart-sunburst .path-ratio {
      color: ${theme.colors.grayscale.base};
    }

    .superset-legacy-chart-sunburst .breadcrumbs text {
      font-weight: ${theme.typography.weights.bold};
      font-size: ${theme.typography.sizes.m}px;
      text-anchor: middle;
      fill: ${theme.colors.grayscale.dark1};
    }
  `}
`;
