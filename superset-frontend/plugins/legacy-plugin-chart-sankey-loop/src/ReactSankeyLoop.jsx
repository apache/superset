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
import Component from './SankeyLoop';

const ReactComponent = reactify(Component);

const Sankey = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Sankey)`
  ${({ theme }) => `
    .superset-legacy-chart-sankey-loop .node rect {
      cursor: move;
      fill-opacity: ${theme.opacity.heavy};
      shape-rendering: crispEdges;
    }

    .superset-legacy-chart-sankey-loop .node text {
      pointer-events: none;
      text-shadow: 0 1px 0 ${theme.colors.grayscale.light5};
    }

    .superset-legacy-chart-sankey-loop .link {
      fill: none;
      stroke: ${theme.colors.grayscale.dark2};
      stroke-opacity: ${theme.opacity.light};
    }

    .superset-legacy-chart-sankey-loop .link:hover {
      stroke-opacity: ${theme.opacity.mediumHeavy};
    }

    .superset-legacy-chart-sankey-loop .link path {
      opacity: ${theme.opacity.mediumLight};
      stroke-opacity: 0;
    }

    .superset-legacy-chart-sankey-loop .link:hover path {
      opacity: ${theme.opacity.heavy};
    }

    .superset-legacy-chart-sankey-loop .link text {
      fill: ${theme.colors.grayscale.base};
      font-size: ${theme.gridUnit * 3}px;
    }

    .superset-legacy-chart-sankey-loop .link:hover text {
      opacity: 1;
    }
 `}
`;
