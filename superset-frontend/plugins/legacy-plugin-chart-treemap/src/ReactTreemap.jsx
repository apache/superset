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
import Component from './Treemap';

const ReactComponent = reactify(Component);

const Treemap = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Treemap)`
  ${({ theme }) => `
    .superset-legacy-chart-treemap text {
      font-size: ${theme.typography.sizes.s}px;
      pointer-events: none;
    }

    .superset-legacy-chart-treemap tspan:last-child {
      font-size: ${theme.typography.sizes.xs}px;
      fill-opacity: 0.8;
    }

    .superset-legacy-chart-treemap .node rect {
      shape-rendering: crispEdges;
    }

    .superset-legacy-chart-treemap .node--hover rect {
      stroke: ${theme.colors.grayscale.dark2};
    }
  `}
`;
