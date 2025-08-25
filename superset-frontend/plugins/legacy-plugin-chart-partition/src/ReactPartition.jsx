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
import Component from './Partition';

const ReactComponent = reactify(Component);

const Partition = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Partition)`
  ${({ theme }) => `
    .superset-legacy-chart-partition {
      position: relative;
    }

    .superset-legacy-chart-partition .chart {
      display: block;
      margin: auto;
      font-size: ${theme.fontSizeSM}px;
    }

    .superset-legacy-chart-partition rect {
      stroke: ${theme.borderColorSecondary};
      fill: ${theme.colorBgLayout};
      fill-opacity: 80%;
      transition: fill-opacity 180ms linear;
      cursor: pointer;
    }

    .superset-legacy-chart-partition rect:hover {
      fill-opacity: 1;
    }

    .superset-legacy-chart-partition g text {
      font-weight: ${theme.fontWeightStrong};
      fill: ${theme.colorText};
    }

    .superset-legacy-chart-partition g:hover text {
      fill: ${theme.colorTextHeading};
    }

    .superset-legacy-chart-partition .partition-tooltip {
      position: absolute;
      top: 0;
      left: 0;
      opacity: 0;
      padding: ${theme.sizeUnit}px;
      pointer-events: none;
      background-color: ${theme.colorBgElevated};
      border-radius: ${theme.borderRadius}px;
    }

    .partition-tooltip td {
      padding-left: ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextSecondary};
    }
  `}
`;
