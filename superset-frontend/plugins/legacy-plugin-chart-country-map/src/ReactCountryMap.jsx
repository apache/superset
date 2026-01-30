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
import { reactify } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import Component from './CountryMap';

const ReactComponent = reactify(Component);

const CountryMap = ({ className = '', ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(CountryMap)`
  ${({ theme }) => `
    .superset-legacy-chart-country-map svg {
      background-color: ${theme.colorBgContainer};
    }

    .superset-legacy-chart-country-map {
      position: relative;
    }

    .superset-legacy-chart-country-map .background {
      fill: ${theme.colorBgContainer};
      pointer-events: all;
    }

    .superset-legacy-chart-country-map .hover-popup {
      position: absolute;
      color: ${theme.colorTextSecondary};
      display: none;
      padding: 4px;
      border-radius: 1px;
      background-color: ${theme.colorBgElevated};
      box-shadow: ${theme.boxShadow};
      font-size: 12px;
      border: 1px solid ${theme.colorBorder};
      z-index: 10001;
    }

    .superset-legacy-chart-country-map .map-layer {
      fill: ${theme.colorBgContainer};
      stroke: ${theme.colorBorderSecondary};
      pointer-events: all;
    }

    .superset-legacy-chart-country-map .effect-layer {
      pointer-events: none;
    }

    .superset-legacy-chart-country-map path.region {
      cursor: pointer;
      stroke: ${theme.colorSplit};
    }
  `}
`;
