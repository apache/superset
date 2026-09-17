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
import { reactify, styled } from '@superset-ui/core';
import Component from './CountryMap';

const ReactComponent = reactify(Component);

const CountryMap = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(CountryMap)`
  ${({ theme }) => `
    .superset-legacy-chart-country-map svg {
      background-color: ${theme.colors.grayscale.light5};
    }

    .superset-legacy-chart-country-map {
      position: relative;
    }

    .superset-legacy-chart-country-map .background {
      fill: ${theme.colors.grayscale.light5};
      pointer-events: all;
    }

    .superset-legacy-chart-country-map .map-layer {
      fill: ${theme.colors.grayscale.light5};
      stroke: ${theme.colors.grayscale.light1};
    }

    .superset-legacy-chart-country-map .effect-layer {
      pointer-events: none;
    }

    .superset-legacy-chart-country-map .text-layer {
      color: ${theme.colors.grayscale.dark1};
      text-anchor: middle;
      pointer-events: none;
    }

    .superset-legacy-chart-country-map text.result-text {
      font-weight: ${theme.typography.weights.light};
      font-size: ${theme.typography.sizes.xl}px;
    }

    .superset-legacy-chart-country-map text.big-text {
      font-weight: ${theme.typography.weights.bold};
      font-size: ${theme.typography.sizes.l}px;
    }

    .superset-legacy-chart-country-map path.region {
      cursor: pointer;
      stroke: ${theme.colors.grayscale.light2};
    }
  `}
`;
